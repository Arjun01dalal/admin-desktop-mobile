---
name: Mobile app shared-logic sync
description: How mobile/ (Expo RN) stays in sync with the desktop Electron app and how to preview it on Replit
---
- `mobile/scripts/sync-shared.cjs` regenerates mobile copies of the API registry, permissions, navItems, and caller-role constants from the desktop sources. **Re-run it after any change to `electron/secure/registry.cjs`, `src/auth/permissions.ts`, or `src/layout/navItems.ts`** — never hand-edit the generated files.
- **Why:** desktop and mobile must call the same endpoints with identical crypto (CryptoJS passphrase AES, `{token: encrypt(payload)}` bodies, `data.data` decrypt + `.payload` unwrap). Duplicated hand-written copies drift.
- Shared desktop code runs on RN thanks to `mobile/src/lib/webShim.ts` (sync localStorage backed by AsyncStorage, hydrated at startup; minimal window/Event shims).
- Registry entries with `{type:'local'}` are Electron-only (dialler etc.) — the mobile client rejects them.
- Expo web preview on Replit: workflow must use `CI=1 npx expo start --web --port 5000`; without CI=1 Expo calls xdg-open and the workflow fails (no display server).
- Mobile config comes from `mobile/.env` → `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_ENTK_VALUE` (gitignored; see mobile/.env.example). Note: EXPO_PUBLIC_* values are extractable from the app bundle, same trade-off as the desktop embedded config.
