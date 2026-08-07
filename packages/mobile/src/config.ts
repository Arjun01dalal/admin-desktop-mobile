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
