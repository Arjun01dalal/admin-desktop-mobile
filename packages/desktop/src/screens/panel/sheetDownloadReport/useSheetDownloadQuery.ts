import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import type { PaymentGatewayMid, SheetDownloadListResponse, SheetDownloadRow } from './types';

export function useSheetDownloadQuery(
  page: number,
  itemsPerPage: number,
  startDate: string,
  endDate: string,
  mid: string,
) {
  const [rows, setRows] = useState<SheetDownloadRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gateways, setGateways] = useState<PaymentGatewayMid[]>([]);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const loadGateways = useCallback(async () => {
    const res = await secureApi<PaymentGatewayMid[] | { payload?: PaymentGatewayMid[] }>(
      'reports.getAllMidOld',
      {},
    );
    if (!res.ok) return;
    const raw = res.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.payload) ? raw.payload : [];
    setGateways(list);
  }, []);

  const load = useCallback(
    async (pageNo = page) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const res = await secureApi<SheetDownloadListResponse>('reports.sheetDownloadAudit', {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
          itemsPerPage,
          pageNo,
          filter: { mid: mid || undefined },
        });

        if (!isCurrent(gen)) return;

        if (!res.ok) {
          toast.error(res.message || 'Failed to load sheet download report');
          startTransition(() => {
            setRows([]);
            setTotal(0);
            setTotalPages(1);
          });
          return;
        }

        const data = res.data || {};
        startTransition(() => {
          setRows(data.items || []);
          setTotal(data.total ?? 0);
          setTotalPages(Math.max(1, data.totalPages ?? 1));
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [page, itemsPerPage, startDate, endDate, mid, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  useEffect(() => {
    void load(page);
  }, [page, itemsPerPage, mid]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, totalPages, total, loading, gateways, load };
}
