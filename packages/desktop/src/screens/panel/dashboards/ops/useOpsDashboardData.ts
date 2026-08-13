import { useCallback, useEffect, useState } from 'react';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { parseLudoGameOptions } from './gameMetrics';
import { providerWiseActive } from './mergeMetrics';
import type {
  DashboardFilters,
  DashboardMode,
  OpsDashboardBundle,
  SelectOption,
} from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function datePayload(filters: DashboardFilters) {
  const payload: Record<string, unknown> = {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (filters.appClientName) payload.clientName = filters.appClientName;
  return payload;
}

async function fetchAction(
  action: SecureAction,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const res = await secureApi(action, payload);
  return res.ok ? (res.data ?? null) : null;
}

const EMPTY: OpsDashboardBundle = {
  summary: {},
  depositCount: {},
  depositWithdrawal: {},
  activeCustomers: {},
  qtech: {},
  wco: null,
  falcon: {},
  jetfair: {},
  satta: {},
  betConstruct: {},
  sportBook: {},
  plutus: null,
  indianDiva: null,
  ludo: {},
  ludoGameOptions: [],
  activeExchange: {},
};

/**
 * Loads all ops-dashboard APIs in parallel.
 * Shared by Dashboard / VIP / Combined — mode only changes which UI cards show.
 */
export function useOpsDashboardData(
  mode: DashboardMode,
  filters: DashboardFilters,
) {
  const [bundle, setBundle] = useState<OpsDashboardBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const loadLudo = useCallback(
    async (gameId: string, dates: { startDate: string; endDate: string }) => {
      const filter: Record<string, string> = {};
      if (gameId && gameId !== 'All') filter.gameId = gameId;
      const data = await fetchAction('dashboard.ludo', {
        startDate: dates.startDate,
        endDate: dates.endDate,
        filter,
      });
      return asRecord(data);
    },
    [],
  );

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const base = datePayload(filters);
      const vipSubset = mode === 'vip';

      const tasks: Array<Promise<[string, unknown]>> = [
        fetchAction('dashboard.summary', base).then((d) => ['summary', d]),
        fetchAction('dashboard.depositCount', base).then((d) => [
          'depositCount',
          d,
        ]),
        fetchAction('profitLoss.depositWithdrawal', base).then((d) => [
          'depositWithdrawal',
          d,
        ]),
        fetchAction('dashboard.activeCustomersCategory', {
          startDate: filters.startDate,
          endDate: filters.endDate,
          itemsPerPage: 50,
          pageNo: 1,
          activeUserStart: filters.startDate,
          activeUserEnd: filters.endDate,
          filter: filters.appClientName
            ? { clientName: filters.appClientName }
            : {},
          ...(filters.appClientName
            ? { app: [filters.appClientName] }
            : {}),
        }).then((d) => ['activeCustomers', d]),
        fetchAction('dashboard.qtech', base).then((d) => ['qtech', d]),
        fetchAction('dashboard.wco', base).then((d) => ['wco', d]),
        fetchAction('dashboard.falcon', base).then((d) => ['falcon', d]),
        fetchAction('dashboard.jetfair', base).then((d) => ['jetfair', d]),
        fetchAction('dashboard.satta', base).then((d) => ['satta', d]),
      ];

      if (!vipSubset) {
        tasks.push(
          fetchAction('dashboard.betConstruct', base).then((d) => [
            'betConstruct',
            d,
          ]),
          fetchAction('dashboard.sportBook', base).then((d) => [
            'sportBook',
            d,
          ]),
          fetchAction('dashboard.plutus', base).then((d) => ['plutus', d]),
          fetchAction('dashboard.indianDiva', base).then((d) => [
            'indianDiva',
            d,
          ]),
          fetchAction('dashboard.ludo', {
            startDate: filters.startDate,
            endDate: filters.endDate,
            filter: {},
          }).then((d) => ['ludo', d]),
          fetchAction('dashboard.ludoGameIds', {}).then((d) => [
            'ludoGameIds',
            d,
          ]),
        );
      }

      // AAA zehnPL is part of Ashwini / Exaltation totals (laxminarayan Dashboard + VIP).
      tasks.push(
        fetchAction('dashboard.aaaZehnPl', {
          startDate: filters.startDate,
          endDate: filters.endDate,
        }).then((d) => ['aaa', d]),
      );

      if (mode === 'main') {
        tasks.push(
          fetchAction('dashboard.activeExchangeGet', {}).then((d) => [
            'activeExchange',
            d,
          ]),
        );
      }

      const results = await Promise.all(tasks);
      if (!isCurrent(gen)) return;

      const nextBundle: OpsDashboardBundle = { ...EMPTY };
      let ludoOptions: SelectOption[] = [];

      for (const [key, value] of results) {
        if (key === 'wco' || key === 'plutus' || key === 'indianDiva') {
          nextBundle[key] = value;
        } else if (key === 'ludoGameIds') {
          ludoOptions = parseLudoGameOptions(value);
        } else if (key === 'activeExchange') {
          nextBundle.activeExchange = asRecord(value);
        } else if (key === 'aaa') {
          nextBundle.aaa = asRecord(value);
        } else if (key === 'ludo') {
          nextBundle.ludo = asRecord(value);
        } else if (key === 'qtech') {
          nextBundle.qtech = asRecord(value);
        } else if (
          key === 'summary' ||
          key === 'depositCount' ||
          key === 'depositWithdrawal' ||
          key === 'falcon' ||
          key === 'jetfair' ||
          key === 'satta' ||
          key === 'betConstruct' ||
          key === 'sportBook'
        ) {
          nextBundle[key] = asRecord(value);
        } else if (key === 'activeCustomers') {
          nextBundle.activeCustomers = providerWiseActive(value);
        }
      }

      nextBundle.ludoGameOptions = ludoOptions;
      setBundle(nextBundle);
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setBundle(EMPTY);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [mode, filters, next, begin, end, isCurrent]);

  const reloadLudo = useCallback(
    async (gameId: string) => {
      const ludo = await loadLudo(gameId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      setBundle((prev) => (prev ? { ...prev, ludo } : prev));
    },
    [filters.startDate, filters.endDate, loadLudo],
  );

  const reloadActiveExchange = useCallback(async () => {
    const data = await fetchAction('dashboard.activeExchangeGet', {});
    setBundle((prev) =>
      prev ? { ...prev, activeExchange: asRecord(data) } : prev,
    );
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
