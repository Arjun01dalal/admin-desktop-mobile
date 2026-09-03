/**
 * electron-builder (NSIS) needs a writable temp dir. Sandboxed shells and some
 * IDE terminals expose /var/folders/zz/... which returns EACCES on mkdtemp.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const tmpDir = path.join(root, '.tmp');
fs.mkdirSync(tmpDir, { recursive: true });

const command = process.argv.slice(2).join(' ').trim();
if (!command) {
  console.error('Usage: node scripts/run-with-build-tmp.cjs "<shell command>"');
  process.exit(1);
}

const result = spawnSync(command, {
  shell: true,
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, TMPDIR: tmpDir, TEMP: tmpDir, TMP: tmpDir },
});

process.exit(result.status ?? 1);
