/**
 * SSL public-key pinning for the API host.
 *
 * 1. Apply bootstrap SPKI pins (same as desktop `certPin.cjs`) so the app
 *    never depends solely on a remote pin payload that could be stale/MITM'd.
 * 2. Fetch live pins from `GET /api/generate` with `stress-key` (Android OkHttp
 *    parity). Payload is nested Base64 → `{ type: "ssl", new, old }`.
 * 3. Merge valid remote pins and re-initialize the native pinner.
 *
 * Uses `react-native-ssl-public-key-pinning` (OkHttp CertificatePinner / TrustKit).
 * Requires a custom native build — skipped gracefully in Expo Go.
 */
import { Platform } from 'react-native';
import {
  initializeSslPinning,
  isSslPinningAvailable,
} from 'react-native-ssl-public-key-pinning';
import {
  getApiBaseUrl,
  getSslPinGenerateUrl,
  getSslStressKey,
} from '../config';

/** Host whose traffic must be pinned (matches desktop `PINNED_HOST`). */
export const PINNED_HOST = 'laxminarayan.live';

/**
 * Bootstrap SPKI SHA-256 hashes (base64) — live chain for laxminarayan.live.
 * Keep these even when the remote API returns additional/rotated pins.
 */
const BOOTSTRAP_SPKI_SHA256 = [
  'gF86/4V6toOdUboSdnEP/CwGTeeMs/egiSRZvTb6ZZs=', // leaf: CN=*.laxminarayan.live
  'a9khLOZJxlnJyrxstg/P+seiDCm+Yf3OsrXyFocBaI0=', // intermediate: Sectigo DV R36
] as const;

/** OkHttp / TrustKit pin: base64 of 32-byte SHA-256 → 44 chars ending in `=`. */
const PIN_RE = /^[A-Za-z0-9+/]{43}=$/;

function b64Decode(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }
  // Node / test fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('buffer').Buffer.from(padded, 'base64').toString('binary');
}

function isValidPin(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const pin = value.trim();
  if (!PIN_RE.test(pin)) return false;
  // Reject obvious placeholders from the generate API (`old` field).
  if (/^(sdf|abc|xxx|test)/i.test(pin)) return false;
  return true;
}

function uniquePins(pins: string[]): string[] {
  return [...new Set(pins.map((p) => p.trim()).filter(isValidPin))];
}

function pinHosts(): string[] {
  const hosts = new Set<string>([PINNED_HOST]);
  try {
    const h = new URL(getApiBaseUrl()).hostname.toLowerCase();
    if (h) hosts.add(h);
  } catch {
    /* ignore */
  }
  try {
    const h = new URL(getSslPinGenerateUrl()).hostname.toLowerCase();
    if (h) hosts.add(h);
  } catch {
    /* ignore */
  }
  return [...hosts];
}

/**
 * Decode `/api/generate` body:
 *   outer Base64 → concatenated single-char Base64 (`ZQ==eQ==…`) → Base64 JSON
 *   → `{ type, new, old, … }`.
 */
export function decodeGeneratePayload(data: string): {
  newPin?: string;
  oldPin?: string;
  raw?: Record<string, unknown>;
} {
  const level1 = b64Decode(data);
  const parts = level1.match(/[A-Za-z0-9+/]{2}==/g);
  if (!parts?.length) throw new Error('Invalid generate payload framing');

  const chars = parts
    .map((p) => {
      const bin = b64Decode(p);
      return bin.length ? bin[0] : '';
    })
    .join('');

  const jsonText = b64Decode(chars);
  const raw = JSON.parse(jsonText) as Record<string, unknown>;
  return {
    raw,
    newPin: typeof raw.new === 'string' ? raw.new : undefined,
    oldPin: typeof raw.old === 'string' ? raw.old : undefined,
  };
}

async function applyPins(publicKeyHashes: string[]): Promise<void> {
  if (Platform.OS === 'web' || !isSslPinningAvailable()) {
    console.log('[sslPin] native module unavailable — skipping (web / Expo Go)');
    return;
  }
  const pins = uniquePins(publicKeyHashes);
  if (pins.length === 0) {
    console.warn('[sslPin] no valid pins to apply');
    return;
  }
  const options: Record<string, { includeSubdomains: boolean; publicKeyHashes: string[] }> =
    {};
  for (const host of pinHosts()) {
    options[host] = {
      includeSubdomains: true,
      publicKeyHashes: pins,
    };
  }
  await initializeSslPinning(options);
  console.log(
    `[sslPin] active for ${Object.keys(options).join(', ')} (${pins.length} pin(s))`,
  );
}

/**
 * Fetch remote SSL pins from the stress-key generate API.
 * Intended to run after bootstrap pinning is already active.
 */
export async function fetchRemoteSslPins(): Promise<string[]> {
  const url = getSslPinGenerateUrl();
  const stressKey = getSslStressKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'stress-key': stressKey,
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      },
      signal: controller.signal,
    });
    const json = (await res.json()) as {
      success?: boolean;
      data?: string;
      message?: string;
    };
    if (!res.ok || !json?.success || typeof json.data !== 'string') {
      throw new Error(json?.message || `generate failed (${res.status})`);
    }
    const { newPin, oldPin } = decodeGeneratePayload(json.data);
    return uniquePins([newPin, oldPin].filter(Boolean) as string[]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Boot SSL pinning. Safe to call once at app start; never throws to the UI.
 */
export async function setupSslPinning(): Promise<void> {
  try {
    // 1) Bootstrap so all subsequent HTTPS (including /generate) is pinned.
    await applyPins([...BOOTSTRAP_SPKI_SHA256]);

    // 2) Merge remote keys from stress-key generate API.
    try {
      const remote = await fetchRemoteSslPins();
      if (remote.length > 0) {
        await applyPins([...BOOTSTRAP_SPKI_SHA256, ...remote]);
        console.log(`[sslPin] merged ${remote.length} remote pin(s) from generate API`);
      } else {
        console.log('[sslPin] generate API returned no usable pins — bootstrap only');
      }
    } catch (err) {
      console.warn(
        '[sslPin] generate API refresh failed — keeping bootstrap pins:',
        err instanceof Error ? err.message : err,
      );
    }
  } catch (err) {
    console.warn(
      '[sslPin] setup failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

/** Exposed for tests / diagnostics. */
export function getBootstrapPins(): readonly string[] {
  return BOOTSTRAP_SPKI_SHA256;
}
