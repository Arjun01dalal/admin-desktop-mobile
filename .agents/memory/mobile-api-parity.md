---
name: Mobile secureApi parity
description: Mobile api/client.ts must mirror desktop electron/secure/index.cjs exactly
---
The mobile `secureApi` (packages/mobile/src/api/client.ts) is a hand-port of desktop `electron/secure/index.cjs execute()`. Any behavior in the desktop bridge must be mirrored or mobile screens silently show no data.
**Why:** Live Match showed no data because mobile didn't handle two desktop behaviors: registry paths can be absolute URLs (other backends like aaryapaar.exchange — don't prefix the base URL), and GET payloads go into the query string (startDate/endDate).
**How to apply:** When a mobile screen shows empty data but desktop works, diff client.ts against the desktop bridge first (URL building, GET params, array unwrap special-cases, keepDataEnvelope).
