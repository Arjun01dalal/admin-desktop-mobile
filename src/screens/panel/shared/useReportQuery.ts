import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi, type SecureResult } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';

type Unpack<T> = (res: SecureResult<unknown>) => {
  rows: T[];
  totalPages?: number;
  total?: number;
};

type Options<T> = {
  action: SecureAction;
  buildPayload: () => Record<string, unknown>;
  unpack: Unpack<T>;
  /** Auto-load on mount / when deps change. Default: page only via separate effect. */
  autoDeps?: unknown[];
  errorMessage?: string;
  /** Soft cache TTL for revisit nav. 0 disables. Default 30s. */
  cacheTtlMs?: number;
};

type CacheEntry = {
  rows: unknown[];
  totalPages: number;
  total: number;
  expiresAt: number;
};

const queryCache = new Map<string, CacheEntry>();
const DEFAULT_CACHE_TTL_MS = 30_000;
/** Stable default — a fresh `[]` each render would re-fire the effect forever. */
const DEFAULT_AUTO_DEPS: unknown[] = [];

function cacheKey(action: SecureAction, payload: Record<string, unknown>): string {
  try {
    return `${action}:${JSON.stringify(payload)}`;
  } catch {
    return `${action}:unserializable`;
  }
}

function readCache<T>(key: string): CacheEntry | null {
  const hit = queryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  return hit as CacheEntry & { rows: T[] };
}

/** Shared list-query hook with stale-request guards + short TTL cache. */
export function useReportQuery<T>({
  action,
  buildPayload,
  unpack,
  autoDeps = DEFAULT_AUTO_DEPS,
  errorMessage = 'Failed to load data',
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: Options<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const payload = buildPayload();
    const key = cacheTtlMs > 0 ? cacheKey(action, payload) : '';

    if (!opts?.force && key) {
      const cached = readCache<T>(key);
      if (cached) {
        startTransition(() => {
          setRows(cached.rows as T[]);
          setTotal(cached.total);
          setTotalPages(cached.totalPages);
          setError(null);
          setLoading(false);
        });
        return;
      }
    }

    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi(action, payload);
      if (!isCurrent(gen)) return;

      if (!res.ok) {
        const msg = res.message || errorMessage;
        setError(msg);
        toast.error(msg);
        if (key) queryCache.delete(key);
        startTransition(() => {
          setRows([]);
          setTotal(0);
          setTotalPages(1);
        });
        return;
      }

      const parsed = unpack(res);
      const nextRows = parsed.rows;
      const nextTotal = parsed.total ?? parsed.rows.length;
      const nextPages = Math.max(1, parsed.totalPages ?? 1);

      if (key) {
        queryCache.set(key, {
          rows: nextRows,
          total: nextTotal,
          totalPages: nextPages,
          expiresAt: Date.now() + cacheTtlMs,
        });
      }

      startTransition(() => {
        setRows(nextRows);
        setTotal(nextTotal);
        setTotalPages(nextPages);
      });
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [action, buildPayload, unpack, errorMessage, cacheTtlMs, next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, autoDeps);

  return {
    rows,
    totalPages,
    total,
    loading,
    error,
    load: () => load({ force: true }),
    setRows,
  };
}

/** Normalize common API envelopes into a list. */
export function asList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return obj.payload as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export function asPaged<T = unknown>(data: unknown): {
  rows: T[];
  totalPages: number;
  total: number;
} {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const rows = asList<T>(obj.items ? obj : obj.payload ?? obj);
    const nested =
      obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
        ? (obj.payload as Record<string, unknown>)
        : obj;
    return {
      rows: Array.isArray(nested.items)
        ? (nested.items as T[])
        : rows,
      totalPages: Number(nested.totalPages ?? obj.totalPages ?? 1) || 1,
      total: Number(nested.total ?? nested.count ?? obj.total ?? rows.length) || 0,
    };
  }
  const rows = asList<T>(data);
  return { rows, totalPages: 1, total: rows.length };
}

export function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

export function display(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}
