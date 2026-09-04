const {
  app,
  BrowserWindow,
  session,
  protocol,
  screen,
  Tray,
  Menu,
  nativeImage,
  Notification,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { useViteDevServer } = require('./config.cjs');
const { enforceSessionHttpsOnly, isBlockedCleartext } = require('./httpsOnly.cjs');
const { installMainErrorMonitor, report: reportError } = require('./errorMonitor.cjs');
const tokenVault = require('./tokenVault.cjs');
const { startSosMonitor } = require('./sosMonitor.cjs');
const { startPushClient } = require('./pushService.cjs');
const panelWindows = require('./panelWindows.cjs');
const deepLink = require('./deepLink.cjs');
const {
  getPanelNavigationAction,
  isTrustedPanelOrigin: isTrustedOrigin,
} = require('./securityPolicy.cjs');

const ctx = require('./ctx.cjs');
const { PANEL_PARTITION } = require('./recordingProtocol.cjs');
require('./siteBrowserView.cjs');
require('./autoUpdateSetup.cjs');
require('./ipcRegistry.cjs');

installMainErrorMonitor();

// Single-instance + deep links (myastroapp://login) — before ready.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const url = deepLink.findDeepLinkInArgv(commandLine);
    if (url) {
      handleDeepLink(url);
      return;
    }
    showMainWindow();
  });
}

// macOS: cold / warm open via custom protocol.
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Optional: improves Chromium network geolocation on some platforms.
if (process.env.GOOGLE_API_KEY) {
  app.commandLine.appendSwitch('google-api-key', process.env.GOOGLE_API_KEY);
}

// Must run before app is ready — makes app:// a secure origin so geolocation works
// (file:// does not qualify as a secure context for navigator.geolocation).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
  {
    scheme: 'astro-recording',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Portrait phone-like window for Login
const PORTRAIT_WIDTH = 390;
const PORTRAIT_HEIGHT = 720;

const DIST_DIR = path.join(__dirname, '..', 'dist');

let tray = null;
/** When true, window close actually quits (tray Quit / before-quit). */
let isQuitting = false;
let trayHintShown = false;
/** Last Bearer token seen from the renderer — needed for SOS polling (API requires auth). */
let cachedAuthToken = null;
/** @type {{ stop?: () => void, refresh?: () => void, forceActive?: () => void, forceClear?: () => void } | null} */
let sosMonitor = null;
/** @type {{ stop?: () => void, publishSos?: () => Promise<boolean>, publishClear?: () => Promise<boolean> } | null} */
let pushClient = null;
let fcmListener = null;

function loadPersistedToken() {
  return tokenVault.readToken();
}

function persistToken(token) {
  try {
    return tokenVault.writeToken(token || '');
  } catch (err) {
    console.warn('[token] could not persist token:', err?.message || err);
    reportError('main:persistToken', err);
    return {
      ok: false,
      encrypted: false,
      message: 'OS secure storage is unavailable; token was not persisted',
    };
  }
}

function iconPath() {
  return path.join(__dirname, '..', 'build', 'icon.png');
}

function focusWindow(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (typeof win.moveTop === 'function') win.moveTop();
  } catch {
    // ignore
  }
}

/**
 * Logout / login deep link from Astro site or OS:
 * myastroapp://login?logged_out=1
 */
function prepareNativeAuthShell() {
  for (const rec of panelWindows.listPanels()) {
    try {
      ctx.applyNativeAuthSize(rec);
    } catch {
      ctx.hideSiteView(rec);
    }
  }
}

function handleDeepLink(url) {
  const payload = deepLink.parseDeepLink(url);
  if (!payload) return false;

  // Keep pending until renderer consumes via getPendingDeepLink (cold start).
  deepLink.setPending(payload);

  if (!app.isReady()) {
    return true;
  }

  showMainWindow();
  prepareNativeAuthShell();
  panelWindows.broadcastToPanels('gcalc:deep-link', payload);
  return true;
}

function consumePendingDeepLink() {
  const payload = deepLink.takePending();
  if (!payload) return null;
  prepareNativeAuthShell();
  return payload;
}

function showMainWindow() {
  let win = panelWindows.getPrimaryWindow();
  if (!win || win.isDestroyed()) {
    win = createWindow();
  }
  focusWindow(win);
}

function openNewPanelWindow() {
  if (!panelWindows.canOpenAnotherWindow()) {
    const existing = panelWindows.getPrimaryWindow();
    focusWindow(existing);
    return { ok: false, message: `Maximum ${panelWindows.MAX_PANEL_WINDOWS} windows` };
  }
  // Extra windows skip the marketing Astro site → panel (session) or OTP login.
  const win = createWindow({ skipSite: true });
  focusWindow(win);
  return { ok: true };
}

function hideWindowToTray(win) {
  if (!win || win.isDestroyed()) return;
  win.hide();

  if (!trayHintShown && Notification.isSupported()) {
    trayHintShown = true;
    try {
      const n = new Notification({
        title: 'Astro CS Panel',
        body: 'Still running in the background for SOS alerts. Use the tray icon → Quit to stop.',
        silent: true,
      });
      n.show();
    } catch {
      // ignore
    }
  }
}

function createTray() {
  if (tray) return;

  let image = nativeImage.createFromPath(iconPath());
  if (image.isEmpty()) {
    console.warn('[tray] icon missing — tray may be blank');
  } else {
    // Tray icons are tiny; full-size PNG looks wrong / can fail on some OS.
    image = image.resize({ width: 24, height: 24 });
  }

  tray = new Tray(image);
  tray.setToolTip('Astro CS Panel — SOS monitoring active');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Astro CS Panel',
        click: () => showMainWindow(),
      },
      {
        label: 'New Window',
        click: () => openNewPanelWindow(),
      },
      { type: 'separator' },
      {
        label: 'Quit (stop SOS alerts)',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );

  tray.on('double-click', () => showMainWindow());
  // Windows: single click opens
  if (process.platform === 'win32') {
    tray.on('click', () => showMainWindow());
  }
}

function enableGeolocationPermissions() {
  const allowGeo = (permission) => permission === 'geolocation' || permission === 'location';

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowGeo(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowGeo(permission));
}

/** DevTools / inspector are disabled for all builds, including local development. */
function allowDevTools() {
  return false;
}

/**
 * Minimal app menu — never include View / Toggle Developer Tools / Inspect.
 * Always keep Edit roles (copy/paste/cut/selectAll) so callers can paste into
 * search fields — Windows/Linux ignore Ctrl+C/V without these menu roles.
 * Windows/Linux: menu bar stays hidden via autoHideMenuBar on the BrowserWindow.
 * macOS: app menu + Edit.
 */
function installApplicationMenu() {
  const editMenu = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: app.name || 'Astro CS Panel',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        {
          label: 'File',
          submenu: [
            {
              label: 'New Window',
              accelerator: 'CmdOrCtrl+N',
              click: () => openNewPanelWindow(),
            },
          ],
        },
        editMenu,
      ]),
    );
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+N',
            click: () => openNewPanelWindow(),
          },
        ],
      },
      editMenu,
    ]),
  );
}

function isDevtoolsShortcut(input) {
  const key = String(input.key || '').toLowerCase();
  if (key === 'f12') return true;
  // Ctrl+Shift+I / J / C  or  Cmd+Option+I
  if ((input.control || input.meta) && input.shift && (key === 'i' || key === 'j' || key === 'c')) {
    return true;
  }
  if (input.meta && input.alt && key === 'i') return true;
  return false;
}

const isTrustedPanelOrigin = (rawUrl) =>
  isTrustedOrigin(rawUrl, { allowDevServer: useViteDevServer });

function hardenWebContents(wc) {
  if (!wc || wc.isDestroyed()) return;

  // Keep panel typography independent of OS accessibility / system font scaling.
  try {
    wc.setZoomFactor(1);
    if (typeof wc.setVisualZoomLevelLimits === 'function') {
      wc.setVisualZoomLevelLimits(1, 1);
    }
  } catch {
    // ignore
  }

  wc.on('before-input-event', (event, input) => {
    if (!isDevtoolsShortcut(input)) return;
    if (!allowDevTools()) {
      event.preventDefault();
      return;
    }
    // Explicit toggle — Chromium defaults are unreliable without a View menu role.
    event.preventDefault();
    try {
      if (wc.isDevToolsOpened()) wc.closeDevTools();
      else wc.openDevTools({ mode: 'detach' });
    } catch {
      // ignore
    }
  });

  // Right-click paste/copy in inputs (search filters) — needed when menu bar is hidden.
  wc.on('context-menu', (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const template = [];
    if (params.isEditable) {
      template.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut', enabled: params.editFlags?.canCut !== false },
        { role: 'copy', enabled: params.editFlags?.canCopy !== false },
        { role: 'paste', enabled: params.editFlags?.canPaste !== false },
        { role: 'selectAll', enabled: params.editFlags?.canSelectAll !== false },
      );
    } else if (params.selectionText) {
      template.push({ role: 'copy' });
    }
    if (!template.length) return;
    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(wc) || undefined,
    });
  });

  wc.on('devtools-opened', () => {
    if (!allowDevTools()) {
      try {
        wc.closeDevTools();
      } catch {
        // ignore
      }
    }
  });

  // Block cleartext HTTP navigations (Vite localhost still allowed in dev).
  wc.on('will-navigate', (event, url) => {
    // Site BrowserViews have their own strict astrotalk.vip navigation policy.
    if (panelWindows.getPanelBySiteContents(wc)) return;
    const navigationAction = getPanelNavigationAction(url, {
      allowDevServer: useViteDevServer,
      isDeepLink: deepLink.parseDeepLink,
    });
    if (navigationAction === 'deep-link') {
      event.preventDefault();
      handleDeepLink(url);
      return;
    }
    if (navigationAction === 'block') {
      console.warn('[origin-lock] blocked panel navigation:', url);
      event.preventDefault();
      return;
    }
    if (isBlockedCleartext(url, { allowLocalHttp: true })) {
      console.warn('[https-only] blocked navigation:', url);
      event.preventDefault();
    }
  });

  wc.on('will-redirect', (event, url) => {
    if (panelWindows.getPanelBySiteContents(wc)) return;
    const navigationAction = getPanelNavigationAction(url, {
      allowDevServer: useViteDevServer,
      isDeepLink: deepLink.parseDeepLink,
    });
    if (navigationAction !== 'allow') {
      console.warn('[origin-lock] blocked panel redirect:', url);
      event.preventDefault();
    }
  });

  wc.setWindowOpenHandler(({ url }) => {
    if (deepLink.parseDeepLink(url)) {
      handleDeepLink(url);
      return { action: 'deny' };
    }
    if (isBlockedCleartext(url, { allowLocalHttp: true })) {
      console.warn('[https-only] blocked window.open:', url);
      return { action: 'deny' };
    }
    // Never spawn unmanaged Chromium windows — use File → New Window / tray.
    return { action: 'deny' };
  });
}

function preferredBrowserBounds() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  return {
    sw,
    sh,
    width: Math.min(Math.max(1100, Math.round(sw * 0.92)), sw),
    height: Math.min(Math.max(700, Math.round(sh * 0.92)), sh),
  };
}

function createWindow(opts = {}) {
  const skipSite = Boolean(opts.skipSite);
  // First paint must already be landscape — starting at portrait (390×720) then
  // jumping to maximized caused several black flashes on Windows startup.
  const bounds = preferredBrowserBounds();
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    show: false,
    resizable: true,
    maximizable: true,
    title: 'Astro CS Panel',
    icon: iconPath(),
    backgroundColor: '#1c1c1e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Persist SkyTalk (and panel) session cookies across restarts.
      partition: PANEL_PARTITION,
      // Never ship Inspect Element / DevTools to end users.
      devTools: allowDevTools(),
    },
  });

  const rec = panelWindows.registerPanel(win);
  win.setMenuBarVisibility(false);
  hardenWebContents(win.webContents);

  // Cascade extra windows so they are not fully stacked.
  const existing = panelWindows.listPanels().filter((r) => r.win.id !== win.id);
  if (existing.length > 0) {
    try {
      const [x, y] = existing[existing.length - 1].win.getPosition();
      win.setPosition(x + 28, y + 28);
    } catch {
      // ignore
    }
  } else {
    // Primary window: size once while hidden, then show maximized (one paint).
    try {
      applyBrowserSize(rec, { force: true });
    } catch {
      // ignore
    }
  }

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return;
    try {
      if (panelWindows.panelCount() <= 1 && !win.isMaximized()) win.maximize();
    } catch {
      // ignore
    }
    win.show();
  });

  win.on('resize', () => {
    ctx.layoutSiteView(rec);
  });

  // Last panel window: close (X) hides to tray so SOS keeps monitoring.
  // Extra windows: close for real (same security stack per window).
  win.on('close', (event) => {
    if (isQuitting) return;
    const others = panelWindows.listPanels().filter((r) => r.win.id !== win.id);
    if (others.length === 0) {
      event.preventDefault();
      hideWindowToTray(win);
    }
  });

  win.on('closed', () => {
    ctx.destroySiteView(rec);
    panelWindows.unregisterPanel(win);
  });

  const entryHash = skipSite ? '#entry=panel' : '';
  if (useViteDevServer) {
    win.loadURL(`http://127.0.0.1:5173/${entryHash}`);
    return win;
  }

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(
      'Missing dist/index.html. Run `npm run build` first, or use `npm run dev` for hot reload.',
    );
    return win;
  }

  win.loadURL(`app://localhost/index.html${entryHash}`);
  return win;
}

/** Compact portrait window — Login */
function applyPortraitSize(rec) {
  const win = rec?.win;
  if (!win || win.isDestroyed()) return;
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();
  win.setResizable(true);
  win.setMaximizable(false);
  win.setMinimumSize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
  win.setSize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
  win.center();
  win.setResizable(false);
}

/**
 * Chrome-like landscape browser window — site + admin panel.
 * Idempotent: repeated showSite / welcome calls must not re-animate the window
 * (that was the main cause of black flashes on initial load).
 */
function applyBrowserSize(rec, opts = {}) {
  const win = rec?.win;
  if (!win || win.isDestroyed()) return;
  if (win.isFullScreen()) win.setFullScreen(false);

  const force = Boolean(opts.force);
  const primary = panelWindows.panelCount() <= 1;
  win.setResizable(true);
  win.setMaximizable(true);

  const { sw, sh, width: browserW, height: browserH } = preferredBrowserBounds();
  win.setMinimumSize(Math.min(1024, sw), Math.min(640, sh));

  // Already in the final primary state — do nothing (avoids black flashes).
  if (!force && primary && win.isMaximized()) return;

  if (primary) {
    // Set restore size only when not maximized yet; maximize once.
    if (!win.isMaximized()) {
      win.setSize(browserW, browserH);
      win.center();
      win.maximize();
    }
    return;
  }

  // Extra windows: keep cascaded restored size (no maximize).
  const [cw, ch] = win.getSize();
  if (force || Math.abs(cw - browserW) > 8 || Math.abs(ch - browserH) > 8) {
    win.setSize(browserW, browserH);
  }
}

function sendToRenderer(channel, payload) {
  panelWindows.broadcastToPanels(channel, payload);
}

function resolvePanelFromEvent(event) {
  return (
    panelWindows.getPanelByWebContents(event?.sender) ||
    panelWindows.getPanelBySiteContents(event?.sender)
  );
}

function setDockIcon() {
  // macOS ignores the BrowserWindow `icon` option; in dev the generic
  // Electron binary supplies the dock icon, so set it explicitly.
  if (process.platform !== 'darwin' || !app.dock) return;
  try {
    if (fs.existsSync(iconPath())) app.dock.setIcon(iconPath());
  } catch (err) {
    console.warn('Could not set dock icon:', err.message);
  }
}

// Wire shared ctx for extracted modules (call-time resolution).
ctx.gotSingleInstanceLock = gotSingleInstanceLock;
ctx.allowDevTools = allowDevTools;
ctx.isTrustedPanelOrigin = isTrustedPanelOrigin;
ctx.hardenWebContents = hardenWebContents;
ctx.applyPortraitSize = applyPortraitSize;
ctx.applyBrowserSize = applyBrowserSize;
ctx.focusWindow = focusWindow;
ctx.handleDeepLink = handleDeepLink;
ctx.consumePendingDeepLink = consumePendingDeepLink;
ctx.openNewPanelWindow = openNewPanelWindow;
ctx.loadPersistedToken = loadPersistedToken;
ctx.persistToken = persistToken;
ctx.sendToRenderer = sendToRenderer;
ctx.resolvePanelFromEvent = resolvePanelFromEvent;
ctx.createWindow = createWindow;
ctx.showMainWindow = showMainWindow;
Object.defineProperty(ctx, 'isQuitting', {
  get: () => isQuitting,
  set: (v) => {
    isQuitting = Boolean(v);
  },
});
Object.defineProperty(ctx, 'trayHintShown', {
  get: () => trayHintShown,
  set: (v) => {
    trayHintShown = Boolean(v);
  },
});
Object.defineProperty(ctx, 'cachedAuthToken', {
  get: () => cachedAuthToken,
  set: (v) => {
    cachedAuthToken = v;
  },
});
Object.defineProperty(ctx, 'sosMonitor', {
  get: () => sosMonitor,
  set: (v) => {
    sosMonitor = v;
  },
});
Object.defineProperty(ctx, 'pushClient', {
  get: () => pushClient,
  set: (v) => {
    pushClient = v;
  },
});
Object.defineProperty(ctx, 'blockSiteForUpdate', {
  get: () => blockSiteForUpdate,
  set: (v) => {
    blockSiteForUpdate = Boolean(v);
  },
});
Object.defineProperty(ctx, 'lastUpdateEvent', {
  get: () => lastUpdateEvent,
  set: (v) => {
    lastUpdateEvent = v;
  },
});

let blockSiteForUpdate = false;
let lastUpdateEvent = null;

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  // Required on Windows so sticky SOS toasts are attributed to this app.
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.yourcompany.astro');
  }

  ctx.loadPersistedSiteIdentity();

  // Start Google FCM register as early as possible so Astro LOGIN rarely waits.
  try {
    const fcmToken = require('./fcmToken.cjs');
    fcmToken.warmFcmToken();
  } catch (err) {
    console.warn('[fcm] warm at ready failed:', err?.message || err);
  }

  installApplicationMenu();

  // Block DevTools / inspector on every WebContents (main + BrowserView + alerts).
  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });

  // Keep SOS alive after reboot / when user "closes" the window (tray mode).
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  } catch (err) {
    console.warn('setLoginItemSettings failed:', err?.message || err);
  }

  deepLink.registerProtocolClient();
  ctx.registerAppProtocol();
  setDockIcon();
  enableGeolocationPermissions();
  // Reject cleartext HTTP for Chromium network (Vite localhost still allowed).
  enforceSessionHttpsOnly(session.defaultSession);
  enforceSessionHttpsOnly(session.fromPartition(PANEL_PARTITION));
  createTray();

  // Cold-start deep link from argv (Windows / Linux).
  const argvDeepLink = deepLink.findDeepLinkInArgv(process.argv);
  if (argvDeepLink) {
    const parsed = deepLink.parseDeepLink(argvDeepLink);
    if (parsed) deepLink.setPending(parsed);
  }

  const firstWin = createWindow();

  // Launched at login / as hidden — stay in tray for SOS only.
  const loginSettings =
    typeof app.getLoginItemSettings === 'function' ? app.getLoginItemSettings() : {};
  const startHidden =
    Boolean(loginSettings.wasOpenedAsHidden) ||
    process.argv.includes('--hidden') ||
    process.argv.includes('--as-hidden');
  if (startHidden && firstWin && !firstWin.isDestroyed() && !deepLink.peekPending()) {
    firstWin.hide();
  }

  ctx.registerIpc();
  ctx.setupAutoUpdate();

  // Resume SOS polling with last login token (works while window is hidden).
  cachedAuthToken = loadPersistedToken();

  sosMonitor = startSosMonitor({
    getMainWindow: () => panelWindows.getPrimaryWindow(),
    broadcastSosState: (payload) => panelWindows.broadcastToPanels('sos:state', payload),
    showAllPanelWindows: () => {
      for (const { win } of panelWindows.listPanels()) {
        focusWindow(win);
      }
    },
    getToken: () => cachedAuthToken,
    getUserDataPath: () => app.getPath('userData'),
    // When ntfy is on, idle API poll is only a backup (activate/clear arrive via push).
    pushEnabled: Boolean(require('./config.cjs').getSosPushTopic()),
  });

  // Cross-device SOS push (ntfy). Requires SOS_PUSH_TOPIC in .env.
  pushClient = startPushClient({
    onSosActivated: (meta) => sosMonitor?.forceActive?.(meta || {}),
    onSosCleared: () => sosMonitor?.forceClear?.(),
  });

  // Firebase Cloud Messaging — OS notifications + in-app toasts for all pushes.
  try {
    const { startFcmListener } = require('./fcmListener.cjs');
    fcmListener = startFcmListener({
      broadcastToPanels: (channel, payload) => panelWindows.broadcastToPanels(channel, payload),
      showMainWindow: () => showMainWindow(),
      getSosMonitor: () => sosMonitor,
    });
  } catch (err) {
    console.warn('[fcm-listen] init failed:', err?.message || err);
  }

  // Warn early (non-blocking) if the API's live cert no longer matches our pins.
  require('./certPin.cjs').startupPinHealthCheck();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  try {
    fcmListener?.stop?.();
  } catch {
    // ignore
  }
});

// Never quit when the last window is hidden — tray keeps SOS monitoring.
app.on('window-all-closed', () => {
  // no-op
});
