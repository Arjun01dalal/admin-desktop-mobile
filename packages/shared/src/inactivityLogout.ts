/**
 * Client inactivity auto-logout (45 minutes).
 * Exempt: `dev_full_access` role OR mobile `9373114572`.
 */
import {
  isDevFullAccessRole,
  type PermissionStorage,
  type PermissionUser,
} from './permissions';

/** Wall-clock idle limit before inactivity logout. */
export const INACTIVITY_LOGOUT_MS = 45 * 60 * 1000;

/** Mobile numbers that never get inactivity logout. */
export const INACTIVITY_LOGOUT_EXEMPT_MOBILES = new Set(['9373114572']);

export type InactivityLogoutUser = PermissionUser & {
  mobile?: string | number | null;
};

export function normalizeInactivityMobile(mobile: unknown): string {
  return String(mobile ?? '').trim();
}

/** Skip inactivity logout for exempt role / mobile. */
export function isInactivityLogoutExempt(
  user: InactivityLogoutUser | null | undefined,
  storage?: PermissionStorage | null,
): boolean {
  if (!user) return true;
  const mobile = normalizeInactivityMobile(user.mobile);
  if (mobile && INACTIVITY_LOGOUT_EXEMPT_MOBILES.has(mobile)) return true;
  if (isDevFullAccessRole(user, storage)) return true;
  return false;
}

/** Remaining ms until logout from last activity timestamp (0 = due now). */
export function inactivityLogoutRemainingMs(
  lastActivityAt: number,
  now = Date.now(),
  limitMs = INACTIVITY_LOGOUT_MS,
): number {
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return 0;
  const elapsed = now - lastActivityAt;
  if (elapsed >= limitMs) return 0;
  return limitMs - elapsed;
}

export function isInactivityLogoutDue(
  lastActivityAt: number,
  now = Date.now(),
  limitMs = INACTIVITY_LOGOUT_MS,
): boolean {
  return inactivityLogoutRemainingMs(lastActivityAt, now, limitMs) <= 0;
}
