const { app, BrowserWindow, BrowserView, ipcMain, session, protocol, net, shell, screen, clipboard, dialog, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const { useViteDevServer, getGhUpdateToken } = require('./config.cjs');
const auth = require('./auth.cjs');
const secureApi = require('./secure/index.cjs');
const { startSosMonitor } = require('./sosMonitor.cjs');
const { startPushClient } = require('./pushService.cjs');

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

const ASTRO_SITE_URL = 'https://admin.astrothirdeye.com/';
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
  return path.join(app.getPath('userData'), 'sos-session.token');
}

function loadPersistedToken() {
  try {
    const p = tokenStorePath();
    if (!fs.existsSync(p)) return null;
    const value = fs.readFileSync(p, 'utf8').trim();
    return value || null;
  } catch {
    return null;
  }
}

function persistToken(token) {
  try {
    if (!token) {
      fs.rmSync(tokenStorePath(), { force: true });
      return;
    }
    fs.writeFileSync(tokenStorePath(), token, 'utf8');
  } catch (err) {
    console.warn('[sos] could not persist token:', err?.message || err);
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

function createWindow() {
  win = new BrowserWindow({
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_HEIGHT,
    resizable: false,
    maximizable: false,
    title: 'Astro CS Panel',
    icon: iconPath(),
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Block DevTools in packaged builds so users can't inspect the renderer.
      devTools: !app.isPackaged,
    },
  });

  win.setMenuBarVisibility(false);

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
        sandbox: true,
        webSecurity: true,
      },
    });

    siteView.webContents.setWindowOpenHandler(() => {
      // Block popups — let the renderer open login or panel.
      hideSiteView();
      sendToRenderer('astro:request-login');
      return { action: 'deny' };
    });

    siteView.webContents.on('will-navigate', (event, url) => {
      try {
        const target = new URL(url);
        const home = new URL(ASTRO_SITE_URL);
        // Keep browsing on the marketing site; anything else → login/panel gate.
        if (target.origin !== home.origin) {
          event.preventDefault();
          hideSiteView();
          sendToRenderer('astro:request-login');
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

  const runCheck = () => {
    autoUpdater.checkForUpdates().catch((err) => {
      const message = err?.message || String(err);
      console.warn('autoUpdater checkForUpdates failed:', message);
      publishUpdate('update:error', { message });
    });
  };

  // Wait for renderer listeners, then check (and retry once).
  setTimeout(runCheck, 3000);
  setTimeout(runCheck, 15000);
}

function registerIpc() {
  // Legacy calculator channel now opens the ThirdEye marketing site.
  ipcMain.on('gcalc:show-calculator', applySiteSize);
  ipcMain.on('gcalc:show-site', applySiteSize);
  ipcMain.on('gcalc:hide-site', hideSiteView);
  ipcMain.on('gcalc:show-login', applyLoginSize);
  ipcMain.on('gcalc:show-welcome', applyWelcomeSize);

  ipcMain.on('astro:request-login', () => {
    // Only hide the site — renderer decides login vs panel based on token.
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

  // Broadcast SOS to other devices via push topic (ntfy).
  ipcMain.on('sos:activated', () => {
    void pushClient?.publishSos?.();
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
  });

  // Cross-device SOS push (ntfy). Requires SOS_PUSH_TOPIC in .env.
  pushClient = startPushClient({
    onSosActivated: () => sosMonitor?.forceActive?.(),
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
