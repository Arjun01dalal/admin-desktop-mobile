/**
 * Real FCM device token for Electron (main process).
 * Uses Google check-in + FCM registration against the Astro Firebase project.
 *
 * Cold path: first Google register is slow — warm as early as app.whenReady()
 * so LOGIN usually hits memory/disk cache (or the same in-flight promise).
 */
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');
const { optionalEnv } = require('./config.cjs');

/** Defaults from packages/mobile/google-services.json (astro-admin-panel). */
const DEFAULT_FIREBASE = {
  apiKey: 'AIzaSyA63Clb0NsXTReatyX7ho5TATG1f-rkYCk',
  projectId: 'astro-admin-panel',
  appId: '1:344071214084:android:46282aad85675e2cae1151',
  messagingSenderId: '344071214084',
  storageBucket: 'astro-admin-panel.firebasestorage.app',
};

let cachedToken = null;
let inflight = null;
/** Prefetch ESM so first register() does not pay import cost on LOGIN. */
let registerFnPromise = null;
let warmed = false;

function firebaseConfig() {
  return {
    apiKey: optionalEnv('FIREBASE_API_KEY') || DEFAULT_FIREBASE.apiKey,
    projectId: optionalEnv('FIREBASE_PROJECT_ID') || DEFAULT_FIREBASE.projectId,
    appId: optionalEnv('FIREBASE_APP_ID') || DEFAULT_FIREBASE.appId,
    messagingSenderId:
      optionalEnv('FIREBASE_MESSAGING_SENDER_ID') || DEFAULT_FIREBASE.messagingSenderId,
    storageBucket: optionalEnv('FIREBASE_STORAGE_BUCKET') || DEFAULT_FIREBASE.storageBucket,
    authDomain: optionalEnv('FIREBASE_AUTH_DOMAIN') || undefined,
  };
}

function vapidKey() {
  return optionalEnv('FIREBASE_VAPID_KEY') || undefined;
}

function credentialsPath() {
  return path.join(app.getPath('userData'), 'astro-fcm-credentials.json');
}

function readStored() {
  try {
    const raw = fs.readFileSync(credentialsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    const token = String(parsed?.fcm?.token || '').trim();
    if (token) return { token, credentials: parsed };
  } catch {
    // missing / corrupt
  }
  return null;
}

function writeStored(credentials) {
  try {
    fs.writeFileSync(credentialsPath(), JSON.stringify(credentials, null, 2), 'utf8');
  } catch (err) {
    console.warn('[fcm] failed to persist credentials:', err?.message || err);
  }
}

/** Full stored credentials (keys + gcm + fcm + persistentIds). */
function getStoredCredentials() {
  hydrateFromDisk();
  const stored = readStored();
  return stored?.credentials || null;
}

function ensurePersistentIds(credentials) {
  if (!credentials || typeof credentials !== 'object') return [];
  if (!Array.isArray(credentials.persistentIds)) {
    credentials.persistentIds = [];
  }
  return credentials.persistentIds;
}

function appendPersistentId(persistentId) {
  const id = String(persistentId || '').trim();
  if (!id) return;
  const credentials = getStoredCredentials();
  if (!credentials) return;
  const ids = ensurePersistentIds(credentials);
  if (ids.includes(id)) return;
  ids.push(id);
  writeStored(credentials);
}

/** Sync hydrate from disk into memory (instant on 2nd+ launch). */
function hydrateFromDisk() {
  if (cachedToken) return cachedToken;
  const stored = readStored();
  if (stored?.token) {
    cachedToken = stored.token;
    return cachedToken;
  }
  return null;
}

function preloadRegisterModule() {
  if (!registerFnPromise) {
    registerFnPromise = import('fcm-push-receiver')
      .then((mod) => {
        const register = mod.register || mod.default;
        if (typeof register !== 'function') {
          throw new Error('fcm-push-receiver register() not available');
        }
        return register;
      })
      .catch((err) => {
        registerFnPromise = null;
        throw err;
      });
  }
  return registerFnPromise;
}

async function registerFresh() {
  const register = await preloadRegisterModule();
  const firebase = firebaseConfig();
  const config = { firebase };
  const vapid = vapidKey();
  if (vapid) config.vapidKey = vapid;

  const credentials = await register(config);
  const token = String(credentials?.fcm?.token || '').trim();
  if (!token) {
    throw new Error('FCM registration returned an empty token');
  }
  writeStored(credentials);
  return token;
}

/**
 * Returns a real FCM registration token (cached on disk after first success).
 * Concurrent callers share one in-flight Google registration.
 * @returns {Promise<{ ok: boolean, fcmToken?: string, message?: string }>}
 */
async function getFcmToken(opts = {}) {
  const force = Boolean(opts.force);
  if (!force) {
    const hit = hydrateFromDisk();
    if (hit) return { ok: true, fcmToken: hit };
  }

  if (inflight) return inflight;

  // Start ESM prefetch immediately while register path runs.
  preloadRegisterModule().catch(() => {});

  inflight = (async () => {
    try {
      const token = await registerFresh();
      cachedToken = token;
      console.log('[fcm] registered token length=', token.length);
      return { ok: true, fcmToken: token };
    } catch (error) {
      const message =
        error?.message ||
        String(error) ||
        'Failed to register FCM token';
      console.warn('[fcm] registration failed:', message);
      return { ok: false, message };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Kick off FCM registration in the background (app ready / splash / login mount).
 * Safe to call repeatedly — joins cache or the same in-flight promise.
 */
function warmFcmToken() {
  warmed = true;
  // Disk hit: nothing to do.
  try {
    if (hydrateFromDisk()) return;
  } catch {
    // app path may be unavailable before ready — ignore
  }
  preloadRegisterModule().catch(() => {});
  void getFcmToken({}).then((res) => {
    if (res?.ok) {
      console.log('[fcm] warm ready');
    } else {
      console.warn('[fcm] warm failed:', res?.message || 'unknown');
    }
  });
}

function isWarmed() {
  return warmed || Boolean(cachedToken) || Boolean(inflight);
}

module.exports = {
  getFcmToken,
  warmFcmToken,
  isWarmed,
  firebaseConfig,
  getStoredCredentials,
  ensurePersistentIds,
  appendPersistentId,
};
