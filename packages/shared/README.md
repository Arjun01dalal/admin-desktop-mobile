# @astro/shared

Safe shared code for Astro **desktop** and **mobile**.

## Layout

```text
src/
  clientNames.ts     # app / client codes
  permissions.ts     # Permissions enum + hasPermission / nav / SOS helpers
  callerRoles.ts     # Caller Role_ID sets (shared with permissions)
  api/
    types.ts         # ApiResult, ApiTransport
    actions.ts       # shared action name constants
    parse.ts         # unpackPayload, asPaged
    sos.ts           # isSosFlagEnabled, getSosBlock
    createApi.ts     # createAstroApi(transport) — business ops once
```

## Permissions (desktop + mobile)

```ts
// Edit once:
//   packages/shared/src/permissions.ts

// Desktop / mobile thin adapters (session storage only):
import { Permissions, hasPermission } from '@/auth/permissions'; // desktop
import { Permissions, hasPermission } from '../auth/permissions'; // mobile
```

Platform adapters in `packages/desktop|mobile/src/auth/permissions.ts` only wire
`localStorage` / session user. Do **not** copy permissions via `sync-shared`.

## Pattern (no duplicated business logic)

```ts
// Desktop
import { createAstroApi } from '@astro/shared/api';
const astroApi = createAstroApi(desktopIpcTransport);
await astroApi.auth.getSosEnabled();

// Mobile (later)
const astroApi = createAstroApi(mobileHttpsTransport);
await astroApi.auth.getSosEnabled(); // same logic
```

## Allowed
- Types / DTOs / action name strings
- Parsers / payload builders
- `createAstroApi` facade

## Not allowed
- ENTK / API secrets
- Electron IPC / `window.gcalc`
- Certificate pins
