/**
 * Pure ops-dashboard loader — desktop + mobile inject their secure fetch.
 */
import { emptyPlayedCounts, resolvePlayedTodayYesterdayCounts } from '../playedTodayYesterday';
import { parseLudoGameOptions, parseLudoGameStats } from './gameMetrics';
import { normalizeProviderMetrics, pickNum, providerWiseActive } from './mergeMetrics';
import type {
  DashboardFilters,
  DashboardMode,
  OpsDashboardBundle,
  SelectOption,
} from './types';

export type OpsSecureFetch = (
  action: string,
  payload: Record<string, unknown>,
) => Promise<unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Dig dashboard summary if secure unwrap left a nested `payload` / `data`. */
export function unwrapDashboardSummary(raw: unknown): Record<string, unknown> {
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

export function datePayload(filters: DashboardFilters): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (filters.appClientName) payload.clientName = filters.appClientName;
  return payload;
}

export const EMPTY_OPS_BUNDLE: OpsDashboardBundle = {
  summary: {},
  depositCount: {},
  depositWithdrawal: {},
  activeCustomers: {},
  todaysActiveCount: 0,
  nonPerformingUserCount: 0,
  playedTodayYesterdayCounts: emptyPlayedCounts(),
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

export async function fetchLudoGame(
  fetchAction: OpsSecureFetch,
  gameId: string,
  dates: { startDate: string; endDate: string },
): Promise<Record<string, unknown>> {
  const filter: Record<string, string> = {};
  if (gameId && gameId !== 'All') filter.gameId = gameId;
  const data = await fetchAction('dashboard.ludo', {
    startDate: dates.startDate,
    endDate: dates.endDate,
    filter,
  });
  return asRecord(data);
}

/**
 * Load the full ops dashboard bundle (parallel APIs + Ludo per-game stats).
 * Caller is responsible for stale-generation / unmount guards around this call.
 */
export async function loadOpsDashboardBundle(opts: {
  mode: DashboardMode;
  filters: DashboardFilters;
  fetchAction: OpsSecureFetch;
  /** Today's date in IST (YYYY-MM-DD) — platform date helper. */
  todayIST: string;
}): Promise<OpsDashboardBundle> {
  const { mode, filters, fetchAction, todayIST } = opts;
  const base = datePayload(filters);
  const vipSubset = mode === 'vip';
  const activeFilter = filters.appClientName ? { clientName: filters.appClientName } : {};

  const tasks: Array<Promise<[string, unknown]>> = [
    fetchAction('dashboard.summary', base).then((d) => ['summary', d]),
    fetchAction('dashboard.depositCount', base).then((d) => ['depositCount', d]),
    fetchAction('profitLoss.depositWithdrawal', base).then((d) => ['depositWithdrawal', d]),
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

  if (mode === 'main') {
    const nonPerformUsesDates =
      Boolean(filters.startDate && filters.endDate) &&
      (filters.startDate !== todayIST || filters.endDate !== todayIST);

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
      resolvePlayedTodayYesterdayCounts(
        (payload) => fetchAction('dashboard.playedTodayYesterday', payload),
        filters.startDate || undefined,
      ).then((d) => ['playedTodayYesterday', d]),
    );
    if (filters.startDate && filters.startDate !== todayIST) {
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

  tasks.push(
    fetchAction('dashboard.aaaZehnPl', {
      startDate: filters.startDate,
      endDate: filters.endDate,
    }).then((d) => ['aaa', d]),
  );

  if (mode === 'main') {
    tasks.push(fetchAction('dashboard.activeExchangeGet', {}).then((d) => ['activeExchange', d]));
  }

  const results = await Promise.all(tasks);
  const nextBundle: OpsDashboardBundle = { ...EMPTY_OPS_BUNDLE };
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
    } else if (key === 'depositCount' || key === 'depositWithdrawal' || key === 'satta') {
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
    } else if (key === 'playedTodayYesterday') {
      nextBundle.playedTodayYesterdayCounts =
        value && typeof value === 'object'
          ? {
              ...emptyPlayedCounts(),
              ...(value as OpsDashboardBundle['playedTodayYesterdayCounts']),
            }
          : emptyPlayedCounts();
    } else if (key === 'prevDayBalance') {
      nextBundle.prevDayBalance = pickNum(value, ['balance', 'totalBalance']);
    }
  }

  nextBundle.ludoGameOptions = ludoOptions;

  const dates = { startDate: filters.startDate, endDate: filters.endDate };
  const statsEntries = await Promise.all(
    ['All', ...ludoOptions.map((o) => o.value)].map(async (gameId) => {
      if (gameId === 'All') {
        return [gameId, parseLudoGameStats(nextBundle.ludo)] as const;
      }
      const data = await fetchLudoGame(fetchAction, gameId, dates);
      return [gameId, parseLudoGameStats(data)] as const;
    }),
  );
  nextBundle.ludoGameStatsMap = Object.fromEntries(statsEntries);

  return nextBundle;
}

export async function loadActiveExchange(
  fetchAction: OpsSecureFetch,
): Promise<Record<string, unknown>> {
  const data = await fetchAction('dashboard.activeExchangeGet', {});
  return asRecord(data);
}
