const { contextBridge, ipcRenderer } = require('electron');

const ACTION_RE = /^[a-zA-Z][a-zA-Z0-9._-]{1,80}$/;

function safeInvoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

function readPackageVersion() {
  try {
    return String(require('../package.json').version || '').trim() || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

contextBridge.exposeInMainWorld('gcalc', {
  version: readPackageVersion(),
  getAppVersion: () => safeInvoke('app:get-version'),

  showLogin: () => ipcRenderer.send('gcalc:show-login'),
  showWelcome: () => ipcRenderer.send('gcalc:show-welcome'),
  /** @deprecated Use showSite — kept for compatibility */
  showCalculator: () => ipcRenderer.send('gcalc:show-site'),
  /** Optional accessToken → one-shot SSO hash (customer login only, not gate password). */
  showSite: (payload) => ipcRenderer.send('gcalc:show-site', payload || {}),
  /** Landscape shell without marketing BrowserView (native Astro login). */
  showNativeAuth: () => ipcRenderer.send('gcalc:show-native-auth'),
  hideSite: () => ipcRenderer.send('gcalc:hide-site'),

  openNewWindow: () => safeInvoke('app:open-new-window'),

  /** Public Astro site auth (api.astrothirdeye.com). */
  siteLoginViaPassword: (payload) => safeInvoke('siteAuth:loginViaPassword', payload),
  siteSendEmailOtp: (payload) => safeInvoke('siteAuth:sendEmailOtp', payload),
  siteVerifyEmailOtp: (payload) => safeInvoke('siteAuth:verifyEmailOtp', payload),
  siteResetPassword: (payload) => safeInvoke('siteAuth:resetPassword', payload),
  /** Real FCM registration token (Electron main → Google FCM). */
  getFcmToken: (payload) => safeInvoke('siteAuth:getFcmToken', payload || {}),
  /** Astro site Terms & Conditions (static page type 6100). */
  fetchTermsAndConditions: () => safeInvoke('siteAuth:fetchTerms'),

  onRequestLogin: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = (_e, d) => cb(d && typeof d === 'object' ? d : {});
    ipcRenderer.on('astro:request-login', handler);
    return () => {
      ipcRenderer.removeListener('astro:request-login', handler);
    };
  },

  /** OS / site logout deep link: myastroapp://login?logged_out=1 */
  onDeepLink: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = (_e, d) => cb(d && typeof d === 'object' ? d : {});
    ipcRenderer.on('gcalc:deep-link', handler);
    return () => {
      ipcRenderer.removeListener('gcalc:deep-link', handler);
    };
  },
  getPendingDeepLink: () => safeInvoke('gcalc:get-pending-deep-link'),

  onLoginBlockedSos: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = () => cb();
    ipcRenderer.on('astro:login-blocked-sos', handler);
    return () => {
      ipcRenderer.removeListener('astro:login-blocked-sos', handler);
    };
  },

  onPanelGate: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('astro:panel-gate', handler);
    return () => {
      ipcRenderer.removeListener('astro:panel-gate', handler);
    };
  },

  sendOtp: (payload) => safeInvoke('auth:send-otp', payload),
  verifyOtp: (payload) => safeInvoke('auth:verify-otp', payload),
  getAddress: (payload) => safeInvoke('auth:get-address', payload),
  getIpLocation: () => safeInvoke('auth:get-ip-location'),
  openLocationSettings: () => safeInvoke('gcalc:open-location-settings'),
  copyText: (text) => safeInvoke('gcalc:copy-text', String(text ?? '')),
  saveDownload: (filename, base64) =>
    safeInvoke('file:save-download', {
      filename: String(filename || 'download.xlsx'),
      base64: String(base64 || ''),
    }),
  recordingUrl: (url) => {
    try {
      const parsed = new URL(String(url || ''));
      if (parsed.protocol === 'http:') parsed.protocol = 'https:';
      if (parsed.protocol !== 'https:') return '';
      return `astro-recording://media/${encodeURIComponent(parsed.toString())}`;
    } catch {
      return '';
    }
  },

  /** OS-encrypted session token (Electron safeStorage in main). */
  getSessionToken: () => safeInvoke('auth:get-session-token'),
  setSessionToken: (token) =>
    safeInvoke('auth:set-session-token', typeof token === 'string' ? token : ''),
  clearSessionToken: () => safeInvoke('auth:clear-session-token'),

  /** Forward renderer errors to main (log + optional ERROR_WEBHOOK_URL). */
  reportError: (payload) =>
    safeInvoke(
      'error:report',
      payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {},
    ),

  /**
   * Secure named API. Renderer only sends action name + payload + session token.
   * Base URL, paths, and encryption key stay in the main process.
   */
  secureApi: (action, payload = {}, token = null) => {
    if (typeof action !== 'string' || !ACTION_RE.test(action)) {
      return Promise.resolve({ ok: false, message: 'Invalid action' });
    }
    const safePayload =
      payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const safeToken = typeof token === 'string' ? token : null;
    return safeInvoke('secure:api', {
      action,
      payload: safePayload,
      token: safeToken,
    });
  },

  onUpdateAvailable: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('update:available', (_e, d) => cb(d));
  },
  onUpdateProgress: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('update:progress', (_e, d) => cb(d));
  },
  onUpdateReady: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('update:ready', (_e, d) => cb(d));
  },
  onUpdateError: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('update:error', (_e, d) => cb(d));
  },
  getUpdateStatus: () => safeInvoke('update:get-status'),
  installUpdate: () => ipcRenderer.send('update:install'),

  /** Tell main process SOS was just activated on this machine (immediate alert). */
  sosActivated: (meta) =>
    ipcRenderer.send(
      'sos:activated',
      meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {},
    ),
  /** Tell main process SOS was cleared on this machine. */
  sosCleared: () => ipcRenderer.send('sos:cleared'),
  /** Persist this panel's office location for office-based SOS suppress. */
  setSosLocalContext: (ctx) =>
    ipcRenderer.send(
      'sos:set-local-context',
      ctx && typeof ctx === 'object' && !Array.isArray(ctx) ? ctx : {},
    ),
  /** Current SOS flag known by main (works without renderer token). */
  getSosState: () => safeInvoke('sos:get-state'),
  /** Subscribe to SOS active/cleared from main (sosMonitor / push). */
  onSosState: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('sos:state', handler);
    return () => {
      ipcRenderer.removeListener('sos:state', handler);
    };
  },
  /**
   * Dev only (`npm run dev`) — main-process HTTP logs.
   * Disabled in packaged builds; Network tab cannot see main-process traffic anyway.
   */
  onSecureHttpLog: (cb) => {
    if (typeof cb !== 'function') return () => {};
    const handler = (_e, d) => cb(d);
    ipcRenderer.on('secure:dev-http-log', handler);
    return () => {
      ipcRenderer.removeListener('secure:dev-http-log', handler);
    };
  },
});
