import { useCallback, useEffect, useRef, useState } from 'react';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';

type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

const queryCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 30_000;

/**
 * Fetch data for the new dashboard pages through the existing secure IPC bridge.
 * Guards against stale responses when the payload changes rapidly.
 * Soft-caches successful results for short revisit navigation.
 */
export function useSecureQuery<T = unknown>(
  action: SecureAction,
  payload: Record<string, unknown>,
  options: { enabled?: boolean; cacheTtlMs?: number } = {},
) {
  const { enabled = true, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = options;
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });
  const genRef = useRef(0);
  const payloadKey = JSON.stringify(payload);
  const cacheKey = `${action}:${payloadKey}`;

  const run = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!opts?.force && cacheTtlMs > 0) {
        const hit = queryCache.get(cacheKey);
        if (hit && Date.now() <= hit.expiresAt) {
          setState({ data: hit.data as T | null, loading: false, error: null });
          return;
        }
      }

      const gen = ++genRef.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      const res = await secureApi<T>(action, JSON.parse(payloadKey));
      if (gen !== genRef.current) return;
      if (res.ok) {
        const data = (res.data ?? null) as T | null;
        if (cacheTtlMs > 0) {
          queryCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtlMs });
        }
        setState({ data, loading: false, error: null });
      } else {
        queryCache.delete(cacheKey);
        setState({ data: null, loading: false, error: res.message || 'Request failed' });
      }
    },
    [action, payloadKey, cacheKey, cacheTtlMs],
  );

  useEffect(() => {
    if (!enabled) return;
    void run();
  }, [enabled, run]);

  return { ...state, refetch: () => run({ force: true }) };
}
