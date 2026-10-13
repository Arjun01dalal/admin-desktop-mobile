/**
 * Shared paged secure-API query with stale-response + unmount guards.
 */
import { useCallback, useEffect, useState } from 'react';
import { asPaged } from '@astro/shared';
import { secureApi } from '../api/client';
import type { SecureAction } from '../api/registry.generated';
import { useRequestGeneration } from './useRequestGeneration';

type Unpack<T> = (data: unknown) => {
  rows: T[];
  totalPages?: number;
  total?: number;
};

type Options<T> = {
  action: SecureAction;
  buildPayload: () => Record<string, unknown>;
  unpack?: Unpack<T>;
  /** Auto-load when these deps change. Pass `[]` for mount-only; omit to disable auto. */
  autoDeps?: unknown[];
  errorMessage?: string;
};

function defaultUnpack<T>(data: unknown): { rows: T[]; totalPages: number; total: number } {
  const paged = asPaged<T>(data);
  return {
    rows: paged.rows,
    totalPages: Math.max(1, paged.totalPages || 1),
    total: paged.total || paged.rows.length,
  };
}

export function usePagedSecureQuery<T>({
  action,
  buildPayload,
  unpack = defaultUnpack,
  autoDeps,
  errorMessage = 'Failed to load data',
}: Options<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi(action, buildPayload());
      if (!isCurrent(gen)) return;
      if (!res.ok) {
        setError(res.message || errorMessage);
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const parsed = unpack(res.data);
      setRows(parsed.rows);
      setTotal(parsed.total ?? parsed.rows.length);
      setTotalPages(Math.max(1, parsed.totalPages ?? 1));
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : errorMessage);
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [action, begin, buildPayload, end, errorMessage, isCurrent, next, unpack]);

  useEffect(() => {
    if (!autoDeps) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls autoDeps
  }, autoDeps ?? []);

  return { rows, setRows, total, totalPages, loading, error, load, setError };
}
