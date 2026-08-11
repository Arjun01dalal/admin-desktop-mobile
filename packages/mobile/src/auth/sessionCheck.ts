/**
 * Single-session checks against `/SubAdmin/check-token-blacklisted`.
 * Mirrors desktop sessionCheck — latest login for a mobile wins.
 */

import { parseTokenBlacklistStatus, type SessionStatus } from '@astro/shared';
import { secureApi } from '../api/client';
import { appStorage } from '../lib/webShim';

export const TOKEN_CHECK_INTERVAL = 30 * 1000;
const LAST_CHECK_KEY = 'token_last_validated_at';
const VALIDATION_LOCK_KEY = 'token_validation_lock';
const LOCK_TTL_MS = 8_000;

let inFlightValidation: Promise<SessionStatus> | null = null;

function isJwtExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    if (typeof globalThis.atob !== 'function') {
      // No local JWT decode — rely on server blacklist / 401 checks.
      return false;
    }
    const payload = JSON.parse(globalThis.atob(padded)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now() + 5000;
  } catch {
    return false;
  }
}

export function resetTokenValidationThrottle(): void {
  appStorage.removeItem(LAST_CHECK_KEY);
  appStorage.removeItem(VALIDATION_LOCK_KEY);
}

export function wasCheckedRecently(gapMs: number): boolean {
  const lastCheck = Number(appStorage.getItem(LAST_CHECK_KEY) || 0);
  return Boolean(lastCheck && Date.now() - lastCheck < gapMs);
}

function shouldRunTokenCheck(force: boolean): boolean {
  const now = Date.now();

  if (!force) {
    const lastCheck = Number(appStorage.getItem(LAST_CHECK_KEY) || 0);
    if (lastCheck && now - lastCheck < TOKEN_CHECK_INTERVAL) {
      return false;
    }
  }

  const lock = appStorage.getItem(VALIDATION_LOCK_KEY);
  if (lock && now - Number(lock) < LOCK_TTL_MS) {
    return false;
  }

  appStorage.setItem(VALIDATION_LOCK_KEY, String(now));
  return true;
}

function markTokenCheckComplete(): void {
  appStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  appStorage.removeItem(VALIDATION_LOCK_KEY);
}

function readStoredUserId(): string | undefined {
  try {
    const raw = appStorage.getItem('user');
    if (!raw) return undefined;
    return (JSON.parse(raw) as { _id?: string })?._id;
  } catch {
    return undefined;
  }
}

async function checkSession(userId: string): Promise<SessionStatus> {
  const token = appStorage.getItem('token');
  if (!token || !userId) return 'unknown';

  if (isJwtExpired(token)) return 'invalid';

  try {
    // Call with an explicit token; client auth-failure handler is skipped for
    // this action via SKIP in client — we interpret the payload ourselves.
    const res = await secureApi<unknown>(
      'auth.checkTokenBlacklisted',
      { _id: userId },
      token,
    );

    return parseTokenBlacklistStatus(res.data, {
      httpStatus: res.status,
      success: res.success,
      message: res.message,
    });
  } catch {
    return 'unknown';
  }
}

export async function runTokenValidation(
  opts?: { force?: boolean },
): Promise<SessionStatus> {
  if (!shouldRunTokenCheck(Boolean(opts?.force))) return 'unknown';

  const token = appStorage.getItem('token');
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
