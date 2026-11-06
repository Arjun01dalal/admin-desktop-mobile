#!/usr/bin/env node
/**
 * Full Android Stallion OTA pipeline:
 *   1) expo export:embed
 *   2) stallion publish-bundle
 *   3) stallion release-bundle → native app version (package.json)
 *
 * Publish alone is NOT enough — devices only see updates after release-bundle
 * targets the installed native version (e.g. 1.1.1).
 *
 * Requires:
 *   - Stallion CLI login (`npx stallion login`) OR STALLION_CI_TOKEN (stl_…)
 *   - STALLION_PROJECT_ID, STALLION_UPLOAD_PATH in .env
 *   - For step 3: STALLION_CI_TOKEN (release-bundle always needs x-ci-token)
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appVersion = String(process.env.STALLION_APP_VERSION || pkg.version || '').trim();

function loadEnvFile() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function run(command, args, opts = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const res = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    ...opts,
  });
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
  return res;
}

function runCapture(command, args) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const res = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
    process.exit(res.status || 1);
  }
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  process.stdout.write(out);
  return out;
}

loadEnvFile();

const uploadPath = String(process.env.STALLION_UPLOAD_PATH || 'pixelastro/astroadmin/production').trim();
const projectId = String(process.env.STALLION_PROJECT_ID || '').trim();
const ciToken = String(process.env.STALLION_CI_TOKEN || '').trim();
const releaseNote =
  String(process.env.STALLION_RELEASE_NOTE || '').trim() ||
  `v${appVersion} OTA ${new Date().toISOString().slice(0, 10)}`;

if (!appVersion) {
  console.error('Missing app version (package.json version / STALLION_APP_VERSION).');
  process.exit(1);
}
if (!projectId) {
  console.error('Missing STALLION_PROJECT_ID in .env');
  process.exit(1);
}
if (!ciToken) {
  console.error(
    [
      'Missing STALLION_CI_TOKEN.',
      'Stallion release-bundle requires a dashboard CI token (stl_ap_… / stl_us_…).',
      'Add it to packages/mobile/.env then re-run: npm run ota:android',
      'Publish without release will NOT reach devices on a specific app version.',
    ].join('\n'),
  );
  process.exit(1);
}
if (ciToken.startsWith('eyJ')) {
  console.error('STALLION_CI_TOKEN looks like a login JWT. Use the dashboard CI token instead.');
  process.exit(1);
}

fs.mkdirSync(path.join(root, 'build-android'), { recursive: true });

console.log(`Android OTA → native app version ${appVersion}`);
console.log(`Upload path: ${uploadPath}`);

run('npm', ['run', 'ota:export:android']);

const publishArgs = [
  'stallion',
  'publish-bundle',
  '--upload-path',
  uploadPath,
  '--platform',
  'android',
  '--custom-bundle-path',
  'build-android',
  '--release-note',
  releaseNote,
];
// CI token works for publish too (skips interactive login).
publishArgs.push('--ci-token', ciToken);

const publishOut = runCapture('npx', publishArgs);
const hashMatch = publishOut.match(/Published bundle hash:\s*([a-f0-9]{64})/i);
if (!hashMatch) {
  console.error('Could not parse published bundle hash from Stallion output.');
  process.exit(1);
}
const hash = hashMatch[1];
console.log(`\nPublished hash: ${hash}`);

const targetVersions = Array.from(
  new Set(
    [appVersion, ...(String(process.env.STALLION_EXTRA_APP_VERSIONS || '').split(',').map((v) => v.trim()).filter(Boolean))],
  ),
);

for (const version of targetVersions) {
  // release-bundle fails with "already promoted" if the hash was linked before —
  // still continue to update-release so rollout/pause get corrected.
  const release = spawnSync(
    'npx',
    [
      'stallion',
      'release-bundle',
      '--project-id',
      projectId,
      '--hash',
      hash,
      '--app-version',
      version,
      '--release-note',
      releaseNote,
      '--ci-token',
      ciToken,
      '--is-mandatory',
      'true',
    ],
    { cwd: root, encoding: 'utf8', env: process.env, shell: process.platform === 'win32' },
  );
  const releaseOut = `${release.stdout || ''}${release.stderr || ''}`;
  process.stdout.write(releaseOut);
  if (release.status !== 0 && !/already promoted/i.test(releaseOut)) {
    process.exit(release.status || 1);
  }

  // Force 100% rollout — console promotes often land at 0% and devices never see them.
  run('npx', [
    'stallion',
    'update-release',
    '--project-id',
    projectId,
    '--hash',
    hash,
    '--ci-token',
    ciToken,
    '--rollout-percent',
    '100',
    '--is-mandatory',
    'true',
    '--is-paused',
    'false',
    '--release-note',
    releaseNote,
  ]);
  console.log(`Released + 100% rollout → app version ${version}`);
}

console.log(`\nDone. Hash ${hash.slice(0, 12)}… → ${targetVersions.join(', ')}`);
console.log('On device: force-close the production APK and reopen (not Metro / debug).');
