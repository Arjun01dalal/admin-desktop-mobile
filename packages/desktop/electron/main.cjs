const { app, BrowserWindow, BrowserView, ipcMain, session, protocol, net, shell, screen, clipboard, dialog, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const { useViteDevServer, getGhUpdateToken } = require('./config.cjs');
const { enforceSessionHttpsOnly, isBlockedCleartext } = require('./httpsOnly.cjs');
const { installMainErrorMonitor, report: reportError } = require('./errorMonitor.cjs');
const tokenVault = require('./tokenVault.cjs');
const auth = require('./auth.cjs');
const secureApi = require('./secure/index.cjs');
const { startSosMonitor } = require('./sosMonitor.cjs');
const { startPushClient } = require('./pushService.cjs');

installMainErrorMonitor();


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
    },
  },
]);

// Portrait phone-like window for Login
const PORTRAIT_WIDTH = 390;
const PORTRAIT_HEIGHT = 720;

const ASTRO_SITE_URL = 'https://astrotalk.vip/';
/** Bottom strip of the main window for the panel Login button (under BrowserView). */
const SITE_LOGIN_BAR_HEIGHT = 56;

const DIST_DIR = path.join(__dirname, '..', 'dist');

let win = null;
let siteView = null;
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

function tokenStorePath() {
  return path.join(app.getPath('userData'), 'session.token');
}

function loadPersistedToken() {
  return tokenVault.readToken();
}

function persistToken(token) {
  try {
    tokenVault.writeToken(token || '');
  } catch (err) {
    console.warn('[token] could not persist token:', err?.message || err);
    reportError('main:persistToken', err);
  }
}

function iconPath() {
  return path.join(__dirname, '..', 'build', 'icon.png');
}

function showMainWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
  }
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

function hideMainWindowToTray() {
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

function registerAppProtocol() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname);
    if (!rel || rel === '/') rel = '/index.html';

    const fullPath = path.normalize(path.join(DIST_DIR, rel));
    if (!fullPath.startsWith(DIST_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      return new Response('Not found', { status: 404 });
    }

    return net.fetch(pathToFileURL(fullPath).toString());
  });
}

function enableGeolocationPermissions() {
  const allowGeo = (permission) =>
    permission === 'geolocation' || permission === 'location';

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowGeo(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowGeo(permission));
}

/** Packaged builds: no DevTools / inspector for end users. */
function allowDevTools() {
  return Boolean(useViteDevServer) && !app.isPackaged;
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
        editMenu,
      ]),
    );
    return;
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate([editMenu]));
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

function hardenWebContents(wc) {
  if (!wc || wc.isDestroyed()) return;

  wc.on('before-input-event', (event, input) => {
    if (!allowDevTools() && isDevtoolsShortcut(input)) {
      event.preventDefault();
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
    Menu.buildFromTemplate(template).popup({ window: BrowserWindow.fromWebContents(wc) || undefined });
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
    if (isBlockedCleartext(url, { allowLocalHttp: true })) {
      console.warn('[https-only] blocked navigation:', url);
      event.preventDefault();
    }
  });

  wc.setWindowOpenHandler(({ url }) => {
    if (isBlockedCleartext(url, { allowLocalHttp: true })) {
      console.warn('[https-only] blocked window.open:', url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_HEIGHT,
    resizable: false,
    maximizable: false,
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
      // Never ship Inspect Element / DevTools to end users.
      devTools: allowDevTools(),
    },
  });

  win.setMenuBarVisibility(false);
  hardenWebContents(win.webContents);

  win.on('resize', () => {
    layoutSiteView();
  });

  // Close (X) hides to tray — SOS keeps monitoring. Use tray → Quit to exit.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hideMainWindowToTray();
    }
  });

  win.on('closed', () => {
    destroySiteView();
    win = null;
  });

  if (useViteDevServer) {
    win.loadURL('http://127.0.0.1:5173');
    return;
  }

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.error(
      'Missing dist/index.html. Run `npm run build` first, or use `npm run dev` for hot reload.',
    );
    return;
  }

  win.loadURL('app://localhost/index.html');
}

/** Compact portrait window — Login */
function applyPortraitSize() {
  if (!win) return;
  if (win.isFullScreen()) win.setFullScreen(false);
  if (win.isMaximized()) win.unmaximize();
  win.setResizable(true);
  win.setMaximizable(false);
  win.setMinimumSize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
  win.setSize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT);
  win.center();
  win.setResizable(false);
}

function applyLoginSize() {
  hideSiteView();
  applyPortraitSize();
}

/** Chrome-like landscape browser window — site + admin panel */
function applyBrowserSize() {
  if (!win) return;
  if (win.isFullScreen()) win.setFullScreen(false);

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const browserW = Math.max(1100, Math.min(Math.round(sw * 0.92), 1600));
  const browserH = Math.max(700, Math.min(Math.round(sh * 0.92), 1000));

  win.setResizable(true);
  win.setMaximizable(true);
  win.setMinimumSize(1024, 640);
  win.setSize(browserW, browserH);
  win.center();
}

function applyWelcomeSize() {
  hideSiteView();
  applyBrowserSize();
}

function applySiteSize() {
  applyBrowserSize();
  showSiteView();
}

function layoutSiteView() {
  if (!win || !siteView || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const bar = SITE_LOGIN_BAR_HEIGHT;
  siteView.setBounds({
    x: 0,
    y: 0,
    width,
    height: Math.max(0, height - bar),
  });
  siteView.setAutoResize({ width: true, height: false });
}

function destroySiteView() {
  if (!win || !siteView) {
    siteView = null;
    return;
  }
  try {
    win.removeBrowserView(siteView);
  } catch {
    // ignore
  }
  try {
    if (!siteView.webContents.isDestroyed()) {
      siteView.webContents.destroy();
    }
  } catch {
    // ignore
  }
  siteView = null;
}

/** When true, site BrowserView must stay hidden so update dialogs are visible. */
let blockSiteForUpdate = false;

function hideSiteView() {
  if (!win || !siteView) return;
  try {
    win.removeBrowserView(siteView);
  } catch {
    // ignore
  }
}

function showSiteView() {
  if (!win || win.isDestroyed()) return;
  // BrowserView sits above the React UI and also above modal dialogs attached
  // to the window — never re-show it while an update prompt is active.
  if (blockSiteForUpdate) return;

  if (!siteView || siteView.webContents.isDestroyed()) {
    siteView = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, 'sitePreload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        // Preload must reliably access ipcRenderer for panel gate.
        sandbox: false,
        webSecurity: true,
        devTools: allowDevTools(),
      },
    });

    hardenWebContents(siteView.webContents);
    siteView.webContents.setWindowOpenHandler(() => {
      // No popups — panel login is gated by site password in sitePreload.
      return { action: 'deny' };
    });

    // SPA navigations: ensure preload listeners stay (preload reloads with page).
    siteView.webContents.on('dom-ready', () => {
      console.log('[site] dom-ready — panel gate preload active');
    });

    siteView.webContents.on('will-navigate', (event, url) => {
      try {
        if (isBlockedCleartext(url, { allowLocalHttp: false })) {
          event.preventDefault();
          return;
        }
        const target = new URL(url);
        const home = new URL(ASTRO_SITE_URL);
        // Keep browsing on the marketing site; off-origin stays blocked.
        if (target.origin !== home.origin) {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });

    siteView.webContents.loadURL(ASTRO_SITE_URL);
  }

  win.setBrowserView(siteView);
  layoutSiteView();
}

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/** Last update event — replayed when renderer mounts (avoids missed IPC under site view). */
let lastUpdateEvent = null;

function prepareUpdateUi() {
  blockSiteForUpdate = true;
  try {
    hideSiteView();
  } catch {
    // ignore
  }
  if (win && !win.isDestroyed()) {
    try {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (typeof win.moveTop === 'function') win.moveTop();
    } catch {
      // ignore
    }
  }
}

function publishUpdate(channel, payload) {
  lastUpdateEvent = { channel, payload, at: Date.now() };
  prepareUpdateUi();
  sendToRenderer(channel, payload);
}

/**
 * Use an app-modal dialog (no parent window). Parenting to `win` while a
 * BrowserView is/was attached often puts the box behind the site on Windows.
 */
async function showUpdateDialog(options) {
  prepareUpdateUi();
  return dialog.showMessageBox(options);
}

function setupAutoUpdate() {
  if (!app.isPackaged) {
    console.log('autoUpdater: skipped (dev / unpackaged)');
    return;
  }

  // Prefer baked app-update.yml (always present in NSIS/dmg). package.json
  // `build` is stripped from the packaged asar, so do not require it.
  // Only call setFeedURL when a private-repo token is available.
  const updateToken =
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    getGhUpdateToken() ||
    '';
  if (updateToken) {
    try {
      const ymlPath = path.join(process.resourcesPath, 'app-update.yml');
      const yml = fs.existsSync(ymlPath)
        ? fs.readFileSync(ymlPath, 'utf8')
        : '';
      const owner = (yml.match(/^owner:\s*(.+)$/m) || [])[1]?.trim();
      const repo = (yml.match(/^repo:\s*(.+)$/m) || [])[1]?.trim();
      if (owner && repo) {
        autoUpdater.setFeedURL({
          provider: 'github',
          owner,
          repo,
          private: true,
          token: updateToken,
        });
      }
    } catch (err) {
      console.warn('autoUpdater setFeedURL skipped:', err?.message || err);
    }
  }

  autoUpdater.logger = {
    info: (...a) => console.log('[autoUpdater]', ...a),
    warn: (...a) => console.warn('[autoUpdater]', ...a),
    error: (...a) => console.error('[autoUpdater]', ...a),
    debug: (...a) => console.log('[autoUpdater:debug]', ...a),
  };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  let availableDialogShown = false;
  let readyDialogShown = false;
  let errorDialogShown = false;

  autoUpdater.on('checking-for-update', () => {
    console.log(
      'autoUpdater: checking for update… current=',
      app.getVersion(),
      'platform=',
      process.platform,
    );
  });
  autoUpdater.on('update-not-available', (info) => {
    console.log('autoUpdater: up to date', info?.version || app.getVersion());
  });
  autoUpdater.on('update-available', (info) => {
    console.log('autoUpdater: update available', info.version);
    publishUpdate('update:available', { version: info.version });
    // Show immediately — do not wait for the ~100MB+ download to finish.
    if (!availableDialogShown) {
      availableDialogShown = true;
      void showUpdateDialog({
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available.`,
        detail:
          'Downloading in the background. You will be asked to restart when it is ready (~1–3 minutes on typical connections).',
        buttons: ['OK'],
        noLink: true,
      }).catch((err) =>
        console.warn('autoUpdater available dialog failed:', err?.message || err),
      );
    }
  });
  autoUpdater.on('download-progress', (p) => {
    publishUpdate('update:progress', { percent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    console.log('autoUpdater: downloaded', info.version);
    publishUpdate('update:ready', { version: info.version });
    if (readyDialogShown) return;
    readyDialogShown = true;
    try {
      const result = await showUpdateDialog({
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} is ready to install.`,
        detail: 'Restart now to update, or choose Later.',
        buttons: ['Restart & Update', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      } else {
        // User deferred install — allow site view again; React toast still available.
        blockSiteForUpdate = false;
      }
    } catch (err) {
      console.warn('autoUpdater ready dialog failed:', err?.message || err);
      blockSiteForUpdate = false;
    }
  });
  autoUpdater.on('error', (err) => {
    const message = err?.message || String(err);
    console.warn('autoUpdater error:', message);
    const hint = /404|Not Found|Cannot find channel|latest-mac/i.test(message)
      ? ' Update feed not reachable for this platform. Windows needs latest.yml; Mac needs latest-mac.yml + .zip on the public GitHub release.'
      : '';
    const full = message + hint;
    publishUpdate('update:error', { message: full });
    if (!errorDialogShown) {
      errorDialogShown = true;
      void showUpdateDialog({
        type: 'error',
        title: 'Update Check Failed',
        message: full,
        buttons: ['OK'],
        noLink: true,
      })
        .catch(() => {})
        .finally(() => {
          blockSiteForUpdate = false;
        });
    }
  });

  let lastCheckAt = 0;
  const MIN_CHECK_GAP_MS = 10 * 60 * 1000; // don't hammer GitHub

  const runCheck = (force = false) => {
    // Don't re-check while a ready dialog is already up / install pending.
    if (readyDialogShown) return;
    const now = Date.now();
    if (!force && now - lastCheckAt < MIN_CHECK_GAP_MS) return;
    lastCheckAt = now;
    autoUpdater.checkForUpdates().catch((err) => {
      const message = err?.message || String(err);
      console.warn('autoUpdater checkForUpdates failed:', message);
      publishUpdate('update:error', { message });
    });
  };

  // Startup: wait for renderer, then check (+ one quick retry).
  setTimeout(() => runCheck(true), 3000);
  setTimeout(() => runCheck(true), 15000);
  // Keep checking while the app stays open (so a new release is noticed
  // without requiring a manual restart first). Install still needs restart.
  const PERIODIC_MS = 30 * 60 * 1000; // 30 minutes
  setInterval(() => runCheck(true), PERIODIC_MS);

  app.on('browser-window-focus', () => {
    if (readyDialogShown || availableDialogShown) return;
    runCheck(false); // throttled
  });
}

function registerIpc() {
  // Legacy calculator channel now opens the ThirdEye marketing site.
  ipcMain.on('gcalc:show-calculator', applySiteSize);
  ipcMain.on('gcalc:show-site', applySiteSize);
  ipcMain.on('gcalc:hide-site', hideSiteView);
  ipcMain.on('gcalc:show-login', applyLoginSize);
  ipcMain.on('gcalc:show-welcome', applyWelcomeSize);

  ipcMain.on('astro:panel-gate', (_event, payload = {}) => {
    const ok = Boolean(payload && payload.ok);
    sendToRenderer('astro:panel-gate', { ok });
  });

  ipcMain.on('astro:request-login', () => {
    const sosOn = Boolean(
      sosMonitor && typeof sosMonitor.isActive === 'function' && sosMonitor.isActive(),
    );
    if (sosOn) {
      console.log('[site] panel login blocked — SOS active');
      sendToRenderer('astro:login-blocked-sos');
      return;
    }
    console.log('[site] panel login requested (gate password)');
    hideSiteView();
    sendToRenderer('astro:request-login');
  });

  ipcMain.handle('auth:send-otp', async (_event, payload) => {
    try {
      return await auth.sendOtp(payload);
    } catch (error) {
      return {
        ok: false,
        message: error?.response?.data?.message || error?.message || 'Failed to send OTP',
      };
    }
  });

  ipcMain.handle('auth:verify-otp', async (_event, payload) => {
    try {
      return await auth.verifyOtp(payload);
    } catch (error) {
      return {
        ok: false,
        message: error?.response?.data?.message || error?.message || 'Invalid OTP',
      };
    }
  });

  ipcMain.handle('auth:get-address', async (_event, payload) => {
    try {
      const address = await auth.getAddress(payload);
      return { ok: true, address };
    } catch (error) {
      return {
        ok: false,
        message: error?.response?.data?.message || error?.message || 'Address lookup failed',
        address: {},
      };
    }
  });

  ipcMain.handle('auth:get-ip-location', async () => {
    try {
      const location = await auth.getIpLocation();
      return { ok: true, ...location };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || 'IP location lookup failed',
      };
    }
  });

  ipcMain.handle('gcalc:open-location-settings', async () => {
    if (process.platform === 'darwin') {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices',
      );
      return { ok: true };
    }
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:privacy-location');
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle('gcalc:copy-text', (_event, text) => {
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  });

  ipcMain.handle('auth:get-session-token', async () => ({
    ok: true,
    token: cachedAuthToken || loadPersistedToken() || null,
    encrypted: tokenVault.encryptAvailable(),
  }));

  ipcMain.handle('auth:set-session-token', async (_event, token) => {
    const value = typeof token === 'string' ? token.trim() : '';
    cachedAuthToken = value || null;
    persistToken(cachedAuthToken);
    if (cachedAuthToken) sosMonitor?.refresh?.();
    return { ok: true, encrypted: tokenVault.encryptAvailable() };
  });

  ipcMain.handle('auth:clear-session-token', async () => {
    cachedAuthToken = null;
    persistToken('');
    return { ok: true };
  });

  ipcMain.handle('error:report', async (_event, payload = {}) => {
    reportError(
      String(payload.source || 'renderer'),
      {
        message: String(payload.message || 'Renderer error'),
        name: payload.name,
        stack: payload.stack,
      },
      {
        url: payload.url ? String(payload.url).slice(0, 500) : undefined,
      },
    );
    return { ok: true };
  });

  // Named secure API — paths + encryption stay in main process
  const secureRate = new Map(); // webContentsId -> timestamps
  ipcMain.handle('secure:api', async (event, args) => {
    // Accept IPC from any BrowserWindow we own (not only the cached `win` ref).
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || event.sender.isDestroyed()) {
      return { ok: false, message: 'Unauthorized bridge sender' };
    }

    const wcId = event.sender.id;
    const now = Date.now();
    const windowMs = 10_000;
    const maxCalls = 300;
    const recent = (secureRate.get(wcId) || []).filter((t) => now - t < windowMs);
    if (recent.length >= maxCalls) {
      return { ok: false, message: 'Rate limit exceeded' };
    }
    recent.push(now);
    secureRate.set(wcId, recent);

    const action = args?.action;
    const payload = args?.payload;
    const token = args?.token;
    if (!action || typeof action !== 'string') {
      return { ok: false, message: 'Invalid action' };
    }
    if (typeof token === 'string' && token.trim()) {
      cachedAuthToken = token.trim();
      persistToken(cachedAuthToken);
      // First token of the session — start polling SOS immediately.
      sosMonitor?.refresh?.();
    }
    return secureApi.execute(action, payload || {}, token || null);
  });

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('update:get-status', async () => lastUpdateEvent);

  ipcMain.handle('sos:get-state', async () => ({
    active: Boolean(sosMonitor && typeof sosMonitor.isActive === 'function'
      ? sosMonitor.isActive()
      : false),
  }));

  // Broadcast SOS to other devices via push topic (ntfy).
  // Local siren/popup is handled by sosMonitor (may suppress originator / same office).
  ipcMain.on('sos:activated', (_event, meta = {}) => {
    void pushClient?.publishSos?.(meta && typeof meta === 'object' ? meta : {});
  });
  ipcMain.on('sos:cleared', () => {
    void pushClient?.publishClear?.();
  });
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

app.whenReady().then(() => {
  // Required on Windows so sticky SOS toasts are attributed to this app.
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.yourcompany.astro');
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

  registerAppProtocol();
  setDockIcon();
  enableGeolocationPermissions();
  // Reject cleartext HTTP for Chromium network (Vite localhost still allowed).
  enforceSessionHttpsOnly(session.defaultSession);
  createTray();
  createWindow();

  // Launched at login / as hidden — stay in tray for SOS only.
  const loginSettings =
    typeof app.getLoginItemSettings === 'function'
      ? app.getLoginItemSettings()
      : {};
  const startHidden =
    Boolean(loginSettings.wasOpenedAsHidden) ||
    process.argv.includes('--hidden') ||
    process.argv.includes('--as-hidden');
  if (startHidden && win && !win.isDestroyed()) {
    win.hide();
  }

  registerIpc();
  setupAutoUpdate();

  // Resume SOS polling with last login token (works while window is hidden).
  cachedAuthToken = loadPersistedToken();

  sosMonitor = startSosMonitor({
    getMainWindow: () => win,
    getToken: () => cachedAuthToken,
    getUserDataPath: () => app.getPath('userData'),
  });

  // Cross-device SOS push (ntfy). Requires SOS_PUSH_TOPIC in .env.
  pushClient = startPushClient({
    onSosActivated: (meta) => sosMonitor?.forceActive?.(meta || {}),
    onSosCleared: () => sosMonitor?.forceClear?.(),
  });

  // Warn early (non-blocking) if the API's live cert no longer matches our pins.
  require('./certPin.cjs').startupPinHealthCheck();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Never quit when the last window is hidden — tray keeps SOS monitoring.
app.on('window-all-closed', () => {
  // no-op
});
