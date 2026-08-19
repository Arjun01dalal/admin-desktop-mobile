/**
 * API configuration.
 * Values come from EXPO_PUBLIC_* env vars (set in mobile/.env, gitignored),
 * matching the desktop app's API_BASE_URL and ENTK_VALUE.
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) throw new Error('EXPO_PUBLIC_API_BASE_URL is not set — create mobile/.env');
  return url.replace(/\/$/, '');
}

export function getEntkValue(): string {
  const v = process.env.EXPO_PUBLIC_ENTK_VALUE;
  if (!v) throw new Error('EXPO_PUBLIC_ENTK_VALUE is not set — create mobile/.env');
  return v;
}

export function isConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_API_BASE_URL && process.env.EXPO_PUBLIC_ENTK_VALUE);
}

/**
 * SSL pin generate endpoint (OkHttp stress-key API).
 * Defaults to production generate URL when unset.
 */
export function getSslPinGenerateUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_SSL_PIN_GENERATE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  try {
    const base = getApiBaseUrl();
    if (/laxminarayan\.live/i.test(base)) return `${base}/generate`;
  } catch {
    /* API base may be unset during early boot diagnostics */
  }
  return 'https://laxminarayan.live/api/generate';
}

/**
 * Header `stress-key` for `/api/generate`. Prefer env; fallback is the
 * production key used by the Android panel client.
 */
export function getSslStressKey(): string {
  return (
    process.env.EXPO_PUBLIC_SSL_STRESS_KEY?.trim() ||
    'QhhgFGu6GTB/rOMC8AvoOh9eLuHZbke180e0hp7j4zI='
  );
}

/** Optional Basic Auth username/password for protected call-recording URLs. */
export function getRecordingAuthCredentials():
  | { username: string; password: string }
  | undefined {
  const username = process.env.EXPO_PUBLIC_RECORDING_BASIC_AUTH_USERNAME?.trim();
  const password = process.env.EXPO_PUBLIC_RECORDING_BASIC_AUTH_PASSWORD?.trim();
  if (!username || !password) return undefined;
  return { username, password };
}
