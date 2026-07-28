#!/usr/bin/env node
/**
 * Verify that the SPKI pins shipped in electron/certPin.cjs still match the
 * live certificate chain served by the API host.
 *
 * Usage:
 *   node scripts/check-cert-pins.cjs          # check the default pinned host
 *   node scripts/check-cert-pins.cjs api.laxminarayan.live
 *
 * Exit codes:
 *   0 — at least one live certificate matches a shipped pin (safe to ship)
 *   1 — NO live certificate matches the shipped pins (installed apps will
 *       fail closed; rotate pins per docs/cert-pin-rotation.md)
 *   2 — could not reach the host (network/TLS error) — result unknown
 *
 * Run this:
 *   - before every release (`npm run check:pins`, part of `npm run dist`)
 *   - after any certificate renewal on the server
 */
const {
  PINNED_HOST,
  PINNED_SPKI_SHA256,
  verifyPinsAgainstLive,
} = require('../electron/certPin.cjs');

const host = process.argv[2] || PINNED_HOST;

(async () => {
  console.log(`Checking live certificate chain for ${host}:443 ...`);
  console.log('Shipped pins:');
  for (const pin of PINNED_SPKI_SHA256) console.log(`  - ${pin}`);
  console.log('');

  let result;
  try {
    result = await verifyPinsAgainstLive(host);
  } catch (err) {
    console.error(`ERROR: could not fetch live chain: ${err.message}`);
    process.exit(2);
  }

  console.log('Live chain:');
  for (const cert of result.chain) {
    const match = cert.spkiSha256 && PINNED_SPKI_SHA256.has(cert.spkiSha256);
    console.log(
      `  ${match ? '[PINNED]  ' : '[unpinned]'} ${cert.subject}` +
        ` | issuer: ${cert.issuer} | expires: ${cert.validTo}`,
    );
    console.log(`             SPKI SHA-256: ${cert.spkiSha256}`);
  }
  console.log('');

  if (result.ok) {
    console.log(
      `OK: ${result.matchedHashes.length} certificate(s) in the live chain match the shipped pins.`,
    );
    process.exit(0);
  }

  console.error(
    'FAIL: no certificate in the live chain matches the shipped pins.\n' +
      'Installed apps will refuse to talk to the API (fail closed).\n' +
      'Rotate the pins: copy the SPKI SHA-256 hashes printed above into\n' +
      'PINNED_SPKI_SHA256 in electron/certPin.cjs, then ship an app update.\n' +
      'See docs/cert-pin-rotation.md for the full process.',
  );
  process.exit(1);
})();
