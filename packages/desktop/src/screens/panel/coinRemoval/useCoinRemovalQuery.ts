import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import type { CoinRemovalListResponse, CoinRemovalRow } from './types';

export function useCoinRemovalQuery(
  page: number,
  itemsPerPage: number,
  startDate: string,
  endDate: string,
) {
  const [rows, setRows] = useState<CoinRemovalRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const effectiveStart = startDate || todayIST();
        const effectiveEnd = endDate || todayIST();

        const res = await secureApi<CoinRemovalListResponse>(
          'users.coinRemovalUsers',
          {
            itemsPerPage,
            pageNo,
            startDate: effectiveStart,
            endDate: effectiveEnd,
          },
        );

        if (!isCurrent(gen)) return;

        if (!res.ok) {
          toast.error(res.message || 'Failed to load coin removal list');
          startTransition(() => {
            setRows([]);
            setTotalPages(1);
          });
          return;
        }

        const data = res.data || {};
        const items = data.items || [];
        if (items.length <= 0) {
          toast.info('No Coins removal available for the selected date');
        }

        startTransition(() => {
          setRows(items);
          setTotalPages(Math.max(1, data.totalPages ?? 1));
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, itemsPerPage, startDate, endDate, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, totalPages, loading, load };
}
