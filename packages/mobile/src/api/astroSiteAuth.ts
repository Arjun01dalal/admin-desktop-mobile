/**
 * Public Astro site auth (api.astrothirdeye.com) — mirrors desktop siteAuth.cjs.
 * Separate from panel SubAdmin APIs (no ENTK encryption).
 */
const SITE_API_BASE = 'https://api.astrothirdeye.com';

export type SiteLoginResult =
  | { ok: true; message: string; accessToken: string }
  | { ok: false; message: string };

function apiMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const o = data as Record<string, unknown>;
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof o.error === 'string' && o.error.trim()) return o.error;
  if (typeof o.msg === 'string' && o.msg.trim()) return o.msg;
  return fallback;
}

function pickAccessToken(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const root = data as Record<string, unknown>;
  const nested = (root.data || root.payload || root.result) as Record<string, unknown> | undefined;
  const direct = String(
    root.accessToken ||
      root.access_token ||
      root.token ||
      nested?.accessToken ||
      nested?.access_token ||
      nested?.token ||
      '',
  ).trim();
  if (direct && direct.length <= 8192) return direct;

  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    for (const [key, value] of Object.entries(cur as Record<string, unknown>)) {
      if (typeof value === 'string') {
        const s = value.trim();
        if (!s || s.length < 20 || s.length > 8192) continue;
        if (/^(fcm|device)/i.test(s)) continue;
        if (/^(access[_-]?token|token|jwt|authorization)$/i.test(key)) return s;
        if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./.test(s)) return s;
      } else if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }
  return '';
}

async function assertAstrologerProfileToken(accessToken: string): Promise<SiteLoginResult> {
  const token = String(accessToken || '').trim();
  if (!token || token.length > 8192 || /[\s\u0000-\u001F\u007F]/.test(token)) {
    return {
      ok: false,
      message: 'External login token missing or malformed. Please sign in again.',
    };
  }
  try {
    const response = await fetch(`${SITE_API_BASE}/api/astrologer/profile`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (response.ok) return { ok: true, message: 'OK', accessToken: token };
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        message: 'External login link is invalid or expired. Please sign in again.',
      };
    }
    return { ok: false, message: 'External login could not be verified. Please try again.' };
  } catch {
    return {
      ok: false,
      message: 'External login service is unavailable. Please try again.',
    };
  }
}

export async function siteLoginViaPassword(payload: {
  email: string;
  password: string;
  deviceId: string;
  os: string;
  modelNumber: string;
  longitude: string;
  latitude: string;
  fcmToken: string;
}): Promise<SiteLoginResult> {
  const email = String(payload.email || '').trim();
  const password = String(payload.password || '');
  const fcmToken = String(payload.fcmToken || '').trim();
  if (!email || !password) {
    return { ok: false, message: 'Email and password are required' };
  }
  if (!fcmToken) {
    return { ok: false, message: 'Push token is required. Enable notifications and try again.' };
  }

  try {
    const response = await fetch(`${SITE_API_BASE}/api/auth/login-via-password`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        deviceId: String(payload.deviceId || 'mobile').trim() || 'mobile',
        os: String(payload.os || 'android'),
        modelNumber: String(payload.modelNumber || 'Mobile'),
        longitude: String(payload.longitude ?? '0.0'),
        latitude: String(payload.latitude ?? '0.0'),
        fcmToken,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as unknown;
    if (!response.ok) {
      return { ok: false, message: apiMessage(data, 'Login failed') };
    }
    const accessToken = pickAccessToken(data);
    if (!accessToken) {
      return { ok: false, message: 'Login response did not include an access token' };
    }
    const profile = await assertAstrologerProfileToken(accessToken);
    if (!profile.ok) return profile;
    return {
      ok: true,
      message: apiMessage(data, 'Login successful'),
      accessToken,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

export function buildAstroSiteSsoUrl(accessToken: string): string {
  const token = String(accessToken || '').trim();
  return `https://astrotalk.vip/#external_login=1&access_token=${encodeURIComponent(token)}`;
}

export const SITE_ACCESS_TOKEN_KEY = 'astro_site_access_token_v1';
export const ASTRO_DEEP_LINK_SCHEME = 'myastroapp';
