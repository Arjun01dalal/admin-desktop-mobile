/**
 * Listen for Firebase Cloud Messaging pushes in the Electron main process.
 *
 * - Shows native OS notifications (title / body / image / sound)
 * - Broadcasts to panel renderers for in-app toasts / optional navigation
 * - Routes SOS activate/clear payloads to sosMonitor (same as ntfy push)
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Notification, nativeImage, app, net, BrowserWindow } = require('electron');
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
/** Reused hidden window for notify.mp3 — avoids Windows PowerShell cold-start hitch. */
let notifySoundWin = null;

function log(...args) {
  console.log('[fcm-listen]', ...args);
}

function warn(...args) {
  console.warn('[fcm-listen]', ...args);
}

function appIconPath() {
  return path.join(__dirname, '..', 'build', 'icon.png');
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

function firstHttpsUrl(...candidates) {
  for (const raw of candidates) {
    const url = String(raw || '').trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return '';
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

  const imageUrl = firstHttpsUrl(
    info.image,
    info.icon,
    data.image,
    data.imageUrl,
    data.image_url,
    data.picture,
    data.icon,
    data.photo,
  );

  return {
    title,
    body,
    imageUrl: imageUrl || undefined,
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
    blockedByName: String(data.blockedByName || data.blockedBy || data.userName || '').trim(),
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

function destroyNotifySoundWin() {
  if (!notifySoundWin || notifySoundWin.isDestroyed()) {
    notifySoundWin = null;
    return;
  }
  try {
    notifySoundWin.destroy();
  } catch {
    // ignore
  }
  notifySoundWin = null;
}

/**
 * Download a remote image for the OS notification icon (best-effort, 4s timeout).
 * @param {string} url
 * @returns {Promise<string | null>} local file path
 */
function downloadImageToTemp(url) {
  return new Promise((resolve) => {
    const timedOut = setTimeout(() => resolve(null), 4000);
    try {
      const request = net.request({ method: 'GET', url });
      const chunks = [];
      request.on('response', (response) => {
        const status = Number(response.statusCode || 0);
        if (status < 200 || status >= 300) {
          clearTimeout(timedOut);
          resolve(null);
          return;
        }
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          clearTimeout(timedOut);
          try {
            const buf = Buffer.concat(chunks);
            if (!buf.length || buf.length > 2_500_000) {
              resolve(null);
              return;
            }
            const ext = /\.jpe?g(\?|$)/i.test(url)
              ? '.jpg'
              : /\.webp(\?|$)/i.test(url)
                ? '.webp'
                : /\.gif(\?|$)/i.test(url)
                  ? '.gif'
                  : '.png';
            const file = path.join(
              app.getPath('temp'),
              `astro-push-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`,
            );
            void fs.promises
              .writeFile(file, buf)
              .then(() => {
                const img = nativeImage.createFromPath(file);
                if (img.isEmpty()) {
                  void fs.promises.unlink(file).catch(() => {});
                  resolve(null);
                  return;
                }
                resolve(file);
              })
              .catch(() => resolve(null));
            return;
          } catch {
            resolve(null);
          }
        });
        response.on('error', () => {
          clearTimeout(timedOut);
          resolve(null);
        });
      });
      request.on('error', () => {
        clearTimeout(timedOut);
        resolve(null);
      });
      request.end();
    } catch {
      clearTimeout(timedOut);
      resolve(null);
    }
  });
}

async function resolveNotificationIcon(imageUrl) {
  const fallback = appIconPath();
  const fallbackOk = fs.existsSync(fallback) ? fallback : undefined;
  if (!imageUrl) return fallbackOk;
  const local = await downloadImageToTemp(imageUrl);
  return local || fallbackOk;
}

function notifySoundPath() {
  const candidates = [
    path.join(__dirname, '..', 'public', 'sounds', 'notify.mp3'),
    path.join(__dirname, '..', 'dist', 'sounds', 'notify.mp3'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Play notify.mp3 even when the renderer audio context is locked. */
function playLocalNotifySound() {
  const file = notifySoundPath();
  if (!file) return;
  try {
    if (process.platform === 'darwin') {
      const { execFile } = require('node:child_process');
      execFile('afplay', ['-v', '1.0', file], () => {});
      return;
    }

    // Windows/Linux: HTML5 audio in a reused hidden BrowserWindow.
    // PowerShell + PresentationCore cold-starts in 1–3s and freezes the main process.
    const src = pathToFileURL(file).href;
    if (!notifySoundWin || notifySoundWin.isDestroyed()) {
      notifySoundWin = new BrowserWindow({
        show: false,
        width: 1,
        height: 1,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
          sandbox: true,
          backgroundThrottling: false,
          nodeIntegration: false,
          contextIsolation: true,
        },
      });
      notifySoundWin.on('closed', () => {
        notifySoundWin = null;
      });
    }
    const html = `<!DOCTYPE html><html><body><script>
      const a = new Audio(${JSON.stringify(src)});
      a.volume = 1;
      a.play().catch(function () {});
    </script></body></html>`;
    void notifySoundWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  } catch (err) {
    warn('local sound failed:', err?.message || err);
  }
}

async function showOsNotification(handlers, payload) {
  if (!Notification.isSupported()) return null;

  try {
    const icon = await resolveNotificationIcon(payload.imageUrl);
    /** @type {Electron.NotificationConstructorOptions} */
    const opts = {
      title: payload.title || 'Astro CS Panel',
      body: payload.body || undefined,
      // We play our own MP3 via afplay / MediaPlayer for reliable volume.
      silent: true,
      icon: icon || undefined,
    };

    const n = new Notification(opts);
    playLocalNotifySound();

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
  log('notification', payload.title, payload.body ? `(body ${payload.body.length} chars)` : '');

  if (isSosClear(payload)) {
    handlers.getSosMonitor?.()?.forceClear?.();
    return;
  }
  if (isSosActivate(payload)) {
    handlers.getSosMonitor?.()?.forceActive?.(extractSosMeta(payload));
    return;
  }

  void showOsNotification(handlers, payload);
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
      destroyNotifySoundWin();
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
