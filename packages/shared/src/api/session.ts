/** Shared auth/session helpers — desktop + mobile stay aligned. */

export type SessionStatus = 'valid' | 'invalid' | 'unknown';

export type TokenBlacklistPayload = {
  isBlacklisted?: boolean;
  hasToken?: boolean;
};

/**
 * True when an API status/message indicates the bearer session is dead
 * (blacklisted, superseded by a newer login, expired, etc.).
 *
 * Note: bare HTTP 403 is often CDN/WAF/VPN IP blocking — not a dead JWT.
 * Only treat 403 as auth failure when the body clearly says so.
 */
export function isAuthFailureMessage(
  status: number | undefined,
  message?: string | null,
): boolean {
  const m = String(message || '').toLowerCase().trim();

  if (status === 401) return true;

  const authHints =
    m.includes('blacklist') ||
    m.includes('token expired') ||
    m.includes('invalid token') ||
    m.includes('jwt expired') ||
    m.includes('unauthorized') ||
    m.includes('unauthenticated') ||
    m.includes('session expired') ||
    m.includes('session is no longer valid') ||
    m.includes('please login again') ||
    m.includes('please log in again') ||
    m.includes('token not found') ||
    m.includes('no token') ||
    (m.includes('access denied') && m.includes('token')) ||
    (m.includes('forbidden') && (m.includes('token') || m.includes('auth')));

  if (status === 403) {
    return Boolean(m) && authHints;
  }

  if (!m) return false;
  return authHints;
}

/** True when a 403 looks like network / WAF / VPN blocking rather than auth. */
export function isNetworkForbiddenMessage(
  status: number | undefined,
  message?: string | null,
): boolean {
  if (status !== 403) return false;
  if (isAuthFailureMessage(status, message)) return false;
  return true;
}

export function networkForbiddenUserMessage(
  message?: string | null,
): string {
  const raw = String(message || '').trim();
  if (raw && !/^request failed/i.test(raw) && !/^forbidden$/i.test(raw)) {
    return raw;
  }
  return 'Request blocked (HTTP 403). If you are on a VPN, try another server or turn VPN off — or ask admin to allow this network.';
}

/**
 * Pull `{ isBlacklisted, hasToken }` out of common API envelope shapes.
 * Matches laxminarayan `checkSession` nesting.
 */
export function extractTokenBlacklistPayload(
  data: unknown,
): TokenBlacklistPayload {
  if (!data || typeof data !== 'object') return {};

  const candidates: unknown[] = [data];
  const obj = data as Record<string, unknown>;
  if (obj.payload != null) candidates.push(obj.payload);
  if (obj.data != null) candidates.push(obj.data);
  if (obj.data && typeof obj.data === 'object') {
    const inner = obj.data as Record<string, unknown>;
    if (inner.payload != null) candidates.push(inner.payload);
  }

  for (const c of candidates) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) continue;
    const row = c as Record<string, unknown>;
    if ('isBlacklisted' in row || 'hasToken' in row) {
      return {
        isBlacklisted:
          typeof row.isBlacklisted === 'boolean'
            ? row.isBlacklisted
            : undefined,
        hasToken:
          typeof row.hasToken === 'boolean' ? row.hasToken : undefined,
      };
    }
  }

  return {};
}

/**
 * Interpret check-token-blacklisted payload.
 * Invalid when blacklisted OR the server no longer recognizes this token
 * as the user's active session (newer login elsewhere).
 */
export function parseTokenBlacklistStatus(
  data: unknown,
  opts?: { httpStatus?: number; success?: boolean; message?: string },
): SessionStatus {
  if (isAuthFailureMessage(opts?.httpStatus, opts?.message)) {
    return 'invalid';
  }

  if (opts?.success === false && isAuthFailureMessage(undefined, opts.message)) {
    return 'invalid';
  }

  const payload = extractTokenBlacklistPayload(data);

  if (payload.isBlacklisted === true || payload.hasToken === false) {
    return 'invalid';
  }
  if (payload.isBlacklisted === false && payload.hasToken === true) {
    return 'valid';
  }
  return 'unknown';
}
