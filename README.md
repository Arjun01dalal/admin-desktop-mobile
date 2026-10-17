# Astro Platform (monorepo)

npm workspaces monorepo for Astro clients.

```text
packages/
  desktop/   @astro/desktop  — Electron CS Panel (full app)
  mobile/    @astro/mobile   — mobile scaffold (Expo/RN later)
  shared/    @astro/shared   — safe shared types/constants
docs/                      — PM / engineering docs
```

## Setup

```bash
npm install

# Desktop secrets (required for panel)
cp packages/desktop/.env.example packages/desktop/.env
# edit API_BASE_URL and ENTK_VALUE
```

## Commands (from repo root)

```bash
npm run desktop:dev          # Vite + Electron hot reload
npm run desktop:dist:mac     # mac installer
npm run desktop:dist:win     # Windows installer
npm run sos-push             # optional SOS relay
npm run mobile:start         # mobile scaffold placeholder
npm run typecheck            # TypeScript checks for all packages
npm run lint                 # ESLint checks for all packages
npm run format:check         # Prettier check for source/config files
```

You can also run inside a package:

```bash
npm run dev -w @astro/desktop
```

## Package rules

| Package | Owns | Must not contain |
|---------|------|------------------|
| `@astro/desktop` | Electron main, preload, panel UI, SOS, cert pin | Mobile UI |
| `@astro/mobile` | Future RN/Expo app | Electron IPC / ENTK |
| `@astro/shared` | Types, client name codes | Secrets, Electron APIs |

## Code conventions

- Desktop UI uses MUI as the primary component and styling system; the small
  `components/ui` layer is retained only for shared compatibility components.
- Mobile and shared business logic belongs in feature folders or shared modules,
  not inside screen render functions.
- Application network calls go through the package API client or a named,
  allowlisted external-service adapter. Screens should not construct external
  URLs directly.
- New API responses should use typed DTOs and validate untrusted response data
  before it reaches financial, KYC, or permission-sensitive flows.
- Run `npm run format` before review. Generated APKs, build output, and
  TypeScript build metadata are ignored by Git.

## Docs

- [PM overview](docs/PM-Astro-CS-Panel-Overview.md)
- [Desktop README](packages/desktop/README.md)
