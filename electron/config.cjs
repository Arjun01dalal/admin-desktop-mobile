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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Add it to .env (see .env.example).`);
  }
  return value;
}

module.exports = {
  getApiBaseUrl: () => requireEnv('API_BASE_URL'),
  getEntkValue: () => requireEnv('ENTK_VALUE'),
  // Only true when launched via `npm run dev` (Vite server running).
  useViteDevServer: process.env.ELECTRON_DEV === '1',
  isPackaged: app.isPackaged,
};
