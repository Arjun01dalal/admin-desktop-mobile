#!/usr/bin/env node
/**
 * Always-on SOS push relay.
 *
 * Polls SubAdmin/get-sos-flag and publishes to the ntfy topic when SOS turns
 * on/off — so every subscribed desktop (and ntfy mobile app) gets notified
 * even if no panel user is online.
 *
 * Usage:
 *   npm run sos-push
 *
 * Required env (.env):
 *   API_BASE_URL
 *   SOS_SERVICE_TOKEN   — Bearer token that can call get-sos-flag
 *   SOS_PUSH_TOPIC      — shared secret topic (same as Electron apps)
 *
 * Optional:
 *   SOS_PUSH_SERVER     — default https://ntfy.sh
 *   SOS_PUSH_POLL_MS    — default 3000
 */
const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');

const ROOT = path.join(__dirname, '..', '..');
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

function requireHttps(raw, label) {
  const s = String(raw || '').trim().replace(/\/$/, '');
  if (!s) die(`Missing ${label}`);
  let u;
  try {
    u = new URL(s);
  } catch {
    die(`Invalid ${label}`);
  }
  if (u.protocol !== 'https:') die(`${label} must use HTTPS`);
  return s;
}

function die(msg) {
  console.error('[sos-push]', msg);
  process.exit(1);
}

const API_BASE = requireHttps(process.env.API_BASE_URL, 'API_BASE_URL');
const TOKEN = String(process.env.SOS_SERVICE_TOKEN || '').trim();
const TOPIC = String(process.env.SOS_PUSH_TOPIC || '').trim();
const SERVER = requireHttps(process.env.SOS_PUSH_SERVER || 'https://ntfy.sh', 'SOS_PUSH_SERVER');
const POLL_MS = Math.max(2000, Number(process.env.SOS_PUSH_POLL_MS || 3000));
if (!TOKEN) die('Missing SOS_SERVICE_TOKEN (Bearer token for get-sos-flag)');
if (!TOPIC) die('Missing SOS_PUSH_TOPIC');

function isSosFlagEnabled(payload) {
  if (payload == null) return false;
  if (typeof payload !== 'object') {
    return payload === true || payload === 1 || String(payload).toLowerCase() === 'true';
  }
  const obj = payload;
  // Canonical get-sos-flag: { block: { enabled, blockedByName, ... } }
  if (obj.block && typeof obj.block === 'object') {
    return obj.block.enabled === true || String(obj.block.enabled).toLowerCase() === 'true';
  }
  if (obj.sosEnabled === true || obj.enabled === true || obj.sos === true) return true;
  if (obj.data && typeof obj.data === 'object') return isSosFlagEnabled(obj.data);
  return false;
}

async function fetchSosFlag() {
  const res = await fetch(`${API_BASE}/SubAdmin/get-sos-flag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: '{}',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  const payload = json?.data?.payload ?? json?.data ?? json?.payload ?? json;
  return isSosFlagEnabled(payload);
}

async function publish(title, message, headers = {}) {
  const res = await fetch(`${SERVER}/${encodeURIComponent(TOPIC)}`, {
    method: 'POST',
    headers: {
      Title: title,
      Priority: headers.Priority || 'urgent',
      Tags: headers.Tags || 'rotating_light,siren',
    },
    body: message,
  });
  if (!res.ok) {
    throw new Error(`ntfy ${res.status}: ${await res.text().catch(() => '')}`);
  }
}

/* ------------------- Expo push to mobile APKs (closed-app siren) -------- */
// Mobile APKs publish `EXPO_TOKEN=<ExponentPushToken[...]>` to the ntfy topic
// after login. We collect them here and, when SOS flips, send an Expo push
// with the "sos" channel so the phone sirens even when the app is closed.
const TOKENS_FILE = path.join(__dirname, 'expo-tokens.json');

function loadTokens() {
  try {
    const arr = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    return Array.isArray(arr) ? arr.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

let expoTokens = loadTokens();

function saveTokens() {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(expoTokens, null, 2));
  } catch (err) {
    console.warn('[sos-push] token save failed:', err?.message || err);
  }
}

function addToken(token) {
  const t = String(token || '').trim();
  if (!/^(ExponentPushToken\[.+\]|ExpoPushToken\[.+\])$/.test(t)) return;
  if (expoTokens.includes(t)) return;
  expoTokens.push(t);
  saveTokens();
  console.log('[sos-push] registered mobile token (total:', expoTokens.length, ')');
}

async function sendExpoPush(title, body, active) {
  if (expoTokens.length === 0) return;
  const messages = expoTokens.map((to) => ({
    to,
    title,
    body,
    priority: 'high',
    sound: active ? 'siren.mp3' : 'default', // iOS custom sound
    channelId: active ? 'sos' : 'default', // Android siren channel
    data: { sos: active ? 'active' : 'clear' },
  }));
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    // Drop tokens Expo reports as dead (DeviceNotRegistered).
    const tickets = Array.isArray(json?.data) ? json.data : [];
    const dead = [];
    tickets.forEach((ticket, i) => {
      if (ticket?.details?.error === 'DeviceNotRegistered') dead.push(expoTokens[i]);
    });
    if (dead.length) {
      expoTokens = expoTokens.filter((t) => !dead.includes(t));
      saveTokens();
    }
    console.log('[sos-push] expo push sent to', messages.length, 'device(s)');
  } catch (err) {
    console.warn('[sos-push] expo push failed:', err?.message || err);
  }
}

// Subscribe to the ntfy topic (websocket) to collect mobile tokens.
function startTokenCollector() {
  let ws = null;
  let timer = null;
  const wsUrl = `${SERVER.replace(/^https:/i, 'wss:')}/${encodeURIComponent(TOPIC)}/ws`;

  const reconnect = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      connect();
    }, 5000);
  };

  const connect = () => {
    try {
      const WebSocket = require('ws');
      ws = new WebSocket(wsUrl);
      ws.on('open', () => console.log('[sos-push] token collector subscribed'));
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(Buffer.isBuffer(data) ? data.toString('utf8') : String(data));
          if (msg?.event !== 'message') return;
          const m = String(msg.message || '').match(/EXPO_TOKEN=(\S+)/);
          if (m) addToken(m[1]);
        } catch {
          /* ignore */
        }
      });
      ws.on('close', () => {
        ws = null;
        reconnect();
      });
      ws.on('error', () => {});
    } catch (err) {
      console.warn('[sos-push] token collector failed:', err?.message || err);
      reconnect();
    }
  };

  connect();
}

let lastActive = null;

async function tick() {
  try {
    const active = await fetchSosFlag();
    if (lastActive === null) {
      lastActive = active;
      console.log('[sos-push] initial sosEnabled=', active);
      return;
    }
    if (active === lastActive) return;

    if (active) {
      await publish('SOS ALERT', 'SOS_ACTIVE — Emergency SOS has been activated.');
      console.log('[sos-push] published SOS ACTIVE');
      await sendExpoPush('🚨 SOS ALERT', 'Emergency SOS has been activated. Open the app now.', true);
    } else {
      await publish('SOS cleared', 'SOS_CLEAR — SOS lock has been cleared.', {
        Tags: 'white_check_mark',
        Priority: 'default',
      });
      console.log('[sos-push] published SOS CLEAR');
      await sendExpoPush('SOS cleared', 'SOS lock has been cleared.', false);
    }
    lastActive = active;
  } catch (err) {
    console.warn('[sos-push] tick error:', err?.message || err);
  }
}

startTokenCollector();
console.log('[sos-push] relay started');
console.log('[sos-push] topic=', TOPIC, 'server=', SERVER, 'pollMs=', POLL_MS);
void tick();
setInterval(() => {
  void tick();
}, POLL_MS);
