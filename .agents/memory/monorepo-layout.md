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
The mobile app (Expo/RN) needs React 19 while desktop needs React 18; in npm workspaces both hoist to root, and `react-native-web` (root) then pulls React 18 → web crashes ("Objects are not valid as a React child" / "ReactCurrentDispatcher" undefined).
**Why:** two React copies in one bundle. **How to apply:** the mobile Metro config force-resolves react/react-dom/react-native (and subpaths) to mobile's own node_modules; if you ever bump RN/React versions, re-verify both web and native bundles still start.

## freeRASP SDK contract (native security)
freerasp-react-native v4 uses the `useFreeRasp(config, actions)` hook (there is no `start()`), and config fields are singular iOS `appBundleId`/`appTeamId` + Android `supportedAlternativeStores`. Native-only code must live in `*.native.ts` files with a no-op default sibling so web bundling never pulls the native module. Root/hook/tamper threats should be sticky (never un-flagged); VPN can toggle.
