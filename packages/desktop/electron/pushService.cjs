/**
 * SOS Push client — subscribes to an ntfy topic and publishes SOS events.
 *
 * Works while the Electron app is running (including tray / "closed" window).
 * Fully Force-Quit apps cannot receive pushes; use tray + login-item for that.
 *
 * Also run `npm run sos-push` on a always-on machine to broadcast when the
 * API sos-flag flips, even if nobody has the panel open.
 *
 * Env (optional):
 *   SOS_PUSH_TOPIC   — secret topic name (required to enable push)
 *   SOS_PUSH_SERVER  — default https://ntfy.sh
 */
const { getSosPushTopic, getSosPushServer } = require('./config.cjs');
const { assertHttpsUrl } = require('./httpsOnly.cjs');

function getPushConfig() {
  const topic = String(getSosPushTopic() || '').trim();
  const server = String(getSosPushServer()).trim().replace(/\/$/, '');
  assertHttpsUrl(server, { label: 'SOS_PUSH_SERVER' });
  return {
    enabled: Boolean(topic),
    topic,
    server,
    // https:// → wss:// only (never cleartext ws://)
    wsUrl: topic ? `${server.replace(/^https:/i, 'wss:')}/${encodeURIComponent(topic)}/ws` : '',
    publishUrl: topic ? `${server}/${encodeURIComponent(topic)}` : '',
  };
}

/**
 * @param {{
 *   onSosActivated?: () => void,
 *   onSosCleared?: () => void,
 * }} handlers
 */
function startPushClient(handlers = {}) {
  const cfg = getPushConfig();
  if (!cfg.enabled) {
    console.log('[push] disabled — set SOS_PUSH_TOPIC in .env to enable');
    return {
      stop() {},
      publishSos() {
        return Promise.resolve(false);
      },
      publishClear() {
        return Promise.resolve(false);
      },
    };
  }

  let ws = null;
  let stopped = false;
  let reconnectTimer = null;
  let lastMsgId = '';

  function log(...args) {
    console.log('[push]', ...args);
  }

  function handlePayload(raw) {
    let msg;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return;
    }

    // ntfy keepalive / open events
    if (!msg || msg.event === 'open' || msg.event === 'keepalive') return;
    if (msg.event && msg.event !== 'message') return;
    if (msg.id && msg.id === lastMsgId) return;
    if (msg.id) lastMsgId = msg.id;

    const title = String(msg.title || '').toLowerCase();
    const body = String(msg.message || msg.body || '');
    const bodyLower = body.toLowerCase();
    const tags = Array.isArray(msg.tags) ? msg.tags.join(',') : String(msg.tags || '');
    const combined = `${title} ${bodyLower} ${tags}`;

    if (
      /\bSOS_CLEAR\b/i.test(combined) ||
      combined.includes('sos cleared') ||
      combined.includes('sos_clear')
    ) {
      log('received SOS clear');
      handlers.onSosCleared?.();
      return;
    }

    if (combined.includes('sos') || tags.includes('siren') || tags.includes('rotating_light')) {
      const typeMatch = body.match(/\btype=([^\s]+)/i);
      const locMatch = body.match(/\blocation=(.+?)(?:\s+blockedByName=|\s*::|\s*$)/i);
      const byMatch = body.match(/\bblockedByName=(.+?)(?:\s*::|\s*$)/i);
      const meta = {
        type: typeMatch ? String(typeMatch[1] || '').trim() : '',
        location: locMatch ? String(locMatch[1] || '').trim() : '',
        blockedByName: byMatch ? String(byMatch[1] || '').trim() : '',
      };
      log('received SOS activate', meta);
      handlers.onSosActivated?.(meta);
    }
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 4_000);
  }

  function connect() {
    if (stopped) return;
    try {
      const WebSocket = require('ws');
      ws = new WebSocket(cfg.wsUrl);

      ws.on('open', () => log('subscribed', cfg.topic));
      ws.on('message', (data) => {
        handlePayload(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
      });
      ws.on('close', () => {
        ws = null;
        if (!stopped) {
          log('disconnected — reconnecting…');
          scheduleReconnect();
        }
      });
      ws.on('error', () => {
        // close handler reconnects
      });
    } catch (err) {
      log('connect failed:', err?.message || err);
      scheduleReconnect();
    }
  }

  async function publish(title, message, extraHeaders = {}) {
    if (!cfg.publishUrl) return false;
    try {
      const res = await fetch(cfg.publishUrl, {
        method: 'POST',
        headers: {
          Title: title,
          Priority: 'urgent',
          Tags: 'rotating_light,siren',
          ...extraHeaders,
        },
        body: message,
      });
      if (!res.ok) {
        log('publish failed:', res.status, await res.text().catch(() => ''));
        return false;
      }
      log('published:', title);
      return true;
    } catch (err) {
      log('publish error:', err?.message || err);
      return false;
    }
  }

  connect();

  return {
    stop() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      try {
        ws?.close?.();
      } catch {
        // ignore
      }
      ws = null;
    },
    publishSos(meta = {}) {
      const type = String(meta?.type || '').trim();
      const location = String(meta?.location || '').trim();
      const blockedByName = String(meta?.blockedByName || '').trim();
      const parts = ['SOS_ACTIVE'];
      if (type) parts.push(`type=${type}`);
      // `::` terminator so location / name may contain spaces.
      if (location) parts.push(`location=${location}`);
      if (blockedByName) parts.push(`blockedByName=${blockedByName}`);
      parts.push(':: Emergency SOS has been activated. Open Astro CS Panel.');
      return publish('SOS ALERT', parts.join(' '));
    },
    publishClear() {
      return publish('SOS cleared', 'SOS_CLEAR — SOS lock has been cleared.', {
        Tags: 'white_check_mark',
        Priority: 'default',
      });
    },
  };
}

module.exports = {
  startPushClient,
  getPushConfig,
};
