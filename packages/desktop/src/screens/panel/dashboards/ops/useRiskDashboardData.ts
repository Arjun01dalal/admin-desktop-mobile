import { useCallback, useEffect, useState } from 'react';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { normalizeProviderMetrics } from './mergeMetrics';

export type RiskFilters = {
  startDate: string;
  endDate: string;
  appClientName: string;
};

export type RiskBundle = {
  jetfair: Record<string, unknown>;
  falcon: Record<string, unknown>;
  aaa: Record<string, unknown>;
  masterAaa: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function fetchAction(
  action: Parameters<typeof secureApi>[0],
  payload: Record<string, unknown>,
) {
  const res = await secureApi(action, payload);
  return res.ok ? (res.data ?? null) : null;
}

const EMPTY: RiskBundle = {
  jetfair: {},
  falcon: {},
  aaa: {},
  masterAaa: {},
};

/** Loads Risk Analysis APIs (Jetfair / Falcon / AAA / Master AAA). */
export function useRiskDashboardData(filters: RiskFilters) {
  const [bundle, setBundle] = useState<RiskBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const base: Record<string, unknown> = {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
      if (filters.appClientName) base.clientName = filters.appClientName;

      const datesOnly = {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };

      const [jetfair, falcon, aaa, masterAaa] = await Promise.all([
        fetchAction('dashboard.jetfair', base),
        fetchAction('dashboard.falcon', base),
        fetchAction('dashboard.aaaZehnPl', datesOnly),
        fetchAction('dashboard.masterAaaZehnPl', datesOnly),
      ]);

      if (!isCurrent(gen)) return;

      setBundle({
        jetfair: normalizeProviderMetrics(jetfair),
        falcon: normalizeProviderMetrics(falcon),
        aaa: asRecord(aaa),
        masterAaa: asRecord(masterAaa),
      });
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : 'Failed to load risk dashboard');
      setBundle(EMPTY);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [filters, next, begin, end, isCurrent]);

  useEffect(() => {
    void load();
  }, [load]);

  return { bundle, loading, error, reload: load };
}
