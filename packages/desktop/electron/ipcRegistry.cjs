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
const { getTrustedPanelSender } = require('./ipcBoundary.cjs');

function getPanelSender(event) {
  return getTrustedPanelSender(event, {
    BrowserWindow,
    panelWindows,
    isTrustedPanelOrigin: ctx.isTrustedPanelOrigin,
  });
}

function getSiteSender(event) {
  const sender = event?.sender;
  if (!sender || sender.isDestroyed()) return null;
  return panelWindows.getPanelBySiteContents(sender);
}

function rejectUnauthorized() {
  return { ok: false, message: 'Unauthorized IPC sender' };
}

function formatAuthNetworkError(error, fallback) {
  const apiMessage = error?.response?.data?.message;
  if (apiMessage) return String(apiMessage);

  const code = String(error?.code || '');
  const msg = String(error?.message || '');
  // Packaged apps often surface raw getaddrinfo ENOTFOUND for a dead/wrong API host.
  if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(msg)) {
    const host = error?.hostname || msg.match(/ENOTFOUND\s+(\S+)/i)?.[1] || 'API host';
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
    if (!getPanelSender(event)) return;
    ctx.applySiteSize(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:show-site', (event, payload = {}) => {
    if (!getPanelSender(event)) return;
    ctx.applySiteSize(ctx.resolvePanelFromEvent(event), payload || {});
  });
  ipcMain.on('gcalc:show-native-auth', (event) => {
    if (!getPanelSender(event)) return;
    ctx.applyNativeAuthSize(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:hide-site', (event) => {
    if (!getPanelSender(event)) return;
    ctx.hideSiteView(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:show-login', (event) => {
    if (!getPanelSender(event)) return;
    ctx.applyLoginSize(ctx.resolvePanelFromEvent(event));
  });
  ipcMain.on('gcalc:show-welcome', (event) => {
    if (!getPanelSender(event)) return;
    ctx.applyWelcomeSize(ctx.resolvePanelFromEvent(event));
  });

  ipcMain.handle('app:open-new-window', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return ctx.openNewPanelWindow();
  });
  ipcMain.handle('app:get-version', (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return app.getVersion();
  });
  ipcMain.handle('gcalc:get-pending-deep-link', (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return ctx.consumePendingDeepLink();
  });

  ipcMain.on('astro:site-identity', (event, payload = {}) => {
    if (!getSiteSender(event)) return;
    ctx.rememberSiteIdentity(payload);
  });

  /** Sync — sitePreload must seed #external_login / LOGIN_TOKEN before SPA Splash. */
  ipcMain.on('astro:get-sso-token', (event) => {
    const rec = getSiteSender(event);
    if (!rec) {
      event.returnValue = '';
      return;
    }
    event.returnValue = rec?._pendingSsoToken ? String(rec._pendingSsoToken) : '';
  });

  ipcMain.on('astro:site-identity-request', (event) => {
    if (!getSiteSender(event)) return;
    if (!ctx.getCachedSiteIdentity().email && !ctx.getCachedSiteIdentity().mobile) return;
    try {
      event.sender.send('astro:prefill-site', ctx.getCachedSiteIdentity());
    } catch {
      // ignore
    }
  });

  ipcMain.on('astro:panel-gate', (event, payload = {}) => {
    const siteRec = getSiteSender(event);
    if (!siteRec) return;
    const ok = Boolean(payload && payload.ok);
    const rec = siteRec;
    if (rec?.win && !rec.win.isDestroyed()) {
      rec.win.webContents.send('astro:panel-gate', { ok });
      return;
    }
    ctx.sendToRenderer('astro:panel-gate', { ok });
  });

  ipcMain.on('astro:request-login', (event, payload = {}) => {
    const siteRec = getSiteSender(event);
    if (!siteRec) return;
    const identity = ctx.rememberSiteIdentity(payload);
    const sosOn = Boolean(
      ctx.sosMonitor && typeof ctx.sosMonitor.isActive === 'function' && ctx.sosMonitor.isActive(),
    );
    const rec = siteRec;
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

  ipcMain.handle('auth:send-otp', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    try {
      return await auth.sendOtp(payload);
    } catch (error) {
      return {
        ok: false,
        message: formatAuthNetworkError(error, 'Failed to send OTP'),
      };
    }
  });

  ipcMain.handle('auth:verify-otp', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    try {
      return await auth.verifyOtp(payload);
    } catch (error) {
      return {
        ok: false,
        message: formatAuthNetworkError(error, 'Invalid OTP'),
      };
    }
  });

  ipcMain.handle('auth:get-address', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
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

  ipcMain.handle('auth:get-ip-location', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
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

  ipcMain.handle('siteAuth:loginViaPassword', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return siteAuth.loginViaPassword(payload || {});
  });
  ipcMain.handle('siteAuth:sendEmailOtp', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return siteAuth.sendEmailOtp(payload || {});
  });
  ipcMain.handle('siteAuth:verifyEmailOtp', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return siteAuth.verifyEmailOtp(payload || {});
  });
  ipcMain.handle('siteAuth:resetPassword', async (event, payload) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return siteAuth.resetPassword(payload || {});
  });
  ipcMain.handle('siteAuth:getFcmToken', async (event, payload = {}) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return fcmToken.getFcmToken(payload || {});
  });
  ipcMain.handle('siteAuth:fetchTerms', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return siteAuth.fetchTermsAndConditions();
  });

  ipcMain.handle('gcalc:open-location-settings', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
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

  ipcMain.handle('gcalc:copy-text', (event, text) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    clipboard.writeText(String(text ?? ''));
    return { ok: true };
  });

  // Sheet downloads after OTP are async — Chromium blocks <a download> without a
  // user gesture. Write the file from main into the OS Downloads folder instead.
  ipcMain.handle('file:save-download', async (event, args = {}) => {
    const senderPanel = getPanelSender(event);
    if (!senderPanel) return rejectUnauthorized();
    const senderWin = senderPanel.win;
    const rawName = path.basename(String(args.filename || 'download.xlsx'));
    const safeName = rawName.replace(/[^\w.\- ()]+/g, '_').slice(0, 180) || 'download.xlsx';
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

  ipcMain.handle('auth:get-session-token', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return {
      ok: true,
      token: ctx.cachedAuthToken || ctx.loadPersistedToken() || null,
      encrypted: tokenVault.encryptAvailable(),
    };
  });

  ipcMain.handle('auth:set-session-token', async (event, token) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    const value = typeof token === 'string' ? token.trim() : '';
    const prev = ctx.cachedAuthToken || '';
    const changed = prev !== value;
    ctx.cachedAuthToken = value || null;
    const persistence = changed
      ? ctx.persistToken(ctx.cachedAuthToken)
      : { ok: true, encrypted: tokenVault.encryptAvailable() && Boolean(value), skipped: true };
    // SOS poll only when login/session token actually changes — not on redundant sets.
    if (changed && ctx.cachedAuthToken) ctx.sosMonitor?.refresh?.();
    return {
      ok: !value || Boolean(persistence?.ok),
      encrypted: Boolean(persistence?.encrypted),
      ...(persistence?.message ? { message: persistence.message } : {}),
    };
  });

  ipcMain.handle('auth:clear-session-token', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    ctx.cachedAuthToken = null;
    ctx.persistToken('');
    return { ok: true };
  });

  ipcMain.handle('error:report', async (event, payload = {}) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
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
    if (!getPanelSender(event)) return rejectUnauthorized();

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
      const next = token.trim();
      const prev = ctx.cachedAuthToken || '';
      const changed = prev !== next;
      ctx.cachedAuthToken = next;
      // Skip sync vault write + SOS refresh when token is unchanged.
      // Writing on every secure:api freezes Windows (Defender) under dashboard fan-out.
      if (changed) {
        ctx.persistToken(next);
        // First/changed session token — start SOS polling immediately.
        ctx.sosMonitor?.refresh?.();
      }
    }
    return secureApi.execute(action, payload || {}, token || null);
  });

  ipcMain.on('update:install', (event) => {
    if (!getPanelSender(event)) return;
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('update:get-status', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return ctx.lastUpdateEvent;
  });

  ipcMain.handle('sos:get-state', async (event) => {
    if (!getPanelSender(event)) return rejectUnauthorized();
    return {
      active: Boolean(
        ctx.sosMonitor && typeof ctx.sosMonitor.isActive === 'function'
          ? ctx.sosMonitor.isActive()
          : false,
      ),
    };
  });
}

ctx.registerIpc = registerIpc;
module.exports = { registerIpc };
