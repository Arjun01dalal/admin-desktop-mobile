/** Loads Risk Analysis APIs — port of desktop useRiskDashboardData. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { secureApi } from '../api/client';
import type { SecureAction } from '../api/registry.generated';

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

async function fetchAction(action: SecureAction, payload: Record<string, unknown>) {
  const res = await secureApi(action, payload);
  return res.ok ? (res.data ?? null) : null;
}

export function useRiskDashboardData(filters: RiskFilters) {
  const [bundle, setBundle] = useState<RiskBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
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

      if (gen !== genRef.current) return;
      setBundle({
        jetfair: asRecord(jetfair),
        falcon: asRecord(falcon),
        aaa: asRecord(aaa),
        masterAaa: asRecord(masterAaa),
      });
    } catch (err) {
      if (gen !== genRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load risk data');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  return { bundle, loading, error, reload: load };
}
