const { contextBridge, ipcRenderer } = require('electron');

const ACTION_RE = /^[a-zA-Z][a-zA-Z0-9._-]{1,80}$/;

function safeInvoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld('gcalc', {
  version: '1.0.0',

  showLogin: () => ipcRenderer.send('gcalc:show-login'),
  showWelcome: () => ipcRenderer.send('gcalc:show-welcome'),
  /** @deprecated Use showSite — kept for compatibility */
  showCalculator: () => ipcRenderer.send('gcalc:show-site'),
  showSite: () => ipcRenderer.send('gcalc:show-site'),
  hideSite: () => ipcRenderer.send('gcalc:hide-site'),

  onRequestLogin: (cb) => {
    if (typeof cb !== 'function') return;
    ipcRenderer.on('astro:request-login', () => cb());
  },

  sendOtp: (payload) => safeInvoke('auth:send-otp', payload),
  verifyOtp: (payload) => safeInvoke('auth:verify-otp', payload),
  getAddress: (payload) => safeInvoke('auth:get-address', payload),
  getIpLocation: () => safeInvoke('auth:get-ip-location'),
  openLocationSettings: () => safeInvoke('gcalc:open-location-settings'),
  copyText: (text) => safeInvoke('gcalc:copy-text', String(text ?? '')),

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
