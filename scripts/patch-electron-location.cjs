/**
 * Electron.app ships without location usage strings, so macOS never shows a
 * location permission dialog and navigator.geolocation times out.
 * Run after every `npm install`.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const plist = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist',
);

const MESSAGE = 'Location is required to verify admin login.';

if (!fs.existsSync(plist)) {
  console.warn('[patch-electron-location] Electron.app Info.plist not found — skip');
  process.exit(0);
}

function setPlistKey(key, value) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], {
      stdio: 'pipe',
    });
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], {
      stdio: 'inherit',
    });
  } catch {
    execFileSync(
      '/usr/libexec/PlistBuddy',
      ['-c', `Add :${key} string ${value}`, plist],
      { stdio: 'inherit' },
    );
  }
}

try {
  setPlistKey('NSLocationUsageDescription', MESSAGE);
  setPlistKey('NSLocationWhenInUseUsageDescription', MESSAGE);
  setPlistKey('NSLocationAlwaysAndWhenInUseUsageDescription', MESSAGE);
  console.log('[patch-electron-location] Added location usage keys to Electron.app');
} catch (err) {
  console.warn('[patch-electron-location] Failed:', err.message);
  process.exit(0);
}
