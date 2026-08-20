/**
 * Secure API client — mirrors electron/secure/index.cjs `execute()`.
 * Body for encrypted actions: { token: encrypt(payload) }.
 * Encrypted responses arrive as response.data.data (string) and are decrypted,
 * then unwrapped to `.payload` unless keepDataEnvelope.
 */
import { isAuthFailureMessage } from '@astro/shared';
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

/**
 * Global auth-failure handler. The API layer cannot touch React state directly,
 * so AuthProvider registers its logout() here. Invoked whenever the server
 * rejects the session (HTTP 401 or a "token blacklist"/expired message), so the
 * user is signed out and returned to the login screen automatically.
 */
type AuthFailureHandler = (reason: string) => void;
let authFailureHandler: AuthFailureHandler | null = null;

export function setAuthFailureHandler(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler;
}

/** Login/OTP — never treat failures as an existing-session logout. */
const SKIP_SESSION_LOGOUT = new Set<SecureAction>([
  'auth.sendOtp',
  'auth.verifyOtp',
  'auth.getResponsibility',
]);

/** True when the response signals an invalid/blacklisted/expired session. */
function isAuthFailure(status: number | undefined, message: string): boolean {
  return isAuthFailureMessage(status, message);
}

function pickMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.message === 'string') return b.message;
    if (typeof b.error === 'string') return b.error;
  }
  return fallback;
}

function maybeAuthFailure(
  action: SecureAction,
  hadToken: boolean,
  status: number | undefined,
  message: string,
): void {
  if (SKIP_SESSION_LOGOUT.has(action)) return;
  if (!hadToken) return;
  if (!isAuthFailure(status, message)) return;
  authFailureHandler?.(message || 'Session expired. Please login again.');
}

const BANNER_VIDEO_TYPES = new Set(['tutorialVideo', 'howToDepositVideo']);

/**
 * Multipart upload for banner tutorial videos — mirrors desktop
 * electron/secure `uploadBannerVideo`. Accepts either a file URI (preferred on
 * RN) or a base64 string.
 */
async function uploadBannerVideo(
  payload: Record<string, unknown> = {},
  tokenOverride?: string | null,
): Promise<ApiResult> {
  const videoUri = typeof payload.videoUri === 'string' ? payload.videoUri.trim() : '';
  const fileName = String(payload.fileName || '').trim();
  const videoType = String(payload.videoType || '').trim();
  const mimeType = String(payload.mimeType || 'video/mp4').slice(0, 80);

  if (!fileName || !videoUri) {
    return { ok: false, message: 'Please select a video file first' };
  }
  if (!BANNER_VIDEO_TYPES.has(videoType)) {
    return { ok: false, message: 'Please select a valid video type' };
  }
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  if (!/\.(mp4|webm|mov|m4v|avi)$/i.test(safeName)) {
    return { ok: false, message: 'Only video uploads are allowed (mp4, webm, mov, m4v, avi)' };
  }

  try {
    const token = tokenOverride ?? appStorage.getItem('token');
    const form = new FormData();
    form.append('File_Name', 'tutorialVideo');
    form.append('category', 'others');
    form.append('deepLink', 'true');
    form.append('gameName', 'NA');
    form.append('iframeUrlMob', 'NA');
    form.append('mobileOptions', '');
    form.append('mobileRouter', '');
    form.append('type', videoType);
    form.append('iframeUrl', 'NA');

    if (videoUri) {
      // React Native FormData file part
      form.append('video', {
        uri: videoUri,
        name: safeName,
        type: mimeType,
      } as unknown as Blob);
    } else {
      return { ok: false, message: 'Please select a video file first' };
    }

    const url = `${getApiBaseUrl()}/bannerGames/upload_video`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    if (!res.ok) {
      const message = pickMessage(json, `Request failed (${res.status})`);
      maybeAuthFailure('ops.bannersUploadVideo', Boolean(token), res.status, message);
      return { ok: false, message, status: res.status };
    }
    const data = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
    return {
      ok: true,
      success: data.success !== false,
      message:
        typeof data.message === 'string'
          ? data.message
          : 'Tutorial video uploaded successfully',
      data: data.data ?? data,
      status: res.status,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'Request timed out'
        : err instanceof Error
          ? err.message
          : 'Video upload failed';
    return { ok: false, message };
  }
}

export async function secureApi<T = unknown>(
  action: SecureAction,
  payload: Record<string, unknown> = {},
  tokenOverride?: string | null,
): Promise<ApiResult<T>> {
  const entry = REGISTRY[action];
  if (!entry) return { ok: false, message: `Unknown action: ${String(action)}` };

  // Multipart video upload — desktop does this in Electron; mirror on mobile.
  if (action === 'ops.bannersUploadVideo') {
    return uploadBannerVideo(payload, tokenOverride) as Promise<ApiResult<T>>;
  }

  if (entry.type === 'local' || !entry.method || !entry.path) {
    return { ok: false, message: `Action not supported on mobile: ${String(action)}` };
  }

  try {
    const token = tokenOverride ?? appStorage.getItem('token');
    const hadToken = Boolean(token);

    // _clientName -> client-name header (mirrors desktop behaviour)
    const { _clientName, ...rest } = payload ?? {};
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // The API's firewall may block non-browser user agents (mobile fetch
      // defaults to okhttp/CFNetwork); present a browser-like UA instead.
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (typeof _clientName === 'string' && _clientName.trim()) {
      headers['client-name'] = _clientName.trim().toUpperCase();
    }
    const staticHeaders = (entry as { headers?: Record<string, string> }).headers;
    if (staticHeaders && typeof staticHeaders === 'object') {
      for (const [k, v] of Object.entries(staticHeaders)) headers[k] = String(v);
    }

    const body = entry.encryptRequest ? { token: encryptPayload(rest) } : rest;

    const isGet = entry.method === 'GET';
    // Registry paths may be absolute (other backends, e.g. Live Match book/odds).
    let url = /^https?:\/\//i.test(entry.path)
      ? entry.path
      : `${getApiBaseUrl()}${entry.path}`;
    // Match desktop: GET payload goes in the query string (e.g. startDate/endDate).
    if (isGet) {
      const entries = Object.entries(rest || {}).filter(
        ([, v]) => v != null && String(v).length > 0,
      );
      if (entries.length > 0) {
        const qs = new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
        url = `${url}${url.includes('?') ? '&' : '?'}${qs}`;
      }
    }

    const controller = new AbortController();
    // Honor per-action registry timeouts (e.g. Funds reports use 180s); default 60s.
    const timeoutMs =
      typeof (entry as { timeout?: unknown }).timeout === 'number'
        ? ((entry as { timeout: number }).timeout)
        : 60_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: entry.method,
        headers,
        body: isGet ? undefined : JSON.stringify(body),
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
      // Surfaced in tunnel logs so failing actions can be diagnosed remotely.
      console.log(
        `[api] ${action} failed: HTTP ${res.status} body=${JSON.stringify(json)?.slice(0, 300)}`,
      );
      const message = pickMessage(json, `Request failed (${res.status})`);
      maybeAuthFailure(action, hadToken, res.status, message);
      return { ok: false, status: res.status, message };
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
          // Some mutation endpoints (e.g. upiLists/update) return a plain/non-encrypted
          // body on success. HTTP was OK, so treat as success instead of surfacing a
          // decrypt/JSON-parse error; log the raw body for remote diagnostics.
          console.log(
            `[api] ${action} decrypt failed (${err instanceof Error ? err.message : err}); ` +
              `treating HTTP ${res.status} as success. raw=${String(data.data).slice(0, 200)}`,
          );
          data = { ...data, data: null };
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

    // Some backends return HTTP 200 with success:false + a blacklist/expired
    // message instead of a 401. Catch that here too.
    const okMessage = typeof data?.message === 'string' ? data.message : '';
    if (data?.success === false) {
      maybeAuthFailure(action, hadToken, undefined, okMessage);
    }

    // Opportunistic single-session check after authenticated panel actions.
    if (hadToken && !SKIP_SESSION_LOGOUT.has(action) && action !== 'auth.checkTokenBlacklisted') {
      void import('../auth/sessionCheck')
        .then(async ({ runTokenValidation, wasCheckedRecently }) => {
          if (wasCheckedRecently(10_000)) return;
          const status = await runTokenValidation({ force: true });
          if (status === 'invalid') {
            authFailureHandler?.(
              'You were logged in elsewhere. Please login again.',
            );
          }
        })
        .catch(() => {
          /* ignore */
        });
    }

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

