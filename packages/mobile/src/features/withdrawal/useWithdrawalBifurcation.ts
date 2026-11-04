/**
 * Bifurcation data hook — React Query + date validation.
 */
import { useMemo } from 'react';

import {
  getBifurcationSummary,
  parseBifurcationResult,
  toBifurcationChartData,
  validateBifurcationDateRange,
  type BifurcationResult,
} from '@astro/shared/withdrawalBifurcation';

import { bifurcationQueryKey, type WithdrawalBifurcationParams } from './bifurcationTypes';
import { useScreenQuery } from '../../hooks/useScreenQuery';
import { secureApi } from '../../api/client';

export { bifurcationQueryKey };

async function fetchBifurcation(params: {
  startDate: string;
  endDate: string;
  clientName: string;
}): Promise<BifurcationResult> {
  const payload: Record<string, unknown> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };
  if (params.clientName && params.clientName !== 'All') {
    payload.clientName = params.clientName;
  }
  const res = await secureApi('withdrawals.playedBifurcation', payload);
  if (!res.ok) {
    throw new Error(res.message || 'Failed to fetch bifurcation');
  }
  const parsed = parseBifurcationResult(res.data);
  return parsed;
}

export function useWithdrawalBifurcation(params: WithdrawalBifurcationParams) {
  const startDate = String(params.startDate || '').trim();
  const endDate = String(params.endDate || '').trim();
  const clientName = String(params.clientName || '').trim();

  const dateCheck = useMemo(
    () => validateBifurcationDateRange(startDate, endDate),
    [endDate, startDate],
  );

  const query = useScreenQuery({
    queryKey: bifurcationQueryKey({ startDate, endDate, clientName }),
    enabled: dateCheck.ok,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: () => fetchBifurcation({ startDate, endDate, clientName }),
  });

  const rows = query.data?.rows ?? [];
  const statusTotals = query.data?.statusTotals ?? null;
  const summary = useMemo(
    () => getBifurcationSummary(rows, statusTotals),
    [rows, statusTotals],
  );
  const chartData = useMemo(() => toBifurcationChartData(rows), [rows]);
  const hasData = rows.length > 0 || !!statusTotals;
  const isEmpty =
    dateCheck.ok && !query.loading && !query.errorMessage && query.isSuccess && !hasData;

  return {
    startDate,
    endDate,
    clientName,
    dateCheck,
    rows,
    statusTotals,
    summary,
    chartData,
    hasData,
    isEmpty,
    loading: query.loading,
    refreshing: query.refreshing,
    errorMessage: dateCheck.ok ? query.errorMessage : dateCheck.message,
    isDateError: !dateCheck.ok,
    refresh: query.refresh,
  };
}
