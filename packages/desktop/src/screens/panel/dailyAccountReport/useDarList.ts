import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { PAGE_SIZE } from '@astro/shared/dailyAccountReport';
import type { ListResult } from './api';
import { darApiErrorMessage } from './api';

type FetchArgs = {
  page: number;
  search?: string;
  status?: string;
  source?: string;
};

type Options<T> = {
  fetchPage: (args: FetchArgs) => Promise<ListResult<T>>;
  errorFallback: string;
  onCountChange?: (count: number) => void;
  extraDeps?: unknown[];
  source?: string;
  /** When false, skip the network fetch (e.g. modal closed). */
  enabled?: boolean;
};

/**
 * Paged list state for Daily Account Report list dialogs (bank accounts / MIDs).
 * Cancel-safe: a stale effect run's response is ignored via an AbortController
 * token even though the underlying secureApi/IPC call itself can't be aborted.
 */
export function useDarList<T extends { _id: string }>({
  fetchPage,
  errorFallback,
  onCountChange,
  extraDeps = [],
  source = '',
  enabled = true,
}: Options<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const onCountRef = useRef(onCountChange);
  onCountRef.current = onCountChange;

  // Keep latest fetchPage without re-firing the effect on every render.
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  const applySearch = useCallback(() => {
    setPage(1);
    setAppliedSearch(search.trim());
  }, [search]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetchPageRef
      .current({
        page,
        search: appliedSearch || undefined,
        status: status || undefined,
        source: source || undefined,
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setRows(result.items);
        setTotal(result.total);
        onCountRef.current?.(result.total);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        toast.error(darApiErrorMessage(error, errorFallback));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page, appliedSearch, status, source, reloadKey, errorFallback, ...extraDeps]);

  return {
    rows,
    total,
    page,
    setPage,
    search,
    setSearch,
    status,
    setStatus,
    loading,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    applySearch,
    reload,
    afterSave: (isCreate: boolean) => {
      if (isCreate && page !== 1) setPage(1);
      else reload();
    },
  };
}
