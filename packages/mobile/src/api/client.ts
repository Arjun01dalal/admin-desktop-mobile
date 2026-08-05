/**
 * Secure API client — mirrors electron/secure/index.cjs `execute()`.
 * Body for encrypted actions: { token: encrypt(payload) }.
 * Encrypted responses arrive as response.data.data (string) and are decrypted,
 * then unwrapped to `.payload` unless keepDataEnvelope.
 */
import { REGISTRY, type SecureAction } from './registry.generated';
import { encryptPayload, decryptPayload } from './crypto';
import { getApiBaseUrl } from '../config';
import { appStorage } from '../lib/webShim';

export type ApiResult<T = unknown> = {
  ok: boolean;
  success?: boolean;
  data?: T;
  message?: string;
  status?: number;
  /** Outer envelope token (e.g. verify-otp returns the session token at response.data.token). */
  token?: string;
};

function pickMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.message === 'string') return b.message;
    if (typeof b.error === 'string') return b.error;
  }
  return fallback;
}

export async function secureApi<T = unknown>(
  action: SecureAction,
  payload: Record<string, unknown> = {},
  tokenOverride?: string | null,
): Promise<ApiResult<T>> {
  const entry = REGISTRY[action];
  if (!entry) return { ok: false, message: `Unknown action: ${String(action)}` };
  if (entry.type === 'local' || !entry.method || !entry.path) {
    return { ok: false, message: `Action not supported on mobile: ${String(action)}` };
  }

  try {
    const token = tokenOverride ?? appStorage.getItem('token');

    // _clientName -> client-name header (mirrors desktop behaviour)
    const { _clientName, ...rest } = payload ?? {};
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (typeof _clientName === 'string' && _clientName.trim()) {
      headers['client-name'] = _clientName.trim().toUpperCase();
    }

    const body = entry.encryptRequest ? { token: encryptPayload(rest) } : rest;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let res: Response;
    try {
      res = await fetch(`${getApiBaseUrl()}${entry.path}`, {
        method: entry.method,
        headers,
        body: entry.method === 'GET' ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON response */
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: pickMessage(json, `Request failed (${res.status})`),
      };
    }

    // Mirrors electron/secure/index.cjs execute() exactly.
    let data = (json ?? {}) as Record<string, unknown>;

    if (entry.decryptResponse && data?.data != null) {
      try {
        if (typeof data.data === 'string') {
          // Match desktop decryptData — keep full envelope ({ payload: ... }).
          data = { ...data, data: decryptPayload(data.data as string) };
        } else if (
          !entry.keepDataEnvelope &&
          (data.data as Record<string, unknown>)?.payload !== undefined
        ) {
          data = { ...data, data: (data.data as Record<string, unknown>).payload };
        }
      } catch (err) {
        if (typeof data.data === 'string') {
          return {
            ok: false,
            status: res.status,
            message: err instanceof Error ? err.message : 'Decrypt failed',
          };
        }
      }
    }

    const inner = data?.data as Record<string, unknown> | undefined;
    const payloadOut = entry.keepDataEnvelope
      ? (data?.data ?? data)
      : ((inner && typeof inner === 'object' ? inner.payload : undefined) ??
        data?.data ??
        data?.payload ??
        data);

    return {
      ok: true,
      success: data?.success !== false,
      status: res.status,
      message: typeof data?.message === 'string' ? data.message : undefined,
      token: typeof data?.token === 'string' ? data.token : undefined,
      data: payloadOut as T,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out'
        : err instanceof Error
          ? err.message
          : 'Network error';
    return { ok: false, message };
  }
}
