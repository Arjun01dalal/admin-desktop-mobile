import { useCallback, useEffect, useState } from 'react';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { todayIST } from '@/utils/dates';
import { parseLudoGameOptions, parseLudoGameStats } from './gameMetrics';
import { providerWiseActive, normalizeProviderMetrics, pickNum } from './mergeMetrics';
import type { DashboardFilters, DashboardMode, OpsDashboardBundle, SelectOption } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Dig dashboard summary if secure unwrap left a nested `payload` / `data`. */
function unwrapDashboardSummary(raw: unknown): Record<string, unknown> {
  const keys = [
    'totalBalanceOfUsers',
    'totalBonusBalanceOfUsers',
    'totalRegisterUsers',
    'totalActiveUsers',
    'totalActiveUsersApp',
  ] as const;
  const candidates: Record<string, unknown>[] = [];
  const root = asRecord(raw);
  candidates.push(root);
  for (const nestKey of ['payload', 'data', 'result']) {
    const nested = asRecord(root[nestKey]);
    if (Object.keys(nested).length) {
      candidates.push(nested);
      for (const nestKey2 of ['payload', 'data']) {
        const deeper = asRecord(nested[nestKey2]);
        if (Object.keys(deeper).length) candidates.push(deeper);
      }
    }
  }
  for (const candidate of candidates) {
    if (keys.some((k) => k in candidate)) return candidate;
  }
  return root;
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
  todaysActiveCount: 0,
  nonPerformingUserCount: 0,
  prevDayBalance: 0,
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
  ludoGameStatsMap: {},
  activeExchange: {},
};

/**
 * Loads all ops-dashboard APIs in parallel.
 * Shared by Dashboard / VIP / Combined — mode only changes which UI cards show.
 */
export function useOpsDashboardData(mode: DashboardMode, filters: DashboardFilters) {
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

      const activeFilter = filters.appClientName
        ? { clientName: filters.appClientName }
        : {};

      const tasks: Array<Promise<[string, unknown]>> = [
        fetchAction('dashboard.summary', base).then((d) => ['summary', d]),
        fetchAction('dashboard.depositCount', base).then((d) => ['depositCount', d]),
        fetchAction('profitLoss.depositWithdrawal', base).then((d) => ['depositWithdrawal', d]),
        // Provider card active counts (categorywise)
        fetchAction('dashboard.activeCustomersCategory', {
          startDate: filters.startDate,
          endDate: filters.endDate,
          itemsPerPage: 50,
          pageNo: 1,
          activeUserStart: filters.startDate,
          activeUserEnd: filters.endDate,
          filter: activeFilter,
          ...(filters.appClientName ? { app: [filters.appClientName] } : {}),
        }).then((d) => ['activeCustomers', d]),
        fetchAction('dashboard.qtech', base).then((d) => ['qtech', d]),
        fetchAction('dashboard.wco', base).then((d) => ['wco', d]),
        fetchAction('dashboard.falcon', base).then((d) => ['falcon', d]),
        fetchAction('dashboard.jetfair', base).then((d) => ['jetfair', d]),
        fetchAction('dashboard.satta', base).then((d) => ['satta', d]),
      ];

      // Main dashboard KPIs only (laxminarayan Dashboard cards)
      if (mode === 'main') {
        // Laxmi nonPerformStart/End start empty — initial call has NO dates (all-time).
        // Dates are only set after the user changes the date pickers. Match that:
        // omit dates when filter is the default today→today range.
        const today = todayIST();
        const nonPerformUsesDates =
          Boolean(filters.startDate && filters.endDate) &&
          (filters.startDate !== today || filters.endDate !== today);

        tasks.push(
          fetchAction('dashboard.activeCustomers', {
            pageNo: 1,
            itemsPerPage: 10,
            filter: activeFilter,
            startDate: filters.startDate,
            endDate: filters.endDate,
          }).then((d) => ['todaysActive', d]),
          fetchAction('dashboard.nonPerformingUser', {
            pageNo: 1,
            itemPerPage: 10,
            filter: {},
            ...(nonPerformUsesDates
              ? { startDate: filters.startDate, endDate: filters.endDate }
              : {}),
          }).then((d) => ['nonPerforming', d]),
        );
        // Laxmi getUserBalPrevDay — only when viewing a past start date
        if (filters.startDate && filters.startDate !== today) {
          tasks.push(
            fetchAction('analytics.userBalance', { date: filters.startDate }).then((d) => [
              'prevDayBalance',
              d,
            ]),
          );
        }
      }

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
          fetchAction('dashboard.activeExchangeGet', {}).then((d) => ['activeExchange', d]),
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
        } else if (key === 'summary') {
          nextBundle.summary = unwrapDashboardSummary(value);
        } else if (
          key === 'depositCount' ||
          key === 'depositWithdrawal' ||
          key === 'satta'
        ) {
          nextBundle[key] = asRecord(value);
        } else if (
          key === 'falcon' ||
          key === 'jetfair' ||
          key === 'sportBook' ||
          key === 'betConstruct'
        ) {
          nextBundle[key] = normalizeProviderMetrics(value);
        } else if (key === 'activeCustomers') {
          nextBundle.activeCustomers = providerWiseActive(value);
        } else if (key === 'todaysActive') {
          nextBundle.todaysActiveCount = pickNum(value, ['count']);
        } else if (key === 'nonPerforming') {
          nextBundle.nonPerformingUserCount = pickNum(value, ['total']);
        } else if (key === 'prevDayBalance') {
          // Laxmi reads payload.balance; some envelopes also expose totalBalance.
          nextBundle.prevDayBalance = pickNum(value, ['balance', 'totalBalance']);
        }
      }

      nextBundle.ludoGameOptions = ludoOptions;

      // Laxmi: load house-stats for All + every game so the select menu can
      // show Game | Players | Bet | Win | RTP | GGR (All (ggr) closed label).
      const dates = {
        startDate: filters.startDate,
        endDate: filters.endDate,
      };
      const statsEntries = await Promise.all(
        ['All', ...ludoOptions.map((o) => o.value)].map(async (gameId) => {
          if (gameId === 'All') {
            return [gameId, parseLudoGameStats(nextBundle.ludo)] as const;
          }
          const data = await loadLudo(gameId, dates);
          return [gameId, parseLudoGameStats(data)] as const;
        }),
      );
      if (!isCurrent(gen)) return;
      nextBundle.ludoGameStatsMap = Object.fromEntries(statsEntries);

      setBundle(nextBundle);
    } catch (err) {
      if (!isCurrent(gen)) return;
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setBundle(EMPTY);
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [mode, filters, next, begin, end, isCurrent, loadLudo]);

  const reloadLudo = useCallback(
    async (gameId: string) => {
      const ludo = await loadLudo(gameId, {
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
    [filters.startDate, filters.endDate, loadLudo],
  );

  const reloadActiveExchange = useCallback(async () => {
    const data = await fetchAction('dashboard.activeExchangeGet', {});
    setBundle((prev) => (prev ? { ...prev, activeExchange: asRecord(data) } : prev));
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
