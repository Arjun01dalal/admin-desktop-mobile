import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  buildSubadminReportQuery,
  parseSubadminLogoutReport,
  type SubadminLogoutRow,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';

export function useSubadminReportQuery(
  page: number,
  limit: number,
  startDate: string,
  endDate: string,
) {
  const [rows, setRows] = useState<SubadminLogoutRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(
    async (pageNo = page) => {
      const query = buildSubadminReportQuery({
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
        page: pageNo,
        limit,
      });
      if ('error' in query) {
        toast.error(query.error);
        return;
      }

      const gen = next();
      begin();
      setLoading(true);
      try {
        const res = await secureApi('reports.automaticLogoutDetails', query);
        if (!isCurrent(gen)) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load Subadmin Report');
          startTransition(() => {
            setRows([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const parsed = parseSubadminLogoutReport(res.data, {
          page: query.page,
          limit: query.limit,
        });
        startTransition(() => {
          setRows(parsed.rows);
          setTotal(parsed.total);
          setTotalPages(parsed.totalPages);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, limit, startDate, endDate, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load(page);
  }, [page, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, total, totalPages, loading, load };
}
