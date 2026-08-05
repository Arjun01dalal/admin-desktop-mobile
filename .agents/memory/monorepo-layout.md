---
name: Monorepo layout
description: Post-v2.0.0 repo structure and how preview behaves on Replit.
---

The user's repo (remote `arjun` = Arjun01dalal/admin-desktop-mobile, mirrored to origin Logicaces) became an npm-workspaces monorepo at v2.0.0: `packages/desktop` (Electron + Vite app), `packages/shared` (API types/client helpers), `packages/mobile` (empty scaffold only).

**Why it matters:**
- Run the preview with vite from `packages/desktop` on 0.0.0.0:5000 (its vite.config binds 127.0.0.1:5173 by default). Electron itself cannot run on Replit.
- In a plain browser (no Electron bridge) the app deliberately shows "Loading Astro Admin…" then redirects to astrotalk.vip — that is the disguise, not a bug. The real panel only works inside Electron.
- Root package.json needs the `overrides: { tar: "^7.4.3" }` firewall workaround; upstream pulls tend to drop it — re-add after pulls if npm install 403s on tar 6.x.

**How to apply:** After every `git pull` from arjun/main, check the override survives, `npm install` at repo root, and restart the workflow.

## Single-React rule for packages/mobile
The mobile app (Expo/RN) needs React 19; desktop needs React 18. In npm workspaces both hoist to root, and `react-native-web` (hoisted to root) then pulls React 18 → web crashes with "Objects are not valid as a React child" / "Cannot read properties of undefined (reading 'ReactCurrentDispatcher')".
**Fix:** `packages/mobile/metro.config.js` has a `resolver.resolveRequest` that forces `react`, `react-dom`, `react-native` **and their subpaths** (e.g. react-dom/client) to resolve from `packages/mobile/node_modules`. Never remove it. Env values for mobile come from `packages/mobile/.env` (gitignored) via `node packages/mobile/scripts/gen-env.cjs`.
