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
const { optionalEnv } = require('./config.cjs');

/**
 * Adaptive SOS poll (was fixed 10s).
 * - Idle: slower backup (push delivers activate/clear instantly when configured)
 * - Active: keep ~10s so CLEAR is noticed quickly
 * - No token: idle wait (no API call)
 */
function envPollMs(name, fallback) {
  const n = Number(optionalEnv(name));
  if (Number.isFinite(n) && n >= 5_000 && n <= 300_000) return Math.floor(n);
  return fallback;
}

const POLL_ACTIVE_MS = envPollMs('SOS_POLL_ACTIVE_MS', 10_000);
const POLL_IDLE_MS = envPollMs('SOS_POLL_IDLE_MS', 30_000);
const POLL_IDLE_WITH_PUSH_MS = envPollMs('SOS_POLL_IDLE_PUSH_MS', 60_000);
const POLL_NO_TOKEN_MS = envPollMs('SOS_POLL_NO_TOKEN_MS', 60_000);
const NOTIFICATION_RENEW_MS = 15_000;
const LOCAL_CONTEXT_FILE = 'sos-local-context.json';

function truthyFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }
  return false;
}

function normalizeLocation(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/,/g, '/');
}

/** Dubai vs "Dubai / Nagpur" etc. — treat overlapping office labels as the same site. */
function locationsMatch(a, b) {
  const na = normalizeLocation(a);
  const nb = normalizeLocation(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const partsA = na.split('/').filter(Boolean);
  const partsB = nb.split('/').filter(Boolean);
  return partsA.some((p) => partsB.includes(p));
}

function isSosFlagEnabled(payload) {
  if (payload == null) return false;

  // Canonical: { block: { enabled, blockedByName, location, ... } }
  const block = getSosBlock(payload);
  if (block) return truthyFlag(block.enabled);

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

function getSosBlock(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.block && typeof payload.block === 'object') return payload.block;
  if (payload.data?.block && typeof payload.data.block === 'object') {
    return payload.data.block;
  }
  if (payload.payload && typeof payload.payload === 'object') {
    return getSosBlock(payload.payload);
  }
  return null;
}

/** Pull type / location / blockedByName from get-sos-flag (or push) payloads. */
function extractSosMeta(payload) {
  if (!payload || typeof payload !== 'object') {
    return { type: '', location: '', blockedByName: '', blockedById: '' };
  }
  const block = getSosBlock(payload);
  const nest =
    block ||
    (payload.data && typeof payload.data === 'object' && payload.data) ||
    (payload.payload && typeof payload.payload === 'object' && payload.payload) ||
    payload;
  return {
    type: String(nest.type || nest.sosType || nest.sos_type || '').trim(),
    location: String(
      nest.location || nest.officeLocation || nest.office_location || '',
    ).trim(),
    blockedByName: String(
      nest.blockedByName || nest.blocked_by_name || nest.name || '',
    ).trim(),
    blockedById: String(
      nest.blockedById || nest.blocked_by_id || '',
    ).trim(),
  };
}

function buildAlertMessage(meta = {}) {
  const name = String(meta.blockedByName || '').trim();
  const location = String(meta.location || '').trim();
  const parts = ['An emergency SOS has been activated.'];
  if (name) parts.push(`Triggered by ${name}.`);
  if (location) parts.push(`Location: ${location}.`);
  parts.push('This alert will stay until you acknowledge it.');
  return parts.join(' ');
}

function buildAlertBody() {
  return 'An emergency SOS has been activated. This alert will stay until you acknowledge it.';
}

function alertHtmlPath() {
  return path.join(__dirname, 'sos-alert.html');
}

/**
 * @param {{
 *   getMainWindow: () => import('electron').BrowserWindow | null,
 *   broadcastSosState?: (payload: { active: boolean }) => void,
 *   showAllPanelWindows?: () => void,
 *   getToken: () => string | null,
 *   getUserDataPath?: () => string,
 *   pushEnabled?: boolean,
 * }} opts
 */
function startSosMonitor({
  getMainWindow,
  broadcastSosState,
  showAllPanelWindows,
  getToken,
  getUserDataPath,
  pushEnabled = false,
}) {
  let sosActive = false;
  let acknowledged = false;
  let alertWin = null;
  let osNotification = null;
  let renewTimer = null;
  let pollTimer = null;
  let pollInFlight = false;
  let refreshQueued = false;
  let stopped = false;
  let ipcRegistered = false;
  let lastLoggedNoToken = 0;
  /** This machine pressed SOS — no siren/popup here until cleared. */
  let suppressOriginatorAlert = false;
  /** Last known SOS meta (from silent activate / push / API). */
  let activeSosMeta = {
    type: '',
    location: '',
    blockedByName: '',
    blockedById: '',
  };
  /** Logged-in user's office (for office-based suppress on peers). */
  let localOfficeLocation = '';

  function nextPollDelayMs() {
    const token = typeof getToken === 'function' ? getToken() : null;
    if (!token) return POLL_NO_TOKEN_MS;
    if (sosActive) return POLL_ACTIVE_MS;
    return pushEnabled ? POLL_IDLE_WITH_PUSH_MS : POLL_IDLE_MS;
  }

  function scheduleNext(delayMs = nextPollDelayMs()) {
    if (stopped) return;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    const wait = Math.max(0, Number(delayMs) || 0);
    pollTimer = setTimeout(() => {
      pollTimer = null;
      void runPoll();
    }, wait);
  }

  function contextPath() {
    try {
      const base =
        typeof getUserDataPath === 'function'
          ? getUserDataPath()
          : path.join(__dirname, '..');
      return path.join(base, LOCAL_CONTEXT_FILE);
    } catch {
      return null;
    }
  }

  function loadLocalContext() {
    try {
      const p = contextPath();
      if (!p || !fs.existsSync(p)) return;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      localOfficeLocation = String(raw?.officeLocation || '').trim();
    } catch {
      // ignore
    }
  }

  function saveLocalContext() {
    try {
      const p = contextPath();
      if (!p) return;
      fs.writeFileSync(
        p,
        JSON.stringify({ officeLocation: localOfficeLocation }, null, 0),
        'utf8',
      );
    } catch (err) {
      log('could not persist local SOS context:', err?.message || err);
    }
  }

  loadLocalContext();

  function log(...args) {
    console.log('[sosMonitor]', ...args);
  }

  function shouldSuppressAlert(meta = {}) {
    if (suppressOriginatorAlert) return true;
    const type = String(meta.type || activeSosMeta.type || '').trim().toLowerCase();
    const location = String(meta.location || activeSosMeta.location || '').trim();
    if (
      (type === 'office-based' || type === 'office') &&
      location &&
      locationsMatch(localOfficeLocation, location)
    ) {
      return true;
    }
    return false;
  }

  function rememberMeta(meta = {}) {
    const type = String(meta.type || '').trim();
    const location = String(meta.location || '').trim();
    const blockedByName = String(meta.blockedByName || '').trim();
    const blockedById = String(meta.blockedById || '').trim();
    if (type) activeSosMeta.type = type;
    if (location) activeSosMeta.location = location;
    if (blockedByName) activeSosMeta.blockedByName = blockedByName;
    if (blockedById) activeSosMeta.blockedById = blockedById;
  }

  function alertDetails() {
    return {
      blockedByName: activeSosMeta.blockedByName || '',
      location: activeSosMeta.location || '',
      message: buildAlertBody(),
    };
  }

  function pushAlertDetailsToWindow() {
    if (!alertWin || alertWin.isDestroyed()) return;
    const details = alertDetails();
    try {
      void alertWin.webContents.executeJavaScript(
        `window.__sosAlertUpdate && window.__sosAlertUpdate(${JSON.stringify(details)});`,
        true,
      );
    } catch {
      // ignore
    }
  }

  function focusMainWindow() {
    try {
      if (typeof showAllPanelWindows === 'function') {
        showAllPanelWindows();
      }
    } catch {
      // ignore
    }
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
        body: buildAlertMessage(activeSosMeta),
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
        pushAlertDetailsToWindow();
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
    const width = 460;
    const height = 280;
    const details = alertDetails();

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
          devTools: false,
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
        void alertWin
          .loadFile(htmlPath, {
            query: {
              blockedByName: details.blockedByName,
              location: details.location,
              message: details.message,
            },
          })
          .then(() => {
            pushAlertDetailsToWindow();
          })
          .catch((err) => {
            log('alert load failed:', err?.message || err);
          });
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

  function notifyRenderer() {
    try {
      if (typeof broadcastSosState === 'function') {
        broadcastSosState({ active: sosActive });
        return;
      }
      const mainWin = typeof getMainWindow === 'function' ? getMainWindow() : null;
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('sos:state', { active: sosActive });
      }
    } catch {
      // ignore
    }
  }

  function onSosState(active, source = 'poll', opts = {}) {
    const wasActive = sosActive;
    sosActive = Boolean(active);

    if (sosActive !== wasActive) {
      notifyRenderer();
    }

    if (sosActive) {
      if (!wasActive) {
        acknowledged = false;
        log('SOS ACTIVE via', source, opts.skipAlert ? '(alert suppressed)' : '');
      }
      if (!opts.skipAlert && !shouldSuppressAlert(opts.meta || {})) {
        startAlerting();
      } else if (opts.skipAlert || shouldSuppressAlert(opts.meta || {})) {
        // Originator / same office — keep lock state, no siren/popup.
        clearAlerting();
        log('alert suppressed for this panel');
      }
      return;
    }

    if (wasActive) log('SOS CLEARED via', source);
    acknowledged = false;
    suppressOriginatorAlert = false;
    activeSosMeta = {
      type: '',
      location: '',
      blockedByName: '',
      blockedById: '',
    };
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
      const active = isSosFlagEnabled(res.data);
      if (active) {
        const meta = extractSosMeta(res.data);
        rememberMeta(meta);
        onSosState(true, 'poll', {
          meta,
          skipAlert: shouldSuppressAlert(meta),
        });
      } else {
        onSosState(false, 'poll');
      }
    } catch (err) {
      log('poll error:', err?.message || err);
    }
  }

  async function runPoll() {
    if (stopped) return;
    if (pollInFlight) {
      refreshQueued = true;
      return;
    }
    pollInFlight = true;
    try {
      await poll();
    } finally {
      pollInFlight = false;
      if (refreshQueued) {
        refreshQueued = false;
        void runPoll();
        return;
      }
      scheduleNext();
    }
  }

  if (!ipcRegistered) {
    ipcRegistered = true;
    ipcMain.on('sos:acknowledge', () => {
      acknowledge();
    });
    ipcMain.on('sos:activated', (_event, meta = {}) => {
      const payload = meta && typeof meta === 'object' ? meta : {};
      const silent = Boolean(payload.silent || payload.self);
      rememberMeta(payload);
      if (silent) {
        suppressOriginatorAlert = true;
      }
      // Same office as an office-based SOS → treat like originator site (no popup).
      if (
        String(payload.type || '').toLowerCase() === 'office-based' &&
        payload.location &&
        locationsMatch(localOfficeLocation, payload.location)
      ) {
        suppressOriginatorAlert = true;
      }
      onSosState(true, 'ipc', {
        meta: payload,
        skipAlert: silent || shouldSuppressAlert(payload),
      });
      // Switch to active cadence after local activate.
      scheduleNext(POLL_ACTIVE_MS);
    });
    ipcMain.on('sos:cleared', () => {
      onSosState(false, 'ipc');
      scheduleNext(nextPollDelayMs());
    });
    ipcMain.on('sos:set-local-context', (_event, ctx = {}) => {
      if (ctx && typeof ctx === 'object') {
        if (ctx.officeLocation != null) {
          localOfficeLocation = String(ctx.officeLocation || '').trim();
          saveLocalContext();
          log('local office location set:', localOfficeLocation || '(empty)');
        }
      }
    });
  }

  void runPoll();

  log(
    'started',
    `idle=${pushEnabled ? POLL_IDLE_WITH_PUSH_MS : POLL_IDLE_MS}ms`,
    `active=${POLL_ACTIVE_MS}ms`,
    `push=${pushEnabled ? 'on' : 'off'}`,
  );

  return {
    stop() {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      pollTimer = null;
      clearAlerting();
    },
    refresh() {
      if (stopped) return;
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      void runPoll();
    },
    isActive() {
      return sosActive;
    },
    /** Force alert from push / external trigger (may be suppressed). */
    forceActive(meta = {}) {
      const payload = meta && typeof meta === 'object' ? meta : {};
      rememberMeta(payload);
      onSosState(true, 'push', {
        meta: payload,
        skipAlert: shouldSuppressAlert(payload),
      });
      scheduleNext(POLL_ACTIVE_MS);
    },
    forceClear() {
      onSosState(false, 'push');
      scheduleNext(nextPollDelayMs());
    },
  };
}

module.exports = { startSosMonitor, isSosFlagEnabled, locationsMatch, extractSosMeta };
