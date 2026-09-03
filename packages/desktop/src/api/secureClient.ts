/** Typed wrapper around window.gcalc.secureApi — no URLs or secrets here. */

import type { ApiResult } from '@astro/shared';
import { isAuthFailureMessage, networkForbiddenUserMessage } from '@astro/shared';
import { sanitizeBridgePayload } from './bridgeSanitize';
import { isSecureAction, type SecureAction } from './secureActions';
import { getAuthToken } from '@/utils/authToken';
import { isJwtExpired, notifySessionExpired } from '@/utils/session';
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
  'auth.updateActiveTime',
  'auth.updateInactiveTime',
]);

/**
 * Writes / side-effects — never coalesce or short-cache.
 * Everything else is treated as a read (in-flight dedupe + tiny TTL).
 */
const MUTATION_RE =
  /(^|\.)(create|update|delete|remove|send|verify|add|change|save|upload|register|set[A-Z]|lock|unlock|process|block|unblock|enable|disable|insert|statusUpdate|sosFlag|externalDialer|uploadDialler|savePerformance|settle|approve|reject|assign|allot|reset|cancel|confirm|dump)|(?:Users)?Update|(?:Users)?Dump/i;

/** @deprecated Prefer ApiResult from @astro/shared/api — alias kept for existing imports. */
export type SecureResult<T = unknown> = ApiResult<T>;

const inflightByKey = new Map<string, Promise<ApiResult<unknown>>>();
const recentByKey = new Map<string, { at: number; result: ApiResult<unknown> }>();

/** Identical read results reused briefly (StrictMode / remount / double fetch). */
const READ_CACHE_TTL_MS = 2_000;

/** Reads that must always hit the network (limits change often; stale cache confuses admins). */
const NO_READ_CACHE = new Set<SecureAction>(['midLimits.get']);

/** Drop cached read results after a mutation (e.g. midLimits.get after upsert). */
export function invalidateSecureReadCache(action?: SecureAction): void {
  if (!action) {
    recentByKey.clear();
    return;
  }

  const prefix = `${action}::`;
  for (const key of recentByKey.keys()) {
    if (key.startsWith(prefix)) recentByKey.delete(key);
  }
}

function isMutationAction(action: SecureAction): boolean {
  return MUTATION_RE.test(action);
}

function stablePayloadKey(payload: Record<string, unknown>): string {
  try {
    const keys = Object.keys(payload).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) sorted[k] = payload[k];
    return JSON.stringify(sorted);
  } catch {
    return String(Date.now());
  }
}

function requestKey(
  action: SecureAction,
  payload: Record<string, unknown>,
  token: string | null,
): string {
  return `${action}::${stablePayloadKey(payload)}::${token || ''}`;
}

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
    notifySessionExpired(message || 'Session expired. Please login again.');
    return;
  }

  // Some backends return HTTP 200 with success:false + blacklist/expired text.
  if (success === false && isAuthFailureMessage(undefined, message)) {
    notifySessionExpired(message || 'Session expired. Please login again.');
  }
}

async function invokeSecureApi<T>(
  action: SecureAction,
  cleanedPayload: Record<string, unknown>,
  token: string | null,
  hadToken: boolean,
): Promise<ApiResult<T>> {
  const result = await window.gcalc?.secureApi?.(action, cleanedPayload, token);

  if (!result) {
    return { ok: false, message: 'Secure API bridge unavailable' };
  }

  const message = typeof result.message === 'string' ? result.message : undefined;
  const status = typeof result.status === 'number' ? result.status : undefined;
  const success = typeof result.success === 'boolean' ? result.success : undefined;

  maybeExpireSession(action, hadToken, status, message, success);

  // After any authenticated panel action, opportunistically confirm this token
  // is still the latest session (another panel may have logged in).
  if (hadToken && !SKIP_SESSION_RECHECK.has(action)) {
    scheduleSessionRecheck();
  }

  const displayMessage =
    status === 403 && message && !isAuthFailureMessage(status, message)
      ? networkForbiddenUserMessage(message)
      : message;

  return {
    ok: result.ok === true,
    success: result.success,
    message: displayMessage,
    data: result.data as T | undefined,
    status,
  };
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

  if (hadToken && !SKIP_SESSION_LOGOUT.has(action) && isJwtExpired(token)) {
    notifySessionExpired('Your session has expired. Please login again.');
    return {
      ok: false,
      message: 'Session expired. Please login again.',
      status: 401,
    };
  }

  // Mutations: always go through (no dedupe / cache).
  if (isMutationAction(action) || NO_READ_CACHE.has(action)) {
    return invokeSecureApi<T>(action, cleaned.value, token, hadToken);
  }

  const key = requestKey(action, cleaned.value, token);
  const now = Date.now();
  const cached = recentByKey.get(key);
  if (cached && now - cached.at < READ_CACHE_TTL_MS) {
    return cached.result as ApiResult<T>;
  }

  const existing = inflightByKey.get(key);
  if (existing) {
    return existing as Promise<ApiResult<T>>;
  }

  const pending = invokeSecureApi<T>(action, cleaned.value, token, hadToken)
    .then((result) => {
      recentByKey.set(key, { at: Date.now(), result: result as ApiResult<unknown> });
      // Bound map growth (panel sessions can run long).
      if (recentByKey.size > 80) {
        const cutoff = Date.now() - READ_CACHE_TTL_MS;
        for (const [k, v] of recentByKey) {
          if (v.at < cutoff) recentByKey.delete(k);
        }
      }
      return result;
    })
    .finally(() => {
      inflightByKey.delete(key);
    });

  inflightByKey.set(key, pending as Promise<ApiResult<unknown>>);
  return pending;
}
