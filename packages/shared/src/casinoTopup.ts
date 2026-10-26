/**
 * Casino Top-up / Qtech remaining balance — shared parsers + submit helpers.
 * Used by desktop CasinoTopupBalancePage and mobile CasinoTopupBalanceScreen.
 */

export type RemainingBreakdownRow = {
  _id?: string;
  id?: string;
  provider?: string;
  providerName?: string;
  game?: string;
  gameName?: string;
  name?: string;
  gameId?: string | number;
  game_id?: string | number;
  tableId?: string | number;
  code?: string;
  ggrUsd?: number;
  ggr?: number;
  amountUsd?: number;
  amount?: number;
  ggrInr?: number;
  amountInr?: number;
  inr?: number;
  consumedUsd?: number;
  betAmount?: number;
  turnover?: number;
  [key: string]: unknown;
};

export type QtechRemainingSummary = {
  remainingUsd: number | null;
  toppedUpUsd: number | null;
  consumedUsd: number | null;
  currency: string;
  usdToInr: number | null;
  feeInr: number | null;
  ggrUsd: number | null;
  ggrInr: number | null;
  rangeStart: string;
  rangeEnd: string;
  toppedUpAt: string;
  toppedUpAtIst: string;
  byGame: RemainingBreakdownRow[];
  byProvider: RemainingBreakdownRow[];
  unmatchedGamesCount: number | null;
};

/** POST /Qtech/topup-balance-remaining body (Laxmi remaining modal). */
export type RemainingSubmitPayload = {
  amount: number;
  date: string;
  time: string;
};

export type RemainingFormState = {
  amount: string;
  date: string;
  time: string;
};

export type RemainingFormErrors = {
  amount: boolean;
  date: boolean;
  time: boolean;
};

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveRootPayload(decrypted: unknown): unknown {
  if (decrypted == null) return null;
  if (Array.isArray(decrypted)) return decrypted;
  if (typeof decrypted !== 'object') return decrypted;
  const obj = decrypted as Record<string, unknown>;
  const nestedData =
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : null;
  return obj.payload ?? nestedData?.payload ?? obj.data ?? obj.result ?? decrypted;
}

function istParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    day: get('day'),
    month: get('month'),
    year: get('year'),
    hour: get('hour'),
    minute: get('minute'),
    dayPeriod: get('dayPeriod').toLowerCase(),
  };
}

/** Laxmi remaining form date: `24-08-2026` (IST). */
export function formatRemainingDateIst(now = new Date()): string {
  const { day, month, year } = istParts(now);
  return `${day}-${month}-${year}`;
}

/** Laxmi remaining form time: `05:44 p.m.` (IST). */
export function formatRemainingTimeIst(now = new Date()): string {
  const { hour, minute, dayPeriod } = istParts(now);
  const h = hour.padStart(2, '0');
  const period = dayPeriod === 'am' || dayPeriod === 'a.m.' ? 'a.m.' : 'p.m.';
  return `${h}:${minute} ${period}`;
}

export function emptyRemainingForm(now = new Date()): RemainingFormState {
  return {
    amount: '',
    date: formatRemainingDateIst(now),
    time: formatRemainingTimeIst(now),
  };
}

export function emptyRemainingFormErrors(): RemainingFormErrors {
  return { amount: false, date: false, time: false };
}

/**
 * Validate remaining modal fields and build API payload.
 * Amount may be any finite number (including decimals); date/time required strings.
 */
export function buildRemainingSubmitPayload(
  form: RemainingFormState,
): { ok: true; payload: RemainingSubmitPayload } | { ok: false; errors: RemainingFormErrors } {
  const amount = Number(form.amount);
  const amountError = !String(form.amount).trim() || !Number.isFinite(amount);
  const dateError = !form.date.trim();
  const timeError = !form.time.trim();
  if (amountError || dateError || timeError) {
    return {
      ok: false,
      errors: { amount: amountError, date: dateError, time: timeError },
    };
  }
  return {
    ok: true,
    payload: {
      amount,
      date: form.date.trim(),
      time: form.time.trim(),
    },
  };
}

export function emptyRemainingSummary(): QtechRemainingSummary {
  return {
    remainingUsd: null,
    toppedUpUsd: null,
    consumedUsd: null,
    currency: 'USD',
    usdToInr: null,
    feeInr: null,
    ggrUsd: null,
    ggrInr: null,
    rangeStart: '',
    rangeEnd: '',
    toppedUpAt: '',
    toppedUpAtIst: '',
    byGame: [],
    byProvider: [],
    unmatchedGamesCount: null,
  };
}

export function formatMoney(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function parseQtechRemaining(decrypted: unknown): QtechRemainingSummary {
  const root = resolveRootPayload(decrypted) ?? decrypted;
  let payload: Record<string, unknown> = {};
  if (root && typeof root === 'object' && !Array.isArray(root)) {
    const obj = root as Record<string, unknown>;
    if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      payload = obj.payload as Record<string, unknown>;
    } else if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      payload = obj.data as Record<string, unknown>;
    } else {
      payload = obj;
    }
  }
  const range =
    payload.range && typeof payload.range === 'object' && !Array.isArray(payload.range)
      ? (payload.range as Record<string, unknown>)
      : {};

  const date = payload.date != null ? String(payload.date) : '';
  const time = payload.time != null ? String(payload.time) : '';
  const dateTimeLabel = [date, time].filter(Boolean).join(' ');

  return {
    remainingUsd:
      toNumber(payload.remainingUsd) ??
      toNumber(payload.remainingBalance) ??
      toNumber(payload.amount),
    toppedUpUsd: toNumber(payload.toppedUpUsd) ?? toNumber(payload.toppedUpBalance),
    consumedUsd: toNumber(payload.consumedUsd) ?? toNumber(payload.consumedBalance),
    currency: String(payload.currency || 'USD'),
    usdToInr: toNumber(payload.usdToInr) ?? toNumber(payload.usdInr),
    feeInr: toNumber(payload.feeInr) ?? toNumber(payload.fee),
    ggrUsd: toNumber(payload.ggrUsd) ?? toNumber(payload.ggr),
    ggrInr: toNumber(payload.ggrInr),
    rangeStart: String(range.start || ''),
    rangeEnd: String(range.end || ''),
    toppedUpAt: String(payload.toppedUpAt || ''),
    toppedUpAtIst: String(payload.toppedUpAtIst || dateTimeLabel),
    byGame: Array.isArray(payload.byGame) ? (payload.byGame as RemainingBreakdownRow[]) : [],
    byProvider: Array.isArray(payload.byProvider)
      ? (payload.byProvider as RemainingBreakdownRow[])
      : [],
    unmatchedGamesCount: toNumber(payload.unmatchedGamesCount),
  };
}

/** After submit: prefer response parse; fall back to request amount + date/time. */
export function mergeRemainingAfterSubmit(
  responseData: unknown,
  request: RemainingSubmitPayload,
): QtechRemainingSummary {
  try {
    const parsed = parseQtechRemaining(responseData);
    if (
      parsed.remainingUsd != null ||
      parsed.byGame.length > 0 ||
      parsed.byProvider.length > 0 ||
      parsed.toppedUpUsd != null
    ) {
      if (!parsed.toppedUpAtIst) {
        parsed.toppedUpAtIst = [request.date, request.time].filter(Boolean).join(' ');
      }
      if (parsed.remainingUsd == null) parsed.remainingUsd = request.amount;
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return {
    ...emptyRemainingSummary(),
    remainingUsd: request.amount,
    toppedUpAtIst: [request.date, request.time].filter(Boolean).join(' '),
  };
}

export function remainingRowLabel(item: RemainingBreakdownRow, mode: 'provider' | 'game'): string {
  if (mode === 'provider') {
    return String(item.provider || item.providerName || item.name || '—');
  }
  return String(item.game || item.gameName || item.name || item.provider || '—');
}

export function remainingRowCode(item: RemainingBreakdownRow): string {
  return String(item.gameId || item.game_id || item.tableId || item.code || '—');
}

export function remainingRowGgrUsd(item: RemainingBreakdownRow): string {
  return formatMoney(
    toNumber(item.ggrUsd) ??
      toNumber(item.ggr) ??
      toNumber(item.amountUsd) ??
      toNumber(item.amount),
  );
}

export function remainingRowGgrInr(item: RemainingBreakdownRow): string {
  return formatMoney(toNumber(item.ggrInr) ?? toNumber(item.amountInr) ?? toNumber(item.inr));
}

export function remainingRowConsumed(item: RemainingBreakdownRow): string {
  return formatMoney(
    toNumber(item.consumedUsd) ?? toNumber(item.betAmount) ?? toNumber(item.turnover),
  );
}

/* —— Qtech update history (/change-percentage/qtech-topped-up-balance/update-history) —— */

export type UpdateHistorySummary = {
  startDate: string;
  endDate: string;
  topupCount: number | null;
  topupTotalAmount: number | null;
  currency: string;
};

export type UpdateHistoryRow = Record<string, unknown> & {
  _id?: string;
  amount?: number;
  currency?: string;
  toppedUpAtIst?: string;
  note?: string;
  updatedBy?: unknown;
};

const HISTORY_LIST_KEYS = [
  'history',
  'records',
  'updates',
  'list',
  'rows',
  'items',
  'data',
] as const;

/** IST calendar date as `YYYY-MM-DD` (optional month start). */
export function istDateYmd(startOfMonth = false, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '01';
  if (startOfMonth) return `${get('year')}-${get('month')}-01`;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function emptyUpdateHistorySummary(): UpdateHistorySummary {
  return {
    startDate: '',
    endDate: '',
    topupCount: null,
    topupTotalAmount: null,
    currency: '',
  };
}

export function extractUpdateHistoryList(payload: unknown): UpdateHistoryRow[] {
  if (Array.isArray(payload)) return payload as UpdateHistoryRow[];
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  for (const key of HISTORY_LIST_KEYS) {
    if (Array.isArray(obj[key])) return obj[key] as UpdateHistoryRow[];
  }
  if (obj.data && typeof obj.data === 'object') {
    return extractUpdateHistoryList(obj.data);
  }
  if (obj.payload && typeof obj.payload === 'object') {
    return extractUpdateHistoryList(obj.payload);
  }
  return [];
}

function readUpdateSummaryFromNode(node: unknown): UpdateHistorySummary | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const item = node as Record<string, unknown>;
  if (
    item.topupCount == null &&
    item.topupTotalAmount == null &&
    !item.startDate &&
    !item.endDate &&
    !item.currency
  ) {
    return null;
  }
  return {
    startDate: String(item.startDate || ''),
    endDate: String(item.endDate || ''),
    topupCount: toNumber(item.topupCount),
    topupTotalAmount: toNumber(item.topupTotalAmount),
    currency: String(item.currency || ''),
  };
}

export function parseUpdateHistorySummary(payload: unknown): UpdateHistorySummary {
  const nodes: unknown[] = [
    payload,
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>).payload : null,
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : null,
    payload && typeof payload === 'object'
      ? ((payload as Record<string, unknown>).data as Record<string, unknown> | undefined)?.payload
      : null,
    payload && typeof payload === 'object'
      ? ((payload as Record<string, unknown>).payload as Record<string, unknown> | undefined)?.data
      : null,
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>).result : null,
  ];

  const candidates: UpdateHistorySummary[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    const obj = node as Record<string, unknown>;
    const fromNested = readUpdateSummaryFromNode(obj.topupSummary);
    if (fromNested) candidates.push(fromNested);
    const fromSelf = readUpdateSummaryFromNode(obj);
    if (fromSelf) candidates.push(fromSelf);
  }

  const match =
    candidates.find((item) => item.topupCount != null || item.topupTotalAmount != null) ||
    candidates[0];
  return match || emptyUpdateHistorySummary();
}

export function parseUpdateHistoryResponse(decrypted: unknown): {
  rows: UpdateHistoryRow[];
  summary: UpdateHistorySummary;
} {
  const root = resolveRootPayload(decrypted) ?? decrypted;
  const fromRoot = parseUpdateHistorySummary(root);
  const fromBody = parseUpdateHistorySummary(decrypted);
  const summary =
    fromBody.topupCount != null || fromBody.topupTotalAmount != null ? fromBody : fromRoot;
  return {
    rows: extractUpdateHistoryList(root),
    summary,
  };
}

export function formatUpdateHistoryCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const name = obj.name || obj.realName || obj.chatName;
    if (name) return String(name);
    if (obj._id) return String(obj._id);
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

export function updateHistoryColumnKeys(rows: UpdateHistoryRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) {
      if (key !== '__v') keys.add(key);
    }
  }
  const preferred = [
    'amount',
    'currency',
    'toppedUpAtIst',
    'date',
    'time',
    'updatedBy',
    'note',
    'startDate',
    'endDate',
    'createdAt',
  ];
  const ordered = preferred.filter((key) => keys.has(key));
  for (const key of keys) {
    if (!ordered.includes(key) && key !== '_id') ordered.push(key);
  }
  return ordered;
}

export function labelizeHistoryKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
