/**
 * Played today / yesterday — shared types & parsers
 * (admin-panel-domains Dashboard + PlayedTodayYesterday).
 *
 * Dashboard KPIs prefer one probe call that returns summary counts for all
 * play types; missing counts fall back to parallel per-type totals.
 */

export const PLAY_TYPES = [
  'today_not_yesterday',
  'yesterday_not_today',
  'new_user_active',
  'today_and_yesterday',
] as const;

export type PlayType = (typeof PLAY_TYPES)[number];

export type PlayedTodayYesterdayCounts = Record<PlayType, number>;

export type PlaySummary = {
  date?: string;
  previousDate?: string;
  today?: string;
  yesterday?: string;
  todayNotYesterdayCount?: number;
  yesterdayNotTodayCount?: number;
  todayAndYesterdayCount?: number;
  newUserActiveCount?: number;
  companyCount?: number;
  humanCount?: number;
  activeByBotCount?: number;
};

export const PLAY_FILTERS: { type: PlayType; label: string }[] = [
  { type: 'today_not_yesterday', label: 'Played today but not yesterday' },
  { type: 'yesterday_not_today', label: 'Played yesterday but not today' },
  { type: 'new_user_active', label: 'New user active' },
  { type: 'today_and_yesterday', label: 'Played today and yesterday' },
];

export const PLAY_TYPE_LABELS: Record<PlayType, string> = PLAY_FILTERS.reduce(
  (titles, filter) => {
    titles[filter.type] = filter.label;
    return titles;
  },
  {} as Record<PlayType, string>,
);

export const COUNT_BY_TYPE: Record<PlayType, keyof PlaySummary> = {
  today_not_yesterday: 'todayNotYesterdayCount',
  yesterday_not_today: 'yesterdayNotTodayCount',
  today_and_yesterday: 'todayAndYesterdayCount',
  new_user_active: 'newUserActiveCount',
};

export const BREAKDOWN_COUNTS: { key: keyof PlaySummary; label: string }[] = [
  { key: 'companyCount', label: 'Company' },
  { key: 'humanCount', label: 'Human' },
  { key: 'activeByBotCount', label: 'Active by bot' },
];

export const PLAY_SUMMARY_META: { key: keyof PlaySummary; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'previousDate', label: 'Previous Date' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
];

const SUMMARY_KEYS: (keyof PlaySummary)[] = [
  'date',
  'previousDate',
  'today',
  'yesterday',
  'todayNotYesterdayCount',
  'yesterdayNotTodayCount',
  'todayAndYesterdayCount',
  'newUserActiveCount',
  'companyCount',
  'humanCount',
  'activeByBotCount',
];

export const DEFAULT_PLAYED_PAGE_SIZE = 50;
export const PLAYED_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 250] as const;

export function emptyPlayedCounts(): PlayedTodayYesterdayCounts {
  return {
    today_not_yesterday: 0,
    yesterday_not_today: 0,
    new_user_active: 0,
    today_and_yesterday: 0,
  };
}

export function emptyPlaySummary(): PlaySummary {
  return {};
}

export function isPlayType(value: unknown): value is PlayType {
  return PLAY_TYPES.includes(value as PlayType);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapBody(data: unknown): Record<string, unknown> | unknown[] {
  if (Array.isArray(data)) return data;
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  if (Object.keys(nested).length) return nested;
  const nestedData = asRecord(root.data);
  if (Object.keys(nestedData).length) return nestedData;
  return root;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export type PlayedTodayYesterdayQuery = {
  type: PlayType;
  pageNo: number;
  itemsPerPage: number;
  date?: string;
  empCode?: string;
  clientName?: string;
  state?: string[];
};

/** Build POST body for `/User/played-today-yesterday`. */
export function buildPlayedTodayYesterdayPayload(
  query: PlayedTodayYesterdayQuery,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: query.type,
    pageNo: query.pageNo,
    itemsPerPage: query.itemsPerPage,
  };
  if (query.date) payload.date = query.date;
  if (query.empCode != null) payload.empCode = query.empCode;
  if (query.clientName != null) payload.clientName = query.clientName;
  if (query.state?.length) payload.state = query.state;
  return payload;
}

export function readPlaySummary(data: unknown): PlaySummary {
  const body = unwrapBody(data);
  const payload = Array.isArray(body) ? {} : body;
  const summary: PlaySummary = {};
  for (const key of SUMMARY_KEYS) {
    const value = payload[key];
    if (value != null && value !== '') {
      (summary as Record<string, string | number>)[key] = value as string | number;
    }
  }
  return summary;
}

function extractItems(body: Record<string, unknown> | unknown[]): unknown[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.users)) return body.users;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.list)) return body.list;
  if (Array.isArray(body.user)) return body.user;
  return [];
}

export type PlayedTodayYesterdayPage = {
  rows: Record<string, unknown>[];
  total: number;
  totalPages: number;
  summary: PlaySummary;
};

export function normalizePlayedTodayYesterday(
  data: unknown,
  itemsPerPage: number,
): PlayedTodayYesterdayPage {
  const body = unwrapBody(data);
  const items = extractItems(body);
  const payload = Array.isArray(body) ? {} : body;
  const total = toFiniteNumber(
    payload.total ?? payload.totalCount ?? payload.count ?? payload.totalItems ?? items.length,
    items.length,
  );
  const totalPages =
    toFiniteNumber(payload.totalPages, 0) ||
    Math.max(1, Math.ceil((total || items.length) / Math.max(1, itemsPerPage)) || 1);

  return {
    rows: items.filter((row) => row && typeof row === 'object') as Record<string, unknown>[],
    total,
    totalPages: Math.max(1, totalPages),
    summary: readPlaySummary(data),
  };
}

/** Pull KPI counts from a list/summary response when present. */
export function countsFromSummary(summary: PlaySummary): Partial<PlayedTodayYesterdayCounts> {
  const out: Partial<PlayedTodayYesterdayCounts> = {};
  for (const type of PLAY_TYPES) {
    const key = COUNT_BY_TYPE[type];
    const raw = summary[key];
    if (raw != null && raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n)) out[type] = n;
    }
  }
  return out;
}

export function mergePlayedCounts(
  fromSummary: Partial<PlayedTodayYesterdayCounts>,
  perTypeTotals: Partial<PlayedTodayYesterdayCounts>,
): PlayedTodayYesterdayCounts {
  const base = emptyPlayedCounts();
  for (const type of PLAY_TYPES) {
    const summaryVal = fromSummary[type];
    const totalVal = perTypeTotals[type];
    if (summaryVal != null) base[type] = summaryVal;
    else if (totalVal != null) base[type] = totalVal;
  }
  return base;
}

/**
 * Resolve all four KPI counts with one probe call when possible.
 * `fetchRaw` should return the decrypted API body (or null on failure).
 */
export async function resolvePlayedTodayYesterdayCounts(
  fetchRaw: (payload: Record<string, unknown>) => Promise<unknown>,
  date?: string,
): Promise<PlayedTodayYesterdayCounts> {
  const probeType: PlayType = 'today_not_yesterday';
  const probe = await fetchRaw(
    buildPlayedTodayYesterdayPayload({
      type: probeType,
      pageNo: 1,
      itemsPerPage: 1,
      date,
    }),
  );
  const parsed = normalizePlayedTodayYesterday(probe, 1);
  const fromSummary = countsFromSummary(parsed.summary);
  if (fromSummary[probeType] == null) {
    fromSummary[probeType] = parsed.total;
  }

  const missing = PLAY_TYPES.filter((type) => fromSummary[type] == null);
  if (missing.length === 0) {
    return mergePlayedCounts(fromSummary, {});
  }

  const settled = await Promise.allSettled(
    missing.map(async (type) => {
      const raw = await fetchRaw(
        buildPlayedTodayYesterdayPayload({
          type,
          pageNo: 1,
          itemsPerPage: 1,
          date,
        }),
      );
      const page = normalizePlayedTodayYesterday(raw, 1);
      const fromPage = countsFromSummary(page.summary);
      return [type, fromPage[type] ?? page.total] as const;
    }),
  );

  const perType: Partial<PlayedTodayYesterdayCounts> = {};
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      perType[result.value[0]] = result.value[1];
    }
  }
  return mergePlayedCounts(fromSummary, perType);
}

export function rowMobile(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  const raw =
    row.mobile ?? row.userMobile ?? row.phone ?? row.phoneNumber ?? row.phone_number ?? '';
  return String(raw || '').trim();
}

export function rowUserId(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  const raw = row._id ?? row.userId ?? row.id ?? '';
  return String(raw || '').trim();
}

export function rowDisplayName(row: Record<string, unknown> | null | undefined): string {
  if (!row) return '';
  return String(row.name ?? row.userName ?? row.client_name ?? '').trim();
}
