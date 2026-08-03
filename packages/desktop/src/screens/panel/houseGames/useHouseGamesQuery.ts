import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import type { FiltersState } from './constants';
import { buildFilterPayload } from './utils';
import type { HouseGameTransaction, HouseGamesListResponse } from './types';

export function useHouseGamesQuery(
  filters: FiltersState,
  startDate: string,
  endDate: string,
  itemsPerPage: number,
  currentPage: number,
) {
  const [listData, setListData] = useState<HouseGamesListResponse>({});
  const [loader, setLoader] = useState(false);
  const filtersRef = useRef(filters);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const dataArr = useMemo<HouseGameTransaction[]>(() => {
    const raw = listData as HouseGamesListResponse & {
      data?: HouseGameTransaction[] | { items?: HouseGameTransaction[] };
      results?: HouseGameTransaction[];
      docs?: HouseGameTransaction[];
    };
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.transactions)) return raw.transactions;
    if (Array.isArray(raw?.results)) return raw.results;
    if (Array.isArray(raw?.docs)) return raw.docs;
    if (Array.isArray(raw?.data)) return raw.data;
    if (raw?.data && typeof raw.data === 'object' && Array.isArray(raw.data.items)) {
      return raw.data.items;
    }
    return [];
  }, [listData]);

  const totalCount = Number(listData?.total ?? listData?.count ?? 0);
  const totalAmount = listData?.totals?.totalAmount;
  const totalPages = Number(
    listData?.totalPages ?? Math.max(1, Math.ceil(totalCount / itemsPerPage) || 1),
  );

  const getTransactions = useCallback(
    async (page = currentPage) => {
      const gen = next();
      begin();
      const filter = buildFilterPayload(filtersRef.current);
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemsPerPage,
        startDate,
        endDate,
      };
      if (Object.keys(filter).length > 0) {
        payload.filter = filter;
      }

      setLoader(true);
      try {
        const res = await secureApi<HouseGamesListResponse>(
          'houseGames.transactions',
          payload,
        );
        if (!isCurrent(gen)) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to fetch transactions');
          return;
        }
        startTransition(() => setListData(res.data || {}));
      } catch (error: unknown) {
        if (!isCurrent(gen)) return;
        toast.error(
          error instanceof Error ? error.message : 'Failed to fetch transactions',
        );
      } finally {
        end();
        if (isCurrent(gen)) setLoader(false);
      }
    },
    [currentPage, itemsPerPage, startDate, endDate, isCurrent, next, begin, end],
  );

  useEffect(() => {
    void getTransactions(currentPage);
  }, [currentPage, itemsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    dataArr,
    totalCount,
    totalAmount,
    totalPages,
    loader,
    getTransactions,
  };
}
