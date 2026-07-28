# Certificate pin rotation — keeping installed apps working across cert renewals

The Electron main process pins the API host's public keys (SPKI SHA-256) in
`electron/certPin.cjs` (`PINNED_SPKI_SHA256`). If the server's live chain ever
stops matching those pins, every installed app **fails closed** — all API
calls are refused. This document is the process that prevents that.

## Why renewals usually don't break anything

- We pin the **public key** (SPKI), not the certificate bytes. Normal ~90-day
  renewals reuse the same key, so the leaf pin keeps matching.
- We also pin the **Sectigo intermediate CA** as a backup. Even if the leaf is
  re-keyed, the chain still matches as long as the issuer stays the same.

The only dangerous event is: **leaf re-keyed AND issuing CA changed** (e.g.
switching from Sectigo to Let's Encrypt). That breaks both pins at once.

## Automated safeguards

1. **Pre-release gate** — `npm run check:pins` (also runnable as
   `node scripts/check-cert-pins.cjs [host]`) connects to the live host,
   prints the full chain with SPKI hashes, and exits non-zero if no pin
   matches. Run it before every release; a failure means the build you're
   about to ship would be dead on arrival.
2. **Startup health check** — on app launch, `startupPinHealthCheck()` in
   `electron/certPin.cjs` compares the live chain to the shipped pins in the
   background and logs `[certPin] PIN MISMATCH` if a bad rotation happened.
   It never blocks or crashes the app, and network errors are only warnings.

## Rotation process (server certificate renewal)

**Before renewing** (or immediately after):

1. Run `npm run check:pins`.
2. If it prints `OK`, nothing to do — the pins survived the renewal.
3. If it prints `FAIL`:
   - Copy the SPKI SHA-256 hashes it printed for the new **leaf** and
     **intermediate** into `PINNED_SPKI_SHA256` in `electron/certPin.cjs`.
     Keep the old pins in the set during the transition so both old and new
     builds work while the update rolls out.
   - Re-run `npm run check:pins` to confirm it now passes.
   - Ship an app update (`npm run release`) so installed apps pick up the new
     pins via auto-update.
   - After the fleet has updated, remove the retired pins in a later release.

**Planned re-key / CA change:** add the *future* cert's pins alongside the
current ones and ship that update **before** switching certs on the server.
Overlapping pins are the whole point of pinning a `Set`.

## Regenerating a hash manually

```sh
openssl s_client -servername HOST -connect HOST:443 -showcerts </dev/null \
  | openssl x509 -noout -pubkey \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary | openssl enc -base64
```
