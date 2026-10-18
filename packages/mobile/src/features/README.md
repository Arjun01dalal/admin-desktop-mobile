# Mobile features

Feature modules own domain logic, hooks, and feature UI. Route screens under
`src/screens/` stay thin and compose features.

```
src/features/
  menu/         Welcome balance stats + nav mapping
  users/        Users modals / helpers / styles
  withdrawal/   Withdrawal workflows + UI pieces
  theme/        ThemeProvider + useStyles (runtime theme)
```

## Rules

1. **Screens import features** — not the other way around (except shared panel chrome under `screens/dashboards/details` until those move to `components/`).
2. Prefer `@features/<name>` and `@/` path aliases over deep `../../../` imports.
3. New styles that must follow theme changes: use `useStyles` from `@features/theme`.
4. Pure helpers (nav maps, param merges) live next to the feature and are unit-tested.
5. **Data fetching:** use `useScreenQuery` (wraps TanStack Query + focus refetch).
   Page focus and pull-to-refresh must hit the network (`staleTime: 0`, `gcTime: 0`).
   Do not show Balance / CX / Withdrawal lists from stale cache.
6. **Observability:** `ErrorBoundary` + optional Sentry (`EXPO_PUBLIC_SENTRY_DSN`).
7. **Route screens** should not call `secureApi` directly — put fetches in `features/*/fetch*.ts`.

## Migration

Move one domain at a time: `screens/<domain>/*` → `features/<domain>/`, update
imports, add a barrel `index.ts`, keep the route `*Screen.tsx` in `screens/`.
