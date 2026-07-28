/** Typed wrapper around window.gcalc.secureApi — no URLs or secrets here. */

import { sanitizeBridgePayload } from './bridgeSanitize';
import { isSecureAction, type SecureAction } from './secureActions';
import {
  isAuthExpiredStatus,
  isJwtExpired,
  notifySessionExpired,
} from '@/utils/session';

/** Login/OTP flows — never treat their 401s as a session logout. */
const SKIP_SESSION_LOGOUT = new Set<SecureAction>([
  'auth.sendOtp',
  'auth.verifyOtp',
]);

export type SecureResult<T = unknown> = {
  ok: boolean;
  success?: boolean;
  message?: string;
  data?: T;
  status?: number;
};

function maybeExpireSession(
  action: SecureAction,
  hadToken: boolean,
  status?: number,
  message?: string,
): void {
  if (SKIP_SESSION_LOGOUT.has(action)) return;
  if (!hadToken) return;
  if (!isAuthExpiredStatus(status)) return;
  notifySessionExpired(
    message || 'Session expired. Please login again.',
  );
}

export async function secureApi<T = unknown>(
  action: SecureAction,
  payload: Record<string, unknown> = {},
): Promise<SecureResult<T>> {
  if (!isSecureAction(action)) {
    return { ok: false, message: `Unknown secure action: ${action}` };
  }

  const cleaned = sanitizeBridgePayload(payload);
  if (!cleaned.ok) {
    return { ok: false, message: cleaned.message };
  }

  const token = localStorage.getItem('token');
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

  maybeExpireSession(action, hadToken, status, message);

  return {
    ok: result.ok === true,
    success: result.success,
    message,
    data: result.data as T | undefined,
    status,
  };
}
