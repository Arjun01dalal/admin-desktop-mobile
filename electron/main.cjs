const { app, BrowserWindow, ipcMain, session, protocol, net, shell, screen, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { autoUpdater } = require('electron-updater');
const { useViteDevServer } = require('./config.cjs');
const auth = require('./auth.cjs');
const secureApi = require('./secure/index.cjs');

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

// Portrait phone-like window for Calculator + Login
const PORTRAIT_WIDTH = 390;
const PORTRAIT_HEIGHT = 720;

const DIST_DIR = path.join(__dirname, '..', 'dist');

let win = null;

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
    title: 'Astro Admin Panel',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.setMenuBarVisibility(false);

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

/** Compact portrait window — Calculator & Login */
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

function applyCalculatorSize() {
  applyPortraitSize();
}

function applyLoginSize() {
  applyPortraitSize();
}

/** Chrome-like landscape browser window — after successful login */
function applyWelcomeSize() {
  if (!win) return;
  if (win.isFullScreen()) win.setFullScreen(false);

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  // Typical Chrome desktop window: large landscape, ~92% of work area (capped)
  const browserW = Math.max(1100, Math.min(Math.round(sw * 0.92), 1600));
  const browserH = Math.max(700, Math.min(Math.round(sh * 0.92), 1000));

  win.setResizable(true);
  win.setMaximizable(true);
  win.setMinimumSize(1024, 640);
  win.setSize(browserW, browserH);
  win.center();
}

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('update:available', { version: info.version });
  });
  autoUpdater.on('download-progress', (p) => {
    sendToRenderer('update:progress', { percent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('update:ready', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    sendToRenderer('update:error', {
      message: String(err?.message || err),
    });
  });

  autoUpdater.checkForUpdates().catch(() => {});
}

function registerIpc() {
  ipcMain.on('gcalc:show-calculator', applyCalculatorSize);
  ipcMain.on('gcalc:show-login', applyLoginSize);
  ipcMain.on('gcalc:show-welcome', applyWelcomeSize);

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
    return secureApi.execute(action, payload || {}, token || null);
  });

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall();
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  enableGeolocationPermissions();
  createWindow();
  registerIpc();
  setupAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
