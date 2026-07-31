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
});
