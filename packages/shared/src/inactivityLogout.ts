/**
 * Client inactivity auto-logout (45 minutes).
 * Exempt: `dev_full_access` role OR mobile `9373114572`.
 *
 * Lifecycle: start on login (`startInactivitySession`), stop on any logout
 * including manual + token-blacklist (`stopInactivitySession`).
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

/** Persisted last activity timestamp (epoch ms). */
export const INACTIVITY_LAST_AT_KEY = 'astroInactivityLastAt';

/** Owner of the current inactivity session (`userId:mobile`). */
export const INACTIVITY_OWNER_KEY = 'astroInactivityOwner';

export type InactivityLogoutUser = PermissionUser & {
  _id?: string | null;
  mobile?: string | number | null;
};

/** Minimal storage surface (localStorage / appStorage). */
export type InactivityStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function normalizeInactivityMobile(mobile: unknown): string {
  return String(mobile ?? '').trim();
}

/** Stable owner key for the logged-in user. */
export function inactivitySessionOwnerKey(
  user: InactivityLogoutUser | null | undefined,
): string {
  if (!user) return '';
  const id = String(user._id ?? '').trim();
  const mobile = normalizeInactivityMobile(user.mobile);
  if (!id && !mobile) return '';
  return `${id}:${mobile}`;
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

/**
 * Begin / reset the 45m clock for this user (call on successful login).
 * Returns the started-at timestamp.
 */
export function startInactivitySession(
  storage: InactivityStorage,
  ownerKey: string,
  now = Date.now(),
): number {
  const key = String(ownerKey || '').trim();
  if (!key) return 0;
  try {
    storage.setItem(INACTIVITY_LAST_AT_KEY, String(now));
    storage.setItem(INACTIVITY_OWNER_KEY, key);
  } catch {
    // ignore quota / private mode
  }
  return now;
}

/** Stop the inactivity clock (call on any logout: manual, blacklist, inactivity). */
export function stopInactivitySession(storage: InactivityStorage): void {
  try {
    storage.removeItem(INACTIVITY_LAST_AT_KEY);
    storage.removeItem(INACTIVITY_OWNER_KEY);
  } catch {
    // ignore
  }
}

/**
 * Read last activity for this owner, or null if no matching active session.
 * Stale keys from a previous user are ignored (and cleared).
 */
export function readInactivityLastAt(
  storage: InactivityStorage,
  ownerKey: string,
): number | null {
  const key = String(ownerKey || '').trim();
  if (!key) return null;
  try {
    const owner = String(storage.getItem(INACTIVITY_OWNER_KEY) || '').trim();
    if (owner !== key) {
      if (owner) stopInactivitySession(storage);
      return null;
    }
    const n = Number(storage.getItem(INACTIVITY_LAST_AT_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Touch last-activity for the current owner (no-op if session not started). */
export function touchInactivitySession(
  storage: InactivityStorage,
  ownerKey: string,
  now = Date.now(),
): number {
  const key = String(ownerKey || '').trim();
  if (!key) return 0;
  try {
    const owner = String(storage.getItem(INACTIVITY_OWNER_KEY) || '').trim();
    if (owner !== key) return startInactivitySession(storage, key, now);
    storage.setItem(INACTIVITY_LAST_AT_KEY, String(now));
  } catch {
    // ignore
  }
  return now;
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
