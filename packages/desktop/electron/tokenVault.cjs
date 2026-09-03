/**
 * OS-backed session token vault (Electron safeStorage).
 * Session tokens are never persisted when OS encryption is unavailable.
 *
 * Skip redundant writeFileSync when the in-memory token is unchanged — on Windows,
 * Defender/AV often freezes Electron's main process on every sync token write.
 */
const { safeStorage, app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

/** Last value we already synced to disk (or intentionally left memory-only). */
let lastSyncedToken = undefined;

function tokenPath() {
  return path.join(app.getPath('userData'), 'session.token');
}

/** Legacy plaintext path used by older SOS persistence. */
function legacyTokenPath() {
  return path.join(app.getPath('userData'), 'sos-session.token');
}

function encryptAvailable() {
  try {
    return Boolean(safeStorage?.isEncryptionAvailable?.());
  } catch {
    return false;
  }
}

function writeToken(token) {
  const value = String(token || '').trim();
  if (lastSyncedToken === value) {
    const encrypted = Boolean(value) && encryptAvailable();
    return {
      ok: !value || encrypted,
      encrypted,
      skipped: true,
    };
  }

  const dest = tokenPath();
  if (!value) {
    try {
      fs.rmSync(dest, { force: true });
    } catch {
      // ignore
    }
    try {
      fs.rmSync(legacyTokenPath(), { force: true });
    } catch {
      // ignore
    }
    lastSyncedToken = '';
    return { ok: true, encrypted: false };
  }

  if (encryptAvailable()) {
    try {
      const buf = safeStorage.encryptString(value);
      fs.writeFileSync(dest, buf, { mode: 0o600 });
      try {
        fs.chmodSync(dest, 0o600);
      } catch {
        // ignore platform/filesystem permission limitations
      }
      // Remove legacy plaintext if present.
      try {
        fs.rmSync(legacyTokenPath(), { force: true });
      } catch {
        // ignore
      }
      lastSyncedToken = value;
      return { ok: true, encrypted: true };
    } catch (err) {
      console.warn('[tokenVault] encrypted token write failed:', err?.message || err);
      try {
        fs.rmSync(dest, { force: true });
        fs.rmSync(legacyTokenPath(), { force: true });
      } catch {
        // ignore cleanup failures
      }
      return {
        ok: false,
        encrypted: false,
        message: 'OS secure storage is unavailable; token was not persisted',
      };
    }
  }

  // Never create a plaintext fallback. Memory-only sessions remain supported.
  try {
    fs.rmSync(dest, { force: true });
    fs.rmSync(legacyTokenPath(), { force: true });
  } catch {
    // ignore cleanup failures
  }
  // Remember value so we don't hammer rmSync/encrypt checks on every API call.
  lastSyncedToken = value;
  return {
    ok: false,
    encrypted: false,
    message: 'OS secure storage is unavailable; token was not persisted',
  };
}

function readToken() {
  try {
    const dest = tokenPath();
    if (fs.existsSync(dest)) {
      const raw = fs.readFileSync(dest);
      if (encryptAvailable()) {
        try {
          const text = safeStorage.decryptString(raw).trim();
          if (text) {
            lastSyncedToken = text;
            return text;
          }
          return null;
        } catch {
          // Do not accept a plaintext or corrupt token file.
          try {
            fs.rmSync(dest, { force: true });
          } catch {
            // ignore cleanup failures
          }
          lastSyncedToken = '';
          return null;
        }
      }
      // Encryption is unavailable, so an existing file is not trusted.
      try {
        fs.rmSync(dest, { force: true });
      } catch {
        // ignore cleanup failures
      }
      lastSyncedToken = '';
      return null;
    }

    // Migrate legacy SOS plaintext token once.
    const legacy = legacyTokenPath();
    if (fs.existsSync(legacy)) {
      const text = fs.readFileSync(legacy, 'utf8').trim();
      if (text) {
        try {
          const result = writeToken(text);
          return result.ok && result.encrypted ? text : null;
        } catch {
          return null;
        }
      }
    }
  } catch (err) {
    console.warn('[tokenVault] read failed:', err?.message || err);
  }
  return null;
}

function clearToken() {
  return writeToken('');
}

module.exports = {
  readToken,
  writeToken,
  clearToken,
  encryptAvailable,
};
