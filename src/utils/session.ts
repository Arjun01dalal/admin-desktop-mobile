/** Auth session helpers — clear storage and notify App to leave the panel. */

export const SESSION_EXPIRED_EVENT = 'gcalc:session-expired';

const AUTH_STORAGE_KEYS = [
  'user',
  'token',
  'role_id',
  'global_logout',
  'token_last_validated_at',
  'token_validation_lock',
] as const;

const AUTH_SESSION_KEYS = ['last_panel_path'] as const;

let logoutInFlight = false;
let expiredHandler: ((reason: string) => void) | null = null;

export function setSessionExpiredHandler(
  handler: ((reason: string) => void) | null,
): void {
  expiredHandler = handler;
}

export function clearAuthStorage(): void {
  for (const key of AUTH_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
  for (const key of AUTH_SESSION_KEYS) {
    sessionStorage.removeItem(key);
  }
}

export function isJwtExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    // Expire slightly early to avoid racing the server on the last second.
    return payload.exp * 1000 <= Date.now() + 5000;
  } catch {
    return false;
  }
}

export function isAuthExpiredStatus(status?: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Clears all auth data and asks App to move to the calculator.
 * Safe to call many times — only the first trigger runs.
 */
export function notifySessionExpired(
  reason = 'Session expired. Please login again.',
): void {
  if (logoutInFlight) return;
  logoutInFlight = true;

  clearAuthStorage();

  try {
    expiredHandler?.(reason);
  } catch {
    // ignore handler errors
  }

  try {
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }),
    );
  } catch {
    // ignore
  }
}

/** Reset the one-shot guard after a successful login. */
export function resetSessionExpiredGuard(): void {
  logoutInFlight = false;
}
