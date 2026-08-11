/**
 * Single-session checks against `/SubAdmin/check-token-blacklisted`.
 * Calls the Electron bridge directly (not secureClient) to avoid circular imports.
 */

import { parseTokenBlacklistStatus, type SessionStatus } from '@astro/shared';
import { getAuthToken } from '@/utils/authToken';
import { isJwtExpired, notifySessionExpired } from '@/utils/session';

/**
 * How often we hit check-token-blacklisted while the panel is open.
 * Kept short so a login on another panel/device kicks this session out quickly.
 */
export const TOKEN_CHECK_INTERVAL = 30 * 1000;
export const LAST_CHECK_KEY = 'token_last_validated_at';
export const VALIDATION_LOCK_KEY = 'token_validation_lock';
const LOCK_TTL_MS = 8_000;

let inFlightValidation: Promise<SessionStatus> | null = null;

export function resetTokenValidationThrottle(): void {
  try {
    localStorage.removeItem(LAST_CHECK_KEY);
    localStorage.removeItem(VALIDATION_LOCK_KEY);
  } catch {
    // ignore
  }
}

export function shouldRunTokenCheck(force: boolean): boolean {
  const now = Date.now();

  if (!force) {
    const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
    if (lastCheck && now - lastCheck < TOKEN_CHECK_INTERVAL) {
      return false;
    }
  }

  const lock = localStorage.getItem(VALIDATION_LOCK_KEY);
  if (lock && now - Number(lock) < LOCK_TTL_MS) {
    return false;
  }

  localStorage.setItem(VALIDATION_LOCK_KEY, String(now));
  return true;
}

export function markTokenCheckComplete(): void {
  localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  localStorage.removeItem(VALIDATION_LOCK_KEY);
}

export function readStoredUserId(): string | undefined {
  try {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return undefined;
    return (JSON.parse(storedUser) as { _id?: string })?._id;
  } catch {
    return undefined;
  }
}

export async function checkSession(userId: string): Promise<SessionStatus> {
  const token = getAuthToken();
  if (!token || !userId) return 'unknown';

  if (isJwtExpired(token)) return 'invalid';

  try {
    // Bridge directly — do not import secureClient (circular with scheduleSessionRecheck).
    const res = await window.gcalc?.secureApi?.(
      'auth.checkTokenBlacklisted',
      { _id: userId },
      token,
    );

    if (!res) return 'unknown';

    return parseTokenBlacklistStatus(res.data, {
      httpStatus: typeof res.status === 'number' ? res.status : undefined,
      success: typeof res.success === 'boolean' ? res.success : undefined,
      message: typeof res.message === 'string' ? res.message : undefined,
    });
  } catch {
    return 'unknown';
  }
}

export async function runTokenValidation(
  opts?: { force?: boolean },
): Promise<SessionStatus> {
  if (!shouldRunTokenCheck(Boolean(opts?.force))) return 'unknown';

  const token = getAuthToken();
  if (!token) {
    markTokenCheckComplete();
    return 'unknown';
  }

  const userId = readStoredUserId();
  if (!userId) {
    markTokenCheckComplete();
    return 'unknown';
  }

  try {
    if (!inFlightValidation) {
      inFlightValidation = checkSession(userId).finally(() => {
        inFlightValidation = null;
      });
    }

    const status = await inFlightValidation;
    markTokenCheckComplete();
    return status;
  } catch {
    markTokenCheckComplete();
    return 'unknown';
  }
}

/**
 * Background re-check used by secureClient after authenticated API calls.
 * Detects when another panel/device logged in with the same mobile (hasToken:false).
 * Uses a short gap so an action discovers a superseded session quickly without
 * hammering the blacklist endpoint on every request.
 */
export function scheduleSessionRecheck(): void {
  if (!getAuthToken()) return;

  const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
  if (lastCheck && Date.now() - lastCheck < 10_000) return;

  void runTokenValidation({ force: true }).then((status) => {
    if (status === 'invalid') {
      notifySessionExpired(
        'You were logged in elsewhere. Please login again.',
      );
    }
  });
}
