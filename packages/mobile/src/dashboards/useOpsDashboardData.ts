/**
 * Loads all ops-dashboard APIs in parallel — port of desktop useOpsDashboardData.
 * Shared by Dashboard / VIP / Combined; mode only changes which cards show.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { secureApi } from '../api/client';
import type { SecureAction } from '../api/registry.generated';
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

export function useOpsDashboardData(
  mode: DashboardMode,
  filters: DashboardFilters,
) {
  const [bundle, setBundle] = useState<OpsDashboardBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genRef = useRef(0);

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
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const base = datePayload(filters);
      const vipSubset = mode === 'vip';

      const tasks: Array<Promise<[string, unknown]>> = [
        fetchAction('dashboard.summary', base).then((d) => ['summary', d]),
        fetchAction('dashboard.depositCount', base).then((d) => ['depositCount', d]),
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
          fetchAction('dashboard.betConstruct', base).then((d) => ['betConstruct', d]),
          fetchAction('dashboard.sportBook', base).then((d) => ['sportBook', d]),
          fetchAction('dashboard.plutus', base).then((d) => ['plutus', d]),
          fetchAction('dashboard.indianDiva', base).then((d) => ['indianDiva', d]),
          fetchAction('dashboard.ludo', {
            startDate: filters.startDate,
            endDate: filters.endDate,
            filter: {},
          }).then((d) => ['ludo', d]),
          fetchAction('dashboard.ludoGameIds', {}).then((d) => ['ludoGameIds', d]),
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
      if (gen !== genRef.current) return;

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
      if (gen !== genRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setBundle(EMPTY);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [mode, filters]);

  const ludoGenRef = useRef(0);
  const reloadLudo = useCallback(
    async (gameId: string) => {
      const mainGen = genRef.current;
      const ludoGen = ++ludoGenRef.current;
      const ludo = await loadLudo(gameId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      // Drop the response if a newer Ludo request or a full reload started since.
      if (ludoGen !== ludoGenRef.current || mainGen !== genRef.current) return;
      setBundle((prev) => (prev ? { ...prev, ludo } : prev));
    },
    [filters.startDate, filters.endDate, loadLudo],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reloadActiveExchange = useCallback(async () => {
    const mainGen = genRef.current;
    const data = await fetchAction('dashboard.activeExchangeGet', {});
    if (mainGen !== genRef.current) return;
    setBundle((prev) =>
      prev ? { ...prev, activeExchange: asRecord(data) } : prev,
    );
  }, []);

  return { bundle, loading, error, reload: load, reloadLudo, reloadActiveExchange };
}
