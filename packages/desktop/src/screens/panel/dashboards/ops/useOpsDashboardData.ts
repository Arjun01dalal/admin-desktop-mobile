/**
 * React wrapper around shared `loadOpsDashboardBundle`.
 * Shared by Dashboard / VIP / Combined — mode only changes which UI cards show.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  EMPTY_OPS_BUNDLE,
  fetchLudoGame,
  loadActiveExchange,
  loadOpsDashboardBundle,
  parseLudoGameStats,
  type DashboardFilters,
  type DashboardMode,
  type OpsDashboardBundle,
} from '@astro/shared/opsDashboard';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';

async function fetchAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await secureApi(action as SecureAction, payload);
  return res.ok ? (res.data ?? null) : null;
}

export function useOpsDashboardData(mode: DashboardMode, filters: DashboardFilters) {
  const [bundle, setBundle] = useState<OpsDashboardBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const nextBundle = await loadOpsDashboardBundle({
        mode,
        filters,
        fetchAction,
        todayIST: todayIST(),
      });
      if (!isCurrent(gen)) return;
      setBundle(nextBundle);
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setBundle(EMPTY_OPS_BUNDLE);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [mode, filters, next, begin, end, isCurrent]);

  const reloadLudo = useCallback(
    async (gameId: string) => {
      const ludo = await fetchLudoGame(fetchAction, gameId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      const stats = parseLudoGameStats(ludo);
      setBundle((prev) =>
        prev
          ? {
              ...prev,
              ludo,
              ludoGameStatsMap: {
                ...prev.ludoGameStatsMap,
                [gameId || 'All']: stats,
              },
            }
          : prev,
      );
    },
    [filters.startDate, filters.endDate],
  );

  const reloadActiveExchange = useCallback(async () => {
    const data = await loadActiveExchange(fetchAction);
    setBundle((prev) => (prev ? { ...prev, activeExchange: data } : prev));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    bundle,
    loading,
    error,
    reload: load,
    reloadLudo,
    reloadActiveExchange,
  };
}
