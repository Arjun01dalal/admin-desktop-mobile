import { useCallback, useEffect, useRef, useState } from 'react';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';

type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

/**
 * Fetch data for the new dashboard pages through the existing secure IPC bridge.
 * Guards against stale responses when the payload changes rapidly.
 */
export function useSecureQuery<T = unknown>(
  action: SecureAction,
  payload: Record<string, unknown>,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options;
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });
  const genRef = useRef(0);
  const payloadKey = JSON.stringify(payload);

  const run = useCallback(async () => {
    const gen = ++genRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    const res = await secureApi<T>(action, JSON.parse(payloadKey));
    if (gen !== genRef.current) return;
    if (res.ok) {
      setState({ data: (res.data ?? null) as T | null, loading: false, error: null });
    } else {
      setState({ data: null, loading: false, error: res.message || 'Request failed' });
    }
  }, [action, payloadKey]);

  useEffect(() => {
    if (!enabled) return;
    void run();
  }, [enabled, run]);

  return { ...state, refetch: run };
}
