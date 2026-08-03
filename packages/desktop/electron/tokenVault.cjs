/**
 * OS-backed session token vault (Electron safeStorage).
 * Plaintext token file is encrypted at rest when the OS keychain is available.
 */
const { safeStorage, app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

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
    return { ok: true, encrypted: false };
  }

  if (encryptAvailable()) {
    const buf = safeStorage.encryptString(value);
    fs.writeFileSync(dest, buf);
    // Remove legacy plaintext if present.
    try {
      fs.rmSync(legacyTokenPath(), { force: true });
    } catch {
      // ignore
    }
    return { ok: true, encrypted: true };
  }

  // Fallback (rare Linux setups without keyring) — still better than localStorage alone.
  fs.writeFileSync(dest, value, 'utf8');
  return { ok: true, encrypted: false };
}

function readToken() {
  try {
    const dest = tokenPath();
    if (fs.existsSync(dest)) {
      const raw = fs.readFileSync(dest);
      if (encryptAvailable()) {
        try {
          const text = safeStorage.decryptString(raw).trim();
          return text || null;
        } catch {
          // Maybe written as plaintext fallback.
          const text = raw.toString('utf8').trim();
          return text || null;
        }
      }
      const text = raw.toString('utf8').trim();
      return text || null;
    }

    // Migrate legacy SOS plaintext token once.
    const legacy = legacyTokenPath();
    if (fs.existsSync(legacy)) {
      const text = fs.readFileSync(legacy, 'utf8').trim();
      if (text) {
        writeToken(text);
        return text;
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
