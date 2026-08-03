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

const API_BASE = String(process.env.API_BASE_URL || '').replace(/\/$/, '');
const TOKEN = String(process.env.SOS_SERVICE_TOKEN || '').trim();
const TOPIC = String(process.env.SOS_PUSH_TOPIC || '').trim();
const SERVER = String(process.env.SOS_PUSH_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
const POLL_MS = Math.max(2000, Number(process.env.SOS_PUSH_POLL_MS || 3000));

function die(msg) {
  console.error('[sos-push]', msg);
  process.exit(1);
}

if (!API_BASE) die('Missing API_BASE_URL');
if (!TOKEN) die('Missing SOS_SERVICE_TOKEN (Bearer token for get-sos-flag)');
if (!TOPIC) die('Missing SOS_PUSH_TOPIC');

function isSosFlagEnabled(payload) {
  if (payload == null) return false;
  if (typeof payload !== 'object') {
    return payload === true || payload === 1 || String(payload).toLowerCase() === 'true';
  }
  const obj = payload;
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
    } else {
      await publish('SOS cleared', 'SOS_CLEAR — SOS lock has been cleared.', {
        Tags: 'white_check_mark',
        Priority: 'default',
      });
      console.log('[sos-push] published SOS CLEAR');
    }
    lastActive = active;
  } catch (err) {
    console.warn('[sos-push] tick error:', err?.message || err);
  }
}

console.log('[sos-push] relay started');
console.log('[sos-push] topic=', TOPIC, 'server=', SERVER, 'pollMs=', POLL_MS);
void tick();
setInterval(() => {
  void tick();
}, POLL_MS);
