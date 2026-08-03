const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');
const dotenv = require('dotenv');

function resolveEnvPath() {
  const candidates = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(process.resourcesPath || '', '.env'),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

const envPath = resolveEnvPath();
if (envPath) {
  dotenv.config({ path: envPath });
}

// Packaged builds embed values at build time (see scripts/generate-embedded-env.cjs)
// instead of shipping a plaintext .env in the installer's Resources folder.
let embedded = {};
try {
  embedded = require('./env.generated.cjs');
} catch {
  // Not generated — fine in dev, where .env is loaded above.
}

function requireEnv(name) {
  const value = process.env[name] || embedded[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Add it to .env (see .env.example).`);
  }
  return value;
}

function optionalEnv(name) {
  return process.env[name] || embedded[name] || '';
}

module.exports = {
  getApiBaseUrl: () => requireEnv('API_BASE_URL'),
  getEntkValue: () => requireEnv('ENTK_VALUE'),
  /** Read-only GitHub token for private-repo auto-update checks (optional). */
  getGhUpdateToken: () => optionalEnv('GH_UPDATE_TOKEN'),
  /** ntfy topic for SOS push (optional — enables cross-device alerts). */
  getSosPushTopic: () => optionalEnv('SOS_PUSH_TOPIC'),
  getSosPushServer: () => optionalEnv('SOS_PUSH_SERVER') || 'https://ntfy.sh',
  optionalEnv,
  // Only true when launched via `npm run dev` (Vite server running).
  useViteDevServer: process.env.ELECTRON_DEV === '1',
  isPackaged: app.isPackaged,
};
