# Astro Admin Panel

Electron desktop app (React 18 + Vite + MUI v6, TypeScript) that opens as a calculator; typing `9100` + `=` reveals a secure admin login (mobile OTP + location check), then a fullscreen admin panel.

## Structure
- `electron/` — main process (`main.cjs`), preload, auth, geoip location, `secure/` (encrypted API bridge)
- `src/` — React renderer (screens, components, controllers, api, hooks)
- `build/icon.png` — app icon used by electron-builder and the BrowserWindow
- Secrets (`API_BASE_URL`, `ENTK_VALUE`) live only in `.env`, loaded by the main process (see `.env.example`)

## Running
- Electron cannot run on Replit (no display server). The renderer alone: `npx vite`.
- Local dev: `npm run dev` (Vite + Electron). Packaged build: `npm start`. Installers: `npm run dist:mac` / `dist:win` → `release/`.
- Installers compile the main process to V8 bytecode (`scripts/compile-bytecode.cjs` → `electron-obf/*.jsc` via bytenode); the packaged app's entry point is `electron-obf/main.cjs` (build.extraMetadata.main). Must run on a real mac/win machine — Electron cannot run on Replit. `preload.cjs` ships as plain source (sandboxed preload can't load bytenode).
- `package.json` has an npm override pinning `tar` to `^7` because `tar@6.2.1` is blocked by Replit's package firewall.

## User preferences
- Product name: "Astro Admin Panel".
