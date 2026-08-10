---
name: Package firewall workarounds
description: How blocked npm package versions were resolved in this repl, and Electron limits
---
- `npm install` failed with 403 "Blocked by Security Policy" on `tar@6.2.1` (transitive dep of electron/electron-builder).
- **Fix:** `"overrides": { "tar": "^7.4.3" }` in package.json; install then succeeds.
- **How to apply:** if a transitive package version is firewall-blocked, add an npm override to a newer version instead of downgrading top-level deps.
- Electron cannot launch on Replit (no display server); verify via `npx tsc --noEmit` and `npx vite build` only. Note: repo has pre-existing tsc errors in CallerResponsibilityPage.tsx unrelated to setup.

## EAS builds vs lockfile firewall URLs
package-lock.json generated inside Replit resolves packages to `http://package-firewall.replit.local/npm/...`, which EAS cloud builders cannot reach — `npm ci` dies with "Exit handler never called". **Fix:** `sed -i 's|http://package-firewall.replit.local/npm|https://registry.npmjs.org|g' package-lock.json` before any EAS build. Any npm install in Replit re-introduces firewall URLs, so re-run the sed after dependency changes. Also pin Node in eas.json (`"node": "24.13.0"` in the preview profile) to match the local npm/lockfile version.
