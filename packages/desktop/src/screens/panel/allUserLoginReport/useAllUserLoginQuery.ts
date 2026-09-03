import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import type { AllUserLoginResponse, AllUserLoginRow } from './types';

export type AllUserLoginFilters = {
  name: string;
  realName: string;
  subAdminId: string;
  mobile: string;
};

export function useAllUserLoginQuery(
  page: number,
  itemsPerPage: number,
  startDate: string,
  endDate: string,
  filters: AllUserLoginFilters,
) {
  const [rows, setRows] = useState<AllUserLoginRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page, filterOverride?: AllUserLoginFilters) => {
      const active = filterOverride ?? filters;
      const gen = next();
      begin();
      setLoading(true);
      try {
        const filter: Record<string, string> = {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
        };
        if (active.subAdminId) filter.subAdminId = active.subAdminId;
        if (active.mobile) filter.mobile = active.mobile;
        if (active.name) filter.name = active.name;
        if (active.realName) filter.realName = active.realName;

        const res = await secureApi<AllUserLoginResponse>('reports.allUserLoginLogout', {
          page: pageNo,
          limit: itemsPerPage,
          filter,
        });

        if (!isCurrent(gen)) return;

        if (!res.ok) {
          toast.error(res.message || 'Failed to load login report');
          startTransition(() => {
            setRows([]);
            setTotal(0);
          });
          return;
        }

        const data = res.data || {};
        startTransition(() => {
          setRows(Array.isArray(data.data) ? data.data : []);
          setTotal(Number(data.total) || 0);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, itemsPerPage, startDate, endDate, filters, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, total, loading, load };
}
