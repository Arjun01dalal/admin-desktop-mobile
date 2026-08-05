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
