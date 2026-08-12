/** Typed wrapper around window.gcalc.secureApi — no URLs or secrets here. */

import type { ApiResult } from '@astro/shared';
import { isAuthFailureMessage } from '@astro/shared';
import { sanitizeBridgePayload } from './bridgeSanitize';
import { isSecureAction, type SecureAction } from './secureActions';
import { getAuthToken } from '@/utils/authToken';
import {
  isJwtExpired,
  notifySessionExpired,
} from '@/utils/session';
import { scheduleSessionRecheck } from '@/utils/sessionCheck';

/** Login/OTP flows — never treat their 401s as a session logout. */
const SKIP_SESSION_LOGOUT = new Set<SecureAction>([
  'auth.sendOtp',
  'auth.verifyOtp',
  'auth.getResponsibility',
]);

/** Endpoints that already ARE the session check — don't nest another recheck. */
const SKIP_SESSION_RECHECK = new Set<SecureAction>([
  'auth.sendOtp',
  'auth.verifyOtp',
  'auth.getResponsibility',
  'auth.checkTokenBlacklisted',
  'auth.getAllBlockedUserIds',
  'auth.getSosFlag',
  'auth.getAllSosBlocks',
]);

/** @deprecated Prefer ApiResult from @astro/shared/api — alias kept for existing imports. */
export type SecureResult<T = unknown> = ApiResult<T>;

function maybeExpireSession(
  action: SecureAction,
  hadToken: boolean,
  status?: number,
  message?: string,
  success?: boolean,
): void {
  if (SKIP_SESSION_LOGOUT.has(action)) return;
  if (!hadToken) return;

  if (isAuthFailureMessage(status, message)) {
    notifySessionExpired(
      message || 'Session expired. Please login again.',
    );
    return;
  }

  // Some backends return HTTP 200 with success:false + blacklist/expired text.
  if (success === false && isAuthFailureMessage(undefined, message)) {
    notifySessionExpired(
      message || 'Session expired. Please login again.',
    );
  }
}

export async function secureApi<T = unknown>(
  action: SecureAction,
  payload: Record<string, unknown> = {},
): Promise<ApiResult<T>> {
  if (!isSecureAction(action)) {
    return { ok: false, message: `Unknown secure action: ${action}` };
  }

  const cleaned = sanitizeBridgePayload(payload);
  if (!cleaned.ok) {
    return { ok: false, message: cleaned.message };
  }

  const token = getAuthToken();
  const hadToken = Boolean(token);

  if (
    hadToken &&
    !SKIP_SESSION_LOGOUT.has(action) &&
    isJwtExpired(token)
  ) {
    notifySessionExpired('Your session has expired. Please login again.');
    return {
      ok: false,
      message: 'Session expired. Please login again.',
      status: 401,
    };
  }

  const result = await window.gcalc?.secureApi?.(action, cleaned.value, token);

  if (!result) {
    return { ok: false, message: 'Secure API bridge unavailable' };
  }

  const message =
    typeof result.message === 'string' ? result.message : undefined;
  const status = typeof result.status === 'number' ? result.status : undefined;
  const success =
    typeof result.success === 'boolean' ? result.success : undefined;

  maybeExpireSession(action, hadToken, status, message, success);

  // After any authenticated panel action, opportunistically confirm this token
  // is still the latest session (another panel may have logged in).
  if (hadToken && !SKIP_SESSION_RECHECK.has(action)) {
    scheduleSessionRecheck();
  }

  return {
    ok: result.ok === true,
    success: result.success,
    message,
    data: result.data as T | undefined,
    status,
  };
}
