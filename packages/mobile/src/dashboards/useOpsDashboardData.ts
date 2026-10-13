/**
 * React wrapper around shared `loadOpsDashboardBundle`.
 * Shared by Dashboard / VIP / Combined; mode only changes which cards show.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { secureApi } from '../api/client';
import type { SecureAction } from '../api/registry.generated';
import { todayIST } from '../utils/dates';

async function fetchAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await secureApi(action as SecureAction, payload);
  return res.ok ? (res.data ?? null) : null;
}

export function useOpsDashboardData(mode: DashboardMode, filters: DashboardFilters) {
  const [bundle, setBundle] = useState<OpsDashboardBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);
  const ludoGenRef = useRef(0);

  useEffect(() => {
    return () => {
      genRef.current += 1;
      ludoGenRef.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const nextBundle = await loadOpsDashboardBundle({
        mode,
        filters,
        fetchAction,
        todayIST: todayIST(),
      });
      if (gen !== genRef.current) return;
      setBundle(nextBundle);
    } catch (err) {
      if (gen !== genRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setBundle(EMPTY_OPS_BUNDLE);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [mode, filters]);

  const reloadLudo = useCallback(
    async (gameId: string) => {
      const mainGen = genRef.current;
      const ludoGen = ++ludoGenRef.current;
      const ludo = await fetchLudoGame(fetchAction, gameId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      if (ludoGen !== ludoGenRef.current || mainGen !== genRef.current) return;
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
    const mainGen = genRef.current;
    const data = await loadActiveExchange(fetchAction);
    if (mainGen !== genRef.current) return;
    setBundle((prev) => (prev ? { ...prev, activeExchange: data } : prev));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { bundle, loading, error, reload: load, reloadLudo, reloadActiveExchange };
}
