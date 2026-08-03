/**
 * Polls get-sos-flag in the main process so every running app instance
 * alerts when SOS is active — even if the admin panel is closed / on the site.
 *
 * Sticky alert: always-on-top window (no close chrome) + OS notification.
 * Siren loops in the alert window until Acknowledge.
 *
 * NOTE: get-sos-flag requires a Bearer token — use getToken() from the
 * last successful renderer secure:api call.
 */
const {
  BrowserWindow,
  Notification,
  ipcMain,
  screen,
} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const secureApi = require('./secure/index.cjs');

const POLL_MS = 3_000;
const NOTIFICATION_RENEW_MS = 8_000;

function truthyFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }
  return false;
}

function isSosFlagEnabled(payload) {
  if (payload == null) return false;
  if (typeof payload !== 'object') return truthyFlag(payload);

  const obj = payload;
  if (
    truthyFlag(obj.sosEnabled) ||
    truthyFlag(obj.enabled) ||
    truthyFlag(obj.sos) ||
    truthyFlag(obj.sos_flag) ||
    truthyFlag(obj.sosFlag) ||
    truthyFlag(obj.flag)
  ) {
    return true;
  }

  if (obj.data && typeof obj.data === 'object') {
    return isSosFlagEnabled(obj.data);
  }
  if (obj.payload && typeof obj.payload === 'object') {
    return isSosFlagEnabled(obj.payload);
  }
  return false;
}

function alertHtmlPath() {
  return path.join(__dirname, 'sos-alert.html');
}

/**
 * @param {{
 *   getMainWindow: () => import('electron').BrowserWindow | null,
 *   getToken: () => string | null,
 * }} opts
 */
function startSosMonitor({ getMainWindow, getToken }) {
  let sosActive = false;
  let acknowledged = false;
  let alertWin = null;
  let osNotification = null;
  let renewTimer = null;
  let pollTimer = null;
  let ipcRegistered = false;
  let lastLoggedNoToken = 0;

  function log(...args) {
    console.log('[sosMonitor]', ...args);
  }

  function focusMainWindow() {
    const win = getMainWindow?.();
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

  function stopRenew() {
    if (renewTimer) {
      clearInterval(renewTimer);
      renewTimer = null;
    }
  }

  function closeOsNotification() {
    if (!osNotification) return;
    try {
      osNotification.close();
    } catch {
      // ignore
    }
    osNotification = null;
  }

  function destroyAlertWindow() {
    if (!alertWin || alertWin.isDestroyed()) {
      alertWin = null;
      return;
    }
    try {
      alertWin.removeAllListeners('close');
      alertWin.destroy();
    } catch {
      // ignore
    }
    alertWin = null;
  }

  function acknowledge() {
    if (acknowledged) return;
    acknowledged = true;
    log('acknowledged by user');
    stopRenew();
    closeOsNotification();
    destroyAlertWindow();
    focusMainWindow();
  }

  function showOsNotification() {
    if (!Notification.isSupported()) {
      log('OS Notification API not supported');
      return;
    }
    closeOsNotification();

    try {
      const n = new Notification({
        title: 'SOS ALERT',
        body: 'An emergency SOS has been activated. Click to acknowledge.',
        urgency: 'critical',
        timeoutType: 'never',
        silent: true,
      });

      n.on('click', () => {
        acknowledge();
      });

      n.show();
      osNotification = n;
    } catch (err) {
      log('notification failed:', err?.message || err);
    }
  }

  function ensureAlertWindow() {
    if (alertWin && !alertWin.isDestroyed()) {
      try {
        if (!alertWin.isVisible()) alertWin.show();
        alertWin.setAlwaysOnTop(true, 'screen-saver');
        alertWin.moveTop();
        alertWin.focus();
      } catch {
        // ignore
      }
      return;
    }

    const display = screen.getPrimaryDisplay();
    const { width: sw, height: sh } = display.workAreaSize;
    const width = 440;
    const height = 220;

    try {
      alertWin = new BrowserWindow({
        width,
        height,
        x: Math.round((sw - width) / 2),
        y: Math.round((sh - height) / 2),
        show: true,
        alwaysOnTop: true,
        frame: false,
        closable: false,
        minimizable: false,
        maximizable: false,
        resizable: false,
        fullscreenable: false,
        skipTaskbar: false,
        title: 'SOS ALERT',
        backgroundColor: '#7f1d1d',
        webPreferences: {
          preload: path.join(__dirname, 'sosAlertPreload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          // Siren must start without a click.
          autoplayPolicy: 'no-user-gesture-required',
        },
      });

      alertWin.setAlwaysOnTop(true, 'screen-saver');
      try {
        alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      } catch {
        // ignore
      }
      alertWin.removeMenu?.();

      alertWin.on('close', (event) => {
        if (sosActive && !acknowledged) {
          event.preventDefault();
        }
      });

      alertWin.on('closed', () => {
        alertWin = null;
      });

      const htmlPath = alertHtmlPath();
      if (fs.existsSync(htmlPath)) {
        void alertWin.loadFile(htmlPath);
      } else {
        log('sos-alert.html missing — alert UI will be empty');
      }
      log('alert window opened (siren)');
    } catch (err) {
      log('alert window failed:', err?.message || err);
    }
  }

  function startAlerting() {
    if (acknowledged) return;

    ensureAlertWindow();
    showOsNotification();

    if (!renewTimer) {
      renewTimer = setInterval(() => {
        if (acknowledged || !sosActive) return;
        showOsNotification();
        ensureAlertWindow();
      }, NOTIFICATION_RENEW_MS);
    }
  }

  function clearAlerting() {
    stopRenew();
    closeOsNotification();
    destroyAlertWindow();
  }

  function onSosState(active, source = 'poll') {
    const wasActive = sosActive;
    sosActive = active;

    if (active) {
      if (!wasActive) {
        acknowledged = false;
        log('SOS ACTIVE via', source);
      }
      startAlerting();
      return;
    }

    if (wasActive) log('SOS CLEARED via', source);
    acknowledged = false;
    clearAlerting();
  }

  async function poll() {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) {
      const now = Date.now();
      if (now - lastLoggedNoToken > 30_000) {
        lastLoggedNoToken = now;
        log('waiting for session token before polling get-sos-flag');
      }
      return;
    }

    try {
      const res = await secureApi.execute('auth.getSosFlag', {}, token);
      if (!res?.ok) {
        log('getSosFlag failed:', res?.message || res?.status || 'unknown');
        return;
      }
      onSosState(isSosFlagEnabled(res.data), 'poll');
    } catch (err) {
      log('poll error:', err?.message || err);
    }
  }

  if (!ipcRegistered) {
    ipcRegistered = true;
    ipcMain.on('sos:acknowledge', () => {
      acknowledge();
    });
    ipcMain.on('sos:activated', () => {
      onSosState(true, 'ipc');
    });
    ipcMain.on('sos:cleared', () => {
      onSosState(false, 'ipc');
    });
  }

  void poll();
  pollTimer = setInterval(() => {
    void poll();
  }, POLL_MS);

  log('started');

  return {
    stop() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      clearAlerting();
    },
    refresh() {
      void poll();
    },
    /** Force alert from push / external trigger. */
    forceActive() {
      onSosState(true, 'push');
    },
    forceClear() {
      onSosState(false, 'push');
    },
  };
}

module.exports = { startSosMonitor, isSosFlagEnabled };
