# @astro/shared

Safe shared code for Astro **desktop** and **mobile**.

## Layout

```text
src/
  clientNames.ts     # app / client codes
  api/
    types.ts         # ApiResult, ApiTransport
    actions.ts       # shared action name constants
    parse.ts         # unpackPayload, asPaged
    sos.ts           # isSosFlagEnabled, getSosBlock
    createApi.ts     # createAstroApi(transport) — business ops once
```

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
