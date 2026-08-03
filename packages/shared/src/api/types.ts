/**
 * Cross-client API result + transport contract.
 * Platforms implement `ApiTransport.call` differently (Electron IPC vs mobile HTTPS).
 * Business logic stays in @astro/shared — not duplicated.
 */

export type ApiResult<T = unknown> = {
  ok: boolean;
  success?: boolean;
  message?: string;
  data?: T;
  status?: number;
};

/**
 * Thin platform adapter. Desktop wraps `secureApi`; mobile wraps HTTPS + ENTK.
 * Never put secrets or Electron APIs in shared — only this interface shape.
 */
export type ApiTransport = {
  call<T = unknown>(
    action: string,
    payload?: Record<string, unknown>,
  ): Promise<ApiResult<T>>;
};

export function apiFailed(res: Pick<ApiResult, 'ok' | 'success'>): boolean {
  return !res.ok || res.success === false;
}
