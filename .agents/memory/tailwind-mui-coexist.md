---
name: Tailwind + MUI coexistence
description: How new shadcn/Tailwind pages live alongside the original MUI screens without restyling them
---
- New admin pages use Tailwind + shadcn; original screens stay on MUI (Material UI). Both render in the same Electron/Vite app.
- **Rule:** Tailwind preflight is OFF (`corePlugins.preflight: false` in tailwind.config.js). Turning it on resets MUI's base styles and breaks every existing screen.
- **Why:** user requirement — do not change existing code/appearance while adding new features.
- **How to apply:** shadcn components + design tokens live in `src/components/ui/` and `src/styles/tailwind.css` (HSL CSS vars). New dashboard pages under `src/screens/panel/dashboards/` fetch via the existing secure IPC bridge (`secureApi`), not axios.
- Adding a backend-backed page = register the endpoint in BOTH `electron/secure/registry.cjs` and the `SECURE_ACTIONS` list in `src/api/secureActions.ts` (they must stay in sync), then call `useSecureQuery(action, payload)`.
- Dashboard metric field paths were mapped from the admin-panel-domains zip response shapes and may need tuning against live API responses (verify with the app logged in).
