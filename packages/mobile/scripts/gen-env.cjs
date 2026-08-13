/**
 * Generate mobile/.env from the desktop app's config.
 * Reads either the root .env (dev) or packages/desktop/electron/env.generated.cjs (embedded build values),
 * and writes EXPO_PUBLIC_* equivalents for the mobile app.
 *
 * Run from repo root: `node mobile/scripts/gen-env.cjs`
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
let base = '';
let entk = '';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^['"]|['"]$/g, '').trim();
    if (m[1] === 'API_BASE_URL' || m[1] === 'EXPO_PUBLIC_API_BASE_URL') base = base || val;
    if (m[1] === 'ENTK_VALUE' || m[1] === 'EXPO_PUBLIC_ENTK_VALUE') entk = entk || val;
  }
}

// 1) Prefer desktop .env (same secrets as Electron).
readEnvFile(path.join(ROOT, 'packages', 'desktop', '.env'));
// 2) Fall back to repo-root .env.
readEnvFile(path.join(ROOT, '.env'));

// 3) Fall back to the embedded (self-decoding) build config.
if (!base || !entk) {
  try {
    const embedded = require(path.join(ROOT, 'packages/desktop/electron/env.generated.cjs'));
    base = base || embedded.API_BASE_URL;
    entk = entk || embedded.ENTK_VALUE;
  } catch {
    /* not generated */
  }
}

if (!base || !entk) {
  console.error(
    'Could not find API_BASE_URL / ENTK_VALUE.\n' +
      'Create packages/desktop/.env (see packages/desktop/.env.example) or a root .env, then re-run.',
  );
  process.exit(1);
}

const out = path.join(ROOT, 'packages', 'mobile', '.env');
fs.writeFileSync(out, `EXPO_PUBLIC_API_BASE_URL=${base}\nEXPO_PUBLIC_ENTK_VALUE=${entk}\n`);
console.log('Wrote mobile/.env');
