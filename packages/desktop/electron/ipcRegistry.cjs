const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');
const auth = require('./auth.cjs');
const siteAuth = require('./siteAuth.cjs');
const fcmToken = require('./fcmToken.cjs');
const secureApi = require('./secure/index.cjs');
const tokenVault = require('./tokenVault.cjs');
const panelWindows = require('./panelWindows.cjs');
const { report: reportError } = require('./errorMonitor.cjs');
const ctx = require('./ctx.cjs');

function formatAuthNetworkError(error, fallback) {
  const apiMessage = error?.response?.data?.message;
  if (apiMessage) return String(apiMessage);

  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  // Packaged apps often surface raw getaddrinfo ENOTFOUND for a dead/wrong API host.
  if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(msg)) {
    const host =
      error?.hostname ||
      msg.match(/ENOTFOUND\s+(\S+)/i)?.[1] ||
      'API host';
    return `Cannot reach API (${host}). Check API_BASE_URL / DNS, then rebuild with embed:env.`;
  }
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(msg)) {
    return 'API connection refused. Check API_BASE_URL and that the server is up.';
  }
  if (code === 'ETIMEDOUT' || /timeout/i.test(msg)) {
    return 'API request timed out. Check network / VPN.';
  }
  return msg || fallback;
}

function registerIpc() {
  // Legacy calculator channel now opens the ThirdEye marketing site.
  ipcMain.on('gcalc:show-calculator', (event) => {
    ctx.applySiteSize(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:show-site', (event, payload = {}) => {
    ctx.applySiteSize(ctx.resolvePanelFromEvent(event), payload || {});
  });
  ipcMain.on('gcalc:show-native-auth', (event) => {
    ctx.applyNativeAuthSize(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:hide-site', (event) => {
    ctx.hideSiteView(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:show-login', (event) => {
    ctx.applyLoginSize(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:show-welcome', (event) => {
    ctx.applyWelcomeSize(ctx.resolvePanelFromEvent(event));
  });

  ipcMain.handle('app:open-new-window', async () => ctx.openNewPanelWindow());
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('gcalc:get-pending-deep-link', () => ctx.consumePendingDeepLink());

  ipcMain.on('astro:site-identity', (_event, payload = {}) => {
    ctx.rememberSiteIdentity(payload);
  });

  /** Sync — sitePreload must seed #external_login / LOGIN_TOKEN before SPA Splash. */
  ipcMain.on('astro:get-sso-token', (event) => {
    const rec = panelWindows.getPanelBySiteContents(event.sender);
    event.returnValue = rec?._pendingSsoToken ? String(rec._pendingSsoToken) : '';
  });

  ipcMain.on('astro:site-identity-request', (event) => {
    if (!ctx.getCachedSiteIdentity().email && !ctx.getCachedSiteIdentity().mobile) return;
    try {
      event.sender.send('astro:prefill-site', ctx.getCachedSiteIdentity());
    } catch {
      // ignore
    }
  });

  ipcMain.on('astro:panel-gate', (event, payload = {}) => {
    const ok = Boolean(payload && payload.ok);
    const rec = ctx.resolvePanelFromEvent(event);
    if (rec?.win && !rec.win.isDestroyed()) {
      rec.win.webContents.send('astro:panel-gate', { ok });
      return;
    }
    ctx.sendToRenderer('astro:panel-gate', { ok });
  });

  ipcMain.on('astro:request-login', (event, payload = {}) => {
    const identity = ctx.rememberSiteIdentity(payload);
    const sosOn = Boolean(
      ctx.sosMonitor && typeof ctx.sosMonitor.isActive === 'function' && ctx.sosMonitor.isActive(),
    );
    const rec = ctx.resolvePanelFromEvent(event);
    if (sosOn) {
      console.log('[site] panel login blocked — SOS active');
      if (rec?.win && !rec.win.isDestroyed()) {
        rec.win.webContents.send('astro:login-blocked-sos');
      } else {
        ctx.sendToRenderer('astro:login-blocked-sos');
      }
      return;
    }
    console.log('[site] panel login requested (gate password)');
    if (rec) ctx.hideSiteView(rec);
    const loginPayload = {
      email: identity.email || '',
      mobile: identity.mobile || '',
    };
    if (rec?.win && !rec.win.isDestroyed()) {
      rec.win.webContents.send('astro:request-login', loginPayload);
    } else {
      ctx.sendToRenderer('astro:request-login', loginPayload);
    }
  });

  ipcMain.handle('auth:send-otp', async (_event, payload) => {
    try {
      return await auth.sendOtp(payload);
    } catch (error) {
      return {
        ok: false,
        message: formatAuthNetworkError(error, 'Failed to send OTP'),
      };
    }
  });

  ipcMain.handle('auth:verify-otp', async (_event, payload) => {
    try {
      return await auth.verifyOtp(payload);
    } catch (error) {
      return {
        ok: false,
        message: formatAuthNetworkError(error, 'Invalid OTP'),
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

  ipcMain.handle('siteAuth:loginViaPassword', async (_event, payload) => {
    return siteAuth.loginViaPassword(payload || {});
  });
  ipcMain.handle('siteAuth:sendEmailOtp', async (_event, payload) => {
    return siteAuth.sendEmailOtp(payload || {});
  });
  ipcMain.handle('siteAuth:verifyEmailOtp', async (_event, payload) => {
    return siteAuth.verifyEmailOtp(payload || {});
  });
  ipcMain.handle('siteAuth:resetPassword', async (_event, payload) => {
    return siteAuth.resetPassword(payload || {});
  });
  ipcMain.handle('siteAuth:getFcmToken', async (_event, payload = {}) => {
    return fcmToken.getFcmToken(payload || {});
  });
  ipcMain.handle('siteAuth:fetchTerms', async () => {
    return siteAuth.fetchTermsAndConditions();
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

  // Sheet downloads after OTP are async — Chromium blocks <a download> without a
  // user gesture. Write the file from main into the OS Downloads folder instead.
  ipcMain.handle('file:save-download', async (event, args = {}) => {
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (
      !senderWin ||
      event.sender.isDestroyed() ||
      !panelWindows.isPanelWindow(senderWin)
    ) {
      return { ok: false, message: 'Unauthorized bridge sender' };
    }
    const rawName = path.basename(String(args.filename || 'download.xlsx'));
    const safeName =
      rawName.replace(/[^\w.\- ()]+/g, '_').slice(0, 180) || 'download.xlsx';
    const b64 = String(args.base64 || '');
    if (!b64) return { ok: false, message: 'Invalid file data' };
    let buf;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      return { ok: false, message: 'Invalid file data' };
    }
    if (!buf.length) return { ok: false, message: 'Empty file' };
    if (buf.length > 80 * 1024 * 1024) return { ok: false, message: 'File too large' };

    const picked = await dialog.showSaveDialog(senderWin, {
      title: 'Save sheet',
      defaultPath: path.join(app.getPath('downloads'), safeName),
      filters: [
        { name: 'Excel workbook', extensions: ['xlsx'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (picked.canceled || !picked.filePath) {
      return { ok: false, canceled: true, message: 'Save cancelled' };
    }
    try {
      fs.writeFileSync(picked.filePath, buf);
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed to save file' };
    }
    try {
      shell.showItemInFolder(picked.filePath);
    } catch {
      /* ignore */
    }
    return { ok: true, path: picked.filePath };
  });

  ipcMain.handle('auth:get-session-token', async () => ({
    ok: true,
    token: ctx.cachedAuthToken || ctx.loadPersistedToken() || null,
    encrypted: tokenVault.encryptAvailable(),
  }));

  ipcMain.handle('auth:set-session-token', async (_event, token) => {
    const value = typeof token === 'string' ? token.trim() : '';
    ctx.cachedAuthToken = value || null;
    ctx.persistToken(ctx.cachedAuthToken);
    if (ctx.cachedAuthToken) ctx.sosMonitor?.refresh?.();
    return { ok: true, encrypted: tokenVault.encryptAvailable() };
  });

  ipcMain.handle('auth:clear-session-token', async () => {
    ctx.cachedAuthToken = null;
    ctx.persistToken('');
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
    // Only panel windows (registered + hardened) may use the secure bridge.
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (
      !senderWin ||
      event.sender.isDestroyed() ||
      !panelWindows.isPanelWindow(senderWin)
    ) {
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
      ctx.cachedAuthToken = token.trim();
      ctx.persistToken(ctx.cachedAuthToken);
      // First token of the session — start polling SOS immediately.
      ctx.sosMonitor?.refresh?.();
    }
    return secureApi.execute(action, payload || {}, token || null);
  });

  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('update:get-status', async () => ctx.lastUpdateEvent);

  ipcMain.handle('sos:get-state', async () => ({
    active: Boolean(ctx.sosMonitor && typeof ctx.sosMonitor.isActive === 'function'
      ? ctx.sosMonitor.isActive()
      : false),
  }));

  // Broadcast SOS to other devices via push topic (ntfy).
  // Local siren/popup is handled by ctx.sosMonitor (may suppress originator / same office).
  ipcMain.on('sos:activated', (_event, meta = {}) => {
    void ctx.pushClient?.publishSos?.(meta && typeof meta === 'object' ? meta : {});
  });
  ipcMain.on('sos:cleared', () => {
    void ctx.pushClient?.publishClear?.();
  });
}



ctx.registerIpc = registerIpc;
module.exports = { registerIpc };
