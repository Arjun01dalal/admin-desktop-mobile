/**
 * Certificate pinning for main-process HTTPS calls to the app's API.
 *
 * Even with an obfuscated config, anyone can route the installed app through a
 * proxy (Charles / mitmproxy) and read every URL and payload. Pinning makes the
 * app refuse the connection when the TLS chain does not match, so intercepting
 * proxies (which present their own certificate) are rejected — failing closed.
 *
 * We pin the SubjectPublicKeyInfo (SPKI) SHA-256 hash, NOT the leaf certificate
 * itself. The API (laxminarayan.live) uses a Sectigo-issued wildcard cert; when
 * it renews, the leaf changes but the public key usually stays the same. We also
 * include the intermediate CA's SPKI as a backup pin so a key rotation at renewal
 * does not brick installed apps. If the leaf is re-keyed, the chain still validates
 * against the pinned intermediate.
 *
 * SPKI hashes below were captured from laxminarayan.live:443 and can be
 * re-generated with:
 *   openssl s_client -servername HOST -connect HOST:443 -showcerts </dev/null \
 *     | openssl x509 -noout -pubkey \
 *     | openssl pkey -pubin -outform der \
 *     | openssl dgst -sha256 -binary | openssl enc -base64
 */
const https = require('node:https');
const tls = require('node:tls');
const crypto = require('node:crypto');

// Host whose traffic must be pinned. Subdomains of this host are covered too.
const PINNED_HOST = 'laxminarayan.live';

// Accepted SPKI SHA-256 hashes (base64). Any one matching in the presented
// chain is sufficient. Keep the intermediate as a backup for leaf renewals.
const PINNED_SPKI_SHA256 = new Set([
  'gF86/4V6toOdUboSdnEP/CwGTeeMs/egiSRZvTb6ZZs=', // leaf: CN=*.laxminarayan.live
  'a9khLOZJxlnJyrxstg/P+seiDCm+Yf3OsrXyFocBaI0=', // intermediate: Sectigo ... CA DV R36 (backup)
]);

function spkiHash(cert) {
  if (!cert || !cert.pubkey) return null;
  return crypto.createHash('sha256').update(cert.pubkey).digest('base64');
}

function isPinnedHost(host) {
  if (typeof host !== 'string') return false;
  const h = host.toLowerCase();
  return h === PINNED_HOST || h.endsWith(`.${PINNED_HOST}`);
}

/**
 * Walk the presented certificate chain and return true if any node's SPKI hash
 * is in the pinned set.
 */
function chainMatchesPin(leaf) {
  const seen = new Set();
  let cert = leaf;
  while (cert && typeof cert === 'object') {
    const hash = spkiHash(cert);
    if (hash && PINNED_SPKI_SHA256.has(hash)) return true;
    // Avoid infinite loops on the self-signed root (issuerCertificate === self).
    if (!cert.fingerprint256 || seen.has(cert.fingerprint256)) break;
    seen.add(cert.fingerprint256);
    if (cert.issuerCertificate === cert) break;
    cert = cert.issuerCertificate;
  }
  return false;
}

/**
 * checkServerIdentity that first runs Node's default hostname verification, then
 * enforces the SPKI pin for the pinned host. Returns an Error to reject (fail
 * closed) or undefined to accept.
 */
function checkServerIdentity(host, cert) {
  const defaultError = tls.checkServerIdentity(host, cert);
  if (defaultError) return defaultError;

  if (!isPinnedHost(host)) return undefined;

  if (!chainMatchesPin(cert)) {
    return new Error(
      `Certificate pin mismatch for ${host}: connection refused (possible interception).`,
    );
  }
  return undefined;
}

/**
 * https.Agent that enforces the pin. Attach as axios `httpsAgent`. The agent
 * requests the full chain so intermediate/backup pins can be validated.
 */
function createPinnedAgent() {
  return new https.Agent({
    keepAlive: true,
    checkServerIdentity,
  });
}

module.exports = {
  PINNED_HOST,
  PINNED_SPKI_SHA256,
  checkServerIdentity,
  createPinnedAgent,
};
