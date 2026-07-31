import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import type { PointsReportRow } from './types';

export function usePointsReportQuery(startDate: string, endDate: string) {
  const [rows, setRows] = useState<PointsReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    try {
      const res = await secureApi<PointsReportRow[] | { payload?: PointsReportRow[] }>(
        'reports.subadminCoinReport',
        {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
        },
      );

      if (!isCurrent(gen)) return;

      if (!res.ok) {
        toast.error(res.message || 'Failed to load points report');
        startTransition(() => setRows([]));
        return;
      }

      const raw = res.data;
      const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.payload)
          ? raw.payload
          : [];

      startTransition(() => setRows(items));
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [startDate, endDate, next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading, load };
}
