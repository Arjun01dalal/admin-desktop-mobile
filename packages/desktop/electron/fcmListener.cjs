/**
 * Listen for Firebase Cloud Messaging pushes in the Electron main process.
 *
 * - Shows native OS notifications (works while app is in tray)
 * - Broadcasts to panel renderers for in-app toasts / optional navigation
 * - Routes SOS activate/clear payloads to sosMonitor (same as ntfy push)
 */
const { Notification } = require('electron');
const {
  getFcmToken,
  getStoredCredentials,
  ensurePersistentIds,
  appendPersistentId,
} = require('./fcmToken.cjs');

let listenModulePromise = null;
/** @type {import('fcm-push-receiver/dist/client.js').default | null} */
let listenClient = null;
let stopped = false;
let inflightStart = null;
let retryTimer = null;
/** @type {ReturnType<typeof startFcmListener> | null} */
let activeService = null;

function log(...args) {
  console.log('[fcm-listen]', ...args);
}

function warn(...args) {
  console.warn('[fcm-listen]', ...args);
}

function preloadListenModule() {
  if (!listenModulePromise) {
    listenModulePromise = import('fcm-push-receiver')
      .then((mod) => {
        const listen = mod.listen || mod.default?.listen;
        if (typeof listen !== 'function') {
          throw new Error('fcm-push-receiver listen() not available');
        }
        return listen;
      })
      .catch((err) => {
        listenModulePromise = null;
        throw err;
      });
  }
  return listenModulePromise;
}

function normalizeData(raw) {
  const data = {};
  if (!raw || typeof raw !== 'object') return data;
  for (const [key, value] of Object.entries(raw)) {
    data[String(key)] = String(value ?? '');
  }
  return data;
}

function parsePushPayload(notificationData) {
  const info =
    notificationData && typeof notificationData === 'object'
      ? notificationData.notification || {}
      : {};
  const data = normalizeData(notificationData?.data);

  let title = String(info.title || '').trim();
  let body = String(info.body || '').trim();
  if (!title) title = String(data.title || data.subject || '').trim();
  if (!body) body = String(data.body || data.message || data.text || '').trim();
  if (!title) title = 'Astro CS Panel';

  return {
    title,
    body,
    data,
    fcmMessageId: String(notificationData?.fcmMessageId || ''),
    receivedAt: new Date().toISOString(),
  };
}

function combinedText(payload) {
  return `${payload.title} ${payload.body} ${JSON.stringify(payload.data)}`.toLowerCase();
}

function isSosClear(payload) {
  const text = combinedText(payload);
  return (
    /\bsos_clear\b/.test(text) ||
    text.includes('sos cleared') ||
    text.includes('sos lock has been cleared')
  );
}

function isSosActivate(payload) {
  if (isSosClear(payload)) return false;
  const text = combinedText(payload);
  const type = String(payload.data?.type || payload.data?.event || '').toLowerCase();
  return (
    type.includes('sos') ||
    text.includes('sos_active') ||
    (text.includes('sos') && text.includes('activated'))
  );
}

function extractSosMeta(payload) {
  const data = payload.data || {};
  return {
    type: String(data.type || data.event || '').trim(),
    location: String(data.location || '').trim(),
    blockedByName: String(
      data.blockedByName || data.blockedBy || data.userName || '',
    ).trim(),
    blockedById: String(data.blockedById || data.userId || '').trim(),
  };
}

function destroyListenClient() {
  if (!listenClient) return;
  try {
    listenClient.destroy?.();
  } catch {
    // ignore
  }
  listenClient = null;
}

function showOsNotification(handlers, payload) {
  if (!Notification.isSupported()) return null;

  try {
    const n = new Notification({
      title: payload.title,
      body: payload.body || undefined,
      silent: false,
    });

    n.on('click', () => {
      handlers.showMainWindow?.();
      handlers.broadcastToPanels?.('gcalc:push-notification', {
        ...payload,
        clicked: true,
      });
    });

    n.show();
    return n;
  } catch (err) {
    warn('OS notification failed:', err?.message || err);
    return null;
  }
}

function handleIncoming(handlers, { notification, persistentId }) {
  if (persistentId) appendPersistentId(persistentId);

  const payload = parsePushPayload(notification);
  log('notification', payload.title, payload.body || '');

  if (isSosClear(payload)) {
    handlers.getSosMonitor?.()?.forceClear?.();
    return;
  }
  if (isSosActivate(payload)) {
    handlers.getSosMonitor?.()?.forceActive?.(extractSosMeta(payload));
    return;
  }

  showOsNotification(handlers, payload);
  handlers.broadcastToPanels?.('gcalc:push-notification', payload);
  handlers.onNotification?.(payload);
}

async function startListening(handlers) {
  if (stopped) return { ok: false, message: 'stopped' };
  if (inflightStart) return inflightStart;

  inflightStart = (async () => {
    try {
      let credentials = getStoredCredentials();
      if (!credentials?.fcm?.token) {
        const reg = await getFcmToken({});
        if (!reg.ok) return { ok: false, message: reg.message || 'FCM register failed' };
        credentials = getStoredCredentials();
      }
      if (!credentials?.fcm?.token) {
        return { ok: false, message: 'No FCM credentials' };
      }

      ensurePersistentIds(credentials);
      destroyListenClient();

      const listen = await preloadListenModule();
      listenClient = await listen(credentials, (msg) => {
        try {
          handleIncoming(handlers, msg);
        } catch (err) {
          warn('handler error:', err?.message || err);
        }
      });

      log('subscribed for push notifications');
      return { ok: true };
    } catch (err) {
      const message = err?.message || String(err);
      warn('start failed:', message);
      destroyListenClient();
      return { ok: false, message };
    } finally {
      inflightStart = null;
    }
  })();

  return inflightStart;
}

function scheduleRetry(handlers) {
  if (stopped || retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (stopped) return;
    void startListening(handlers).then((res) => {
      if (stopped || res.ok) return;
      scheduleRetry(handlers);
    });
  }, 8_000);
}

/**
 * @param {{
 *   broadcastToPanels?: (channel: string, payload: unknown) => number,
 *   showMainWindow?: () => void,
 *   getSosMonitor?: () => { forceActive?: (meta?: object) => void, forceClear?: () => void } | null,
 *   onNotification?: (payload: object) => void,
 * }} handlers
 */
function startFcmListener(handlers = {}) {
  if (activeService) {
    activeService.stop();
  }

  stopped = false;

  const attempt = () => {
    if (stopped) return;
    void startListening(handlers).then((res) => {
      if (stopped) return;
      if (!res.ok) scheduleRetry(handlers);
    });
  };

  attempt();

  activeService = {
    stop() {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      destroyListenClient();
    },
    restart() {
      this.stop();
      stopped = false;
      attempt();
      return startListening(handlers);
    },
  };

  return activeService;
}

module.exports = { startFcmListener, parsePushPayload, isSosActivate, isSosClear };
