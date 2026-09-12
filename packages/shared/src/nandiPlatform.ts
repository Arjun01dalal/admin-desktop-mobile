/**
 * Nandi / Shatabhisha (Satta Matka) platform detail helpers.
 * Ported from Laxmi `NandiPlatform.tsx` — shared by desktop + mobile.
 */

export type NandiMarketKey =
  | 'regular'
  | 'starline'
  | 'kingbazar'
  | 'instantworli'
  | 'crazywheel';

export const NANDI_MARKET_TABS: { key: NandiMarketKey; label: string }[] = [
  { key: 'regular', label: 'Regular' },
  { key: 'starline', label: 'Starline' },
  { key: 'kingbazar', label: 'King Bazar' },
  { key: 'instantworli', label: 'Instant Worli' },
  { key: 'crazywheel', label: 'Crazy Wheel' },
];

export type NandiDetailFormat = 'money' | 'count' | 'rtp' | 'raw';

export type NandiDetailCard = {
  key: string;
  label: string;
  value: unknown;
  format: NandiDetailFormat;
};

export type NandiMetric = {
  label: string;
  value: string;
  tone?: 'neg' | 'pos' | '';
};

export type NandiSessionRow = Record<string, unknown> & { session: string };

export type NandiBazarCard = {
  bazarId: string;
  bazarName: string;
  openTime: string;
  closeTime: string;
  result: string;
  summary: NandiMetric[];
  sessions: NandiSessionRow[];
  raw: Record<string, unknown>;
};

export type NandiPlayersPage = {
  list: Record<string, unknown>[];
  totalPages: number;
  totalCount: number;
};

export type NandiPlayerView = {
  userId: string;
  userName: string;
  mobile: string;
  customerId: string;
  partnerCustomerId: string;
  count: string;
  betCount: string;
  bet: string;
  win: string;
  ggr: string;
  ggrTone: 'neg' | 'pos' | '';
  session: string;
};

const SKIP_DETAIL_KEYS = new Set([
  '_id',
  'id',
  'items',
  'list',
  'markets',
  'bazars',
  'bazar',
  'data',
  'payload',
  'success',
  'message',
  'status',
  'statusCode',
]);

const BAZAR_LIST_KEYS = [
  'bazar',
  'bazars',
  'Bazar',
  'Bazars',
  'bazarList',
  'bazarData',
  'bazar_list',
  'bazar_data',
  'bazarDetails',
  'bazar_details',
  'bazarWise',
  'bazar_wise',
] as const;

export function pick(obj: unknown, keys: string[], fallback: unknown = undefined): unknown {
  if (!obj || typeof obj !== 'object') return fallback;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return fallback;
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function formatNandiMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '0');
  return Math.floor(n).toLocaleString('en-IN');
}

export function formatNandiCount(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '0');
  return Math.round(n).toLocaleString('en-IN');
}

export function formatNandiMoneyPrecise(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '0');
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

export function formatNandiRtp(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '0');
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

export function formatNandiDetailValue(value: unknown, format: NandiDetailFormat = 'money'): string {
  if (format === 'count') return formatNandiCount(value);
  if (format === 'rtp') return formatNandiRtp(value);
  if (format === 'raw') return String(value ?? '-');
  return formatNandiMoneyPrecise(value);
}

export function nandiMetricTone(value: unknown): 'neg' | 'pos' | '' {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return n < 0 ? 'neg' : 'pos';
}

export function normalizeNandiSessionLabel(value: unknown, fallback = 'Open'): string {
  const raw = String(value ?? fallback).trim();
  if (/^close$/i.test(raw)) return 'Close';
  if (/^open$/i.test(raw)) return 'Open';
  return raw || fallback;
}

function formatResultValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      !trimmed ||
      trimmed === '-' ||
      trimmed === '***' ||
      trimmed === '*-*' ||
      trimmed === '*−*' ||
      /^not\s*declared$/i.test(trimmed) ||
      /^n\/?a$/i.test(trimmed)
    ) {
      return '';
    }
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map(formatResultValue).filter(Boolean).join('-');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const pana = pick(record, ['pana', 'panna', 'Pana', 'Panna', 'openPana', 'closePana', 'openPanna', 'closePanna']);
    const digit = pick(record, [
      'digit',
      'ank',
      'number',
      'openDigit',
      'closeDigit',
      'openAnk',
      'closeAnk',
    ]);
    const jodi = pick(record, ['jodi', 'Jodi']);
    const structured = [pana, digit, jodi].map(formatResultValue).filter(Boolean);
    if (structured.length) return structured.join('-');
    return Object.values(record).map(formatResultValue).filter(Boolean).join('-');
  }
  return String(value);
}

export function formatMatkaResult(resultObj: unknown): string {
  if (!resultObj || typeof resultObj !== 'object') return formatResultValue(resultObj);
  const result = resultObj as { open?: { patti?: unknown }; close?: { patti?: unknown }; jodi?: unknown };
  const openPatti = formatResultValue(result.open?.patti);
  const closePatti = formatResultValue(result.close?.patti);
  const jodi = formatResultValue(result.jodi);
  return [openPatti, jodi, closePatti].filter(Boolean).join('-');
}

/** Unwrap secureApi / axios-style envelopes into the useful payload object. */
export function unwrapNandiPayload(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === 'string') {
    try {
      return unwrapNandiPayload(JSON.parse(input));
    } catch {
      return input;
    }
  }
  if (typeof input !== 'object') return input;

  let raw: unknown = input;
  const envelope = input as Record<string, unknown>;

  if (envelope.data !== undefined || envelope.payload !== undefined) {
    raw = envelope.data ?? envelope.payload ?? envelope;
  }

  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const nested = raw as Record<string, unknown>;
    if (nested.payload !== undefined) {
      if (nested.payload && typeof nested.payload === 'object' && !Array.isArray(nested.payload)) {
        raw = { ...nested, ...(nested.payload as object) };
      } else {
        raw = nested.payload;
      }
    }
  }

  // Preserve sibling bazar arrays beside nested payload
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const out = { ...(raw as Record<string, unknown>) };
    for (const key of BAZAR_LIST_KEYS) {
      if (out[key] === undefined && envelope[key] !== undefined) out[key] = envelope[key];
      const dataObj = envelope.data;
      if (
        out[key] === undefined &&
        dataObj &&
        typeof dataObj === 'object' &&
        !Array.isArray(dataObj) &&
        (dataObj as Record<string, unknown>)[key] !== undefined
      ) {
        out[key] = (dataObj as Record<string, unknown>)[key];
      }
    }
    return out;
  }

  return raw;
}

function flattenDetails(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const nested =
    record.summary ||
    record.details ||
    record.platformDetails ||
    record.nandiPlatformDetails ||
    record.stats ||
    record.overview;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...record, ...(nested as Record<string, unknown>) };
  }
  return record;
}

export function buildNandiDetailCards(details: unknown): NandiDetailCard[] {
  if (!details) return [];
  if (Array.isArray(details)) {
    return details.map((item, idx) => {
      const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        key: String(row.label || row.key || idx),
        label: String(row.label || row.key || `Metric ${idx + 1}`),
        value: row.value ?? row.amount ?? row.count ?? 0,
        format: 'money' as const,
      };
    });
  }

  const flat = flattenDetails(details);
  const preferred: [string, string, NandiDetailFormat][] = [
    ['totalBetCount', 'Total Bet Count', 'count'],
    ['totalBetAmount', 'Total Bet Amount', 'money'],
    ['totalPendingCount', 'Total Pending Count', 'count'],
    ['totalPendingAmount', 'Total Pending Amount', 'money'],
    ['totalWinCount', 'Total Win Count', 'count'],
    ['totalWinAmount', 'Total Win Amount', 'money'],
    ['totalRollbackAmount', 'Total Rollback Amount', 'money'],
    ['totalCommission', 'Total Commission', 'money'],
    ['playerCount', 'Player Count', 'count'],
    ['activeCustomers', 'Active Customers', 'count'],
    ['ggr', 'GGR', 'money'],
    ['profit', 'Profit', 'money'],
    ['rtp', 'RTP', 'rtp'],
  ];

  const cards: NandiDetailCard[] = [];
  const used = new Set<string>();

  for (const [key, label, format] of preferred) {
    if (flat[key] !== undefined && flat[key] !== null && !used.has(key)) {
      cards.push({ key, label, value: flat[key], format });
      used.add(key);
    }
  }

  for (const [key, value] of Object.entries(flat)) {
    if (used.has(key) || SKIP_DETAIL_KEYS.has(key)) continue;
    if (value !== null && typeof value === 'object') continue;
    cards.push({
      key,
      label: humanize(key),
      value,
      format: /count|players|customers/i.test(key) ? 'count' : /rtp/i.test(key) ? 'rtp' : 'money',
    });
    used.add(key);
  }

  return cards;
}

export function buildNandiSessionMetrics(row: Record<string, unknown>): NandiMetric[] {
  return [
    { label: 'Bet', value: formatNandiMoney(pick(row, ['betAmount', 'totalBetAmount'], 0)) },
    { label: 'Win', value: formatNandiMoney(pick(row, ['winAmount', 'totalWinAmount'], 0)) },
    {
      label: 'GGR',
      value: formatNandiMoney(pick(row, ['ggr'], 0)),
      tone: nandiMetricTone(pick(row, ['ggr'], 0)),
    },
    { label: 'Bets', value: formatNandiCount(pick(row, ['totalBetCount', 'betCount'], 0)) },
    { label: 'Wins', value: formatNandiCount(pick(row, ['totalWinCount', 'winCount'], 0)) },
    { label: 'Players', value: formatNandiCount(pick(row, ['playerCount'], 0)) },
    {
      label: 'Pending',
      value: formatNandiMoney(pick(row, ['totalPendingAmount', 'pendingAmount'], 0)),
    },
    { label: 'Comm', value: formatNandiMoney(pick(row, ['totalCommission'], 0)) },
    { label: 'RTP', value: formatNandiRtp(pick(row, ['rtp'], 0)) },
    {
      label: 'Pend #',
      value: formatNandiCount(pick(row, ['totalPendingCount', 'pendingCount'], 0)),
    },
    { label: 'Rollback', value: formatNandiMoney(pick(row, ['totalRollbackAmount'], 0)) },
    {
      label: 'Profit',
      value: formatNandiMoney(pick(row, ['profit'], 0)),
      tone: nandiMetricTone(pick(row, ['profit'], 0)),
    },
  ];
}

export function normalizeNandiSessions(bazar: Record<string, unknown>): NandiSessionRow[] {
  const rows = Array.isArray(bazar.sessions)
    ? bazar.sessions
    : Array.isArray(bazar.sessionWise)
      ? bazar.sessionWise
      : Array.isArray(bazar.sessionData)
        ? bazar.sessionData
        : Array.isArray(bazar.session)
          ? bazar.session
          : null;

  if (rows) {
    return rows.map((row, index) => {
      const record = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
      const sessionName = normalizeNandiSessionLabel(
        pick(record, ['sessionKey', 'session', 'sessionName', 'label', 'type'], index === 0 ? 'Open' : 'Close'),
        index === 0 ? 'Open' : 'Close',
      );
      return { ...record, session: sessionName };
    });
  }

  const sessions: NandiSessionRow[] = [];
  const open = bazar.open || bazar.Open || bazar.openSession;
  const close = bazar.close || bazar.Close || bazar.closeSession;
  if (open && typeof open === 'object' && !Array.isArray(open)) {
    sessions.push({ ...(open as Record<string, unknown>), session: 'Open' });
  }
  if (close && typeof close === 'object' && !Array.isArray(close)) {
    sessions.push({ ...(close as Record<string, unknown>), session: 'Close' });
  }
  return sessions;
}

function toBazarRows(value: unknown): Record<string, unknown>[] {
  if (!value) return [];

  if (typeof value === 'string') {
    try {
      return toBazarRows(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((item, index) => {
        if (item == null) return null;
        if (typeof item === 'string' || typeof item === 'number') {
          return { bazarName: String(item), bazarId: String(item) };
        }
        if (typeof item !== 'object') return null;

        const record = item as Record<string, unknown>;
        const nested =
          record.bazar && typeof record.bazar === 'object' && !Array.isArray(record.bazar)
            ? (record.bazar as Record<string, unknown>)
            : record.bazarInfo && typeof record.bazarInfo === 'object' && !Array.isArray(record.bazarInfo)
              ? (record.bazarInfo as Record<string, unknown>)
              : null;

        const bazarName = String(
          pick(record, [
            'bazarName',
            'bazar_name',
            'name',
            'marketName',
            'market_name',
            'title',
            'gameName',
            'game_name',
            'label',
          ]) ??
            (typeof record.bazar === 'string' || typeof record.bazar === 'number'
              ? record.bazar
              : undefined) ??
            pick(nested, ['bazarName', 'bazar_name', 'name', 'title'], undefined) ??
            `Bazar ${index + 1}`,
        );

        const bazarId = String(
          pick(record, ['bazarId', 'bazar_id', 'bazarID', '_id', 'id', 'marketId', 'market_id']) ??
            pick(nested, ['bazarId', 'bazar_id', '_id', 'id'], undefined) ??
            `bazar-${index}`,
        );

        return { ...record, ...(nested || {}), bazarName, bazarId };
      })
      .filter(Boolean) as Record<string, unknown>[];
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (BAZAR_LIST_KEYS.some((key) => record[key] !== undefined)) return [];

    if (
      ('totalBetAmount' in record ||
        'totalWinAmount' in record ||
        'market' in record ||
        'marketName' in record) &&
      !('bazarName' in record) &&
      !('bazar_name' in record) &&
      !('bazarId' in record) &&
      !('bazar_id' in record)
    ) {
      return [];
    }

    if (
      record.bazarName ||
      record.bazar_name ||
      record.bazarId ||
      record.bazar_id ||
      record.open ||
      record.close ||
      record.Open ||
      record.Close ||
      record.openSession ||
      record.closeSession
    ) {
      return toBazarRows([record]);
    }

    const keys = Object.keys(record);
    const isNameMap =
      keys.length > 0 &&
      keys.every((key) => {
        const row = record[key];
        return row && typeof row === 'object' && !Array.isArray(row);
      }) &&
      !('bazarName' in record) &&
      !('bazar_name' in record) &&
      !('bazarId' in record) &&
      !('bazar_id' in record) &&
      !('totalBetAmount' in record) &&
      !('betAmount' in record) &&
      !('ggr' in record);

    if (isNameMap) {
      return keys.map((name, index) => {
        const row = (record[name] || {}) as Record<string, unknown>;
        return {
          ...row,
          bazarName: name,
          bazarId: String(pick(row, ['bazarId', 'bazar_id', '_id', 'id'], name || `bazar-${index}`)),
        };
      });
    }
  }

  return [];
}

export function extractNandiBazarList(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];

  if (typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    for (const key of BAZAR_LIST_KEYS) {
      if (record[key] !== undefined) {
        const rows = toBazarRows(record[key]);
        if (rows.length) return rows;
      }
    }

    for (const parent of [
      record.data,
      record.result,
      record.payload,
      record.response,
      record.marketData,
      record.marketDetails,
    ]) {
      if (!parent || typeof parent !== 'object') continue;
      if (Array.isArray(parent)) {
        const rows = toBazarRows(parent);
        if (rows.length > 1) return rows;
        continue;
      }
      const parentRec = parent as Record<string, unknown>;
      for (const key of BAZAR_LIST_KEYS) {
        if (parentRec[key] !== undefined) {
          const rows = toBazarRows(parentRec[key]);
          if (rows.length) return rows;
        }
      }
    }
  }

  if (Array.isArray(payload)) {
    const direct = toBazarRows(payload);
    if (direct.length) return direct;
  }

  const candidates: Record<string, unknown>[][] = [];
  const scan = (obj: unknown, depth: number) => {
    if (!obj || typeof obj !== 'object' || depth > 4) return;
    if (Array.isArray(obj)) {
      const rows = toBazarRows(obj);
      if (rows.length > 1) candidates.push(rows);
      for (const item of obj) scan(item, depth + 1);
      return;
    }
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (/bazar/i.test(key)) {
        const rows = toBazarRows(val);
        if (rows.length) candidates.push(rows);
      }
      if (val && typeof val === 'object') scan(val, depth + 1);
    }
  };
  scan(payload, 0);
  if (candidates.length) {
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0];
  }
  return [];
}

export function normalizeNandiBazarCards(payload: unknown): NandiBazarCard[] {
  return extractNandiBazarList(unwrapNandiPayload(payload)).map((bazar, index) => {
    const bazarId = String(
      pick(bazar, ['bazarId', 'bazar_id', 'bazarID', '_id', 'id', 'marketId', 'market_id'], `bazar-${index}`),
    );
    const nestedBazar =
      bazar.bazar && typeof bazar.bazar === 'object' && !Array.isArray(bazar.bazar)
        ? (bazar.bazar as Record<string, unknown>)
        : null;
    const bazarName = String(
      pick(bazar, ['bazarName', 'bazar_name', 'name', 'marketName', 'market_name', 'title', 'gameName', 'label']) ??
        (typeof bazar.bazar === 'string' ? bazar.bazar : undefined) ??
        pick(nestedBazar, ['bazarName', 'bazar_name', 'name', 'title'], `Bazar ${index + 1}`),
    );
    const ggr = pick(bazar, ['ggr', 'GGR'], 0);
    const profit = pick(bazar, ['profit'], 0);

    return {
      bazarId,
      bazarName,
      openTime: String(pick(bazar, ['openTime', 'open_time'], '') || ''),
      closeTime: String(pick(bazar, ['closeTime', 'close_time'], '') || ''),
      result: formatMatkaResult(bazar.result),
      summary: [
        { label: 'Bet', value: formatNandiMoney(pick(bazar, ['totalBetAmount'], 0)) },
        { label: 'Win', value: formatNandiMoney(pick(bazar, ['totalWinAmount'], 0)) },
        { label: 'Players', value: formatNandiCount(pick(bazar, ['playerCount'], 0)) },
        { label: 'RTP', value: formatNandiRtp(pick(bazar, ['rtp'], 0)) },
        { label: 'GGR', value: formatNandiMoney(ggr), tone: nandiMetricTone(ggr) },
        { label: 'Profit', value: formatNandiMoney(profit), tone: nandiMetricTone(profit) },
      ],
      sessions: normalizeNandiSessions(bazar),
      raw: bazar,
    };
  });
}

export function extractNandiPlayersList(payload: unknown): NandiPlayersPage {
  const raw = unwrapNandiPayload(payload);
  if (!raw) return { list: [], totalPages: 1, totalCount: 0 };
  if (Array.isArray(raw)) {
    return { list: raw as Record<string, unknown>[], totalPages: 1, totalCount: raw.length };
  }

  const record = raw as Record<string, unknown>;
  const nested = record.data || record.payload || record.result || record.response;
  if (
    nested &&
    typeof nested === 'object' &&
    !Array.isArray(nested) &&
    ((nested as Record<string, unknown>).items ||
      (nested as Record<string, unknown>).players ||
      (nested as Record<string, unknown>).list ||
      Array.isArray((nested as Record<string, unknown>).data))
  ) {
    const nestedResult = extractNandiPlayersList(nested);
    const parentTotal = Number(
      pick(
        record,
        [
          'totalCount',
          'total_count',
          'total',
          'count',
          'totalRecords',
          'total_records',
          'totalItems',
          'totalPlayers',
          'playerCount',
        ],
        nestedResult.totalCount,
      ),
    );
    return {
      ...nestedResult,
      totalCount: Number.isFinite(parentTotal) ? parentTotal : nestedResult.totalCount,
    };
  }

  const list =
    record.items ||
    record.players ||
    record.list ||
    (Array.isArray(record.data) ? record.data : null) ||
    record.rows ||
    [];
  const rows = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
  const totalCount = Number(
    pick(
      record,
      [
        'totalCount',
        'total_count',
        'total',
        'count',
        'totalRecords',
        'total_records',
        'totalItems',
        'totalPlayers',
        'playerCount',
      ],
      rows.length,
    ),
  );
  const pages =
    record.totalPages ||
    record.pages ||
    (totalCount && (record.itemsPerPage || record.limit)
      ? Math.ceil(Number(totalCount) / Number(record.itemsPerPage || record.limit))
      : 1);

  return {
    list: rows,
    totalPages: Math.max(1, Number(pages) || 1),
    totalCount: Number.isFinite(totalCount) ? totalCount : rows.length,
  };
}

export function isRealNandiBazarId(bazarId?: string): boolean {
  if (!bazarId) return false;
  if (/^bazar-\d+$/i.test(bazarId)) return false;
  if (bazarId === 'undefined' || bazarId === 'null') return false;
  return true;
}

export function mapNandiPlayerRow(
  player: Record<string, unknown>,
  selectedSession: string,
): NandiPlayerView {
  const ggrValue = pick(player, ['ggr', 'GGR', 'totalGgr', 'profit']);
  const ggrNum = Number(ggrValue);
  return {
    userId: String(pick(player, ['userId', 'dp_id', '_id', 'id'], '') || ''),
    userName: String(
      pick(player, ['userName', 'name', 'userBankName', 'accountHolderName'], '-') || '-',
    ),
    mobile: String(pick(player, ['mobile', 'phone', 'userMobile'], '-') || '-'),
    customerId: String(pick(player, ['customerId', 'customer_id', 'userId', 'dp_id'], '-') || '-'),
    partnerCustomerId: String(
      pick(player, ['partnerCustomerId', 'partner_customer_id', 'partnerId'], '-') || '-',
    ),
    count: String(
      pick(player, ['count', 'totalCount', 'total_count', 'ticketCount', 'noOfBets', 'numberOfBets'], '-') ||
        '-',
    ),
    betCount: String(
      pick(player, ['betCount', 'bet_count', 'totalBets', 'totalBetCount', 'betsCount'], '-') || '-',
    ),
    bet: formatNandiMoney(pick(player, ['betAmount', 'amount', 'totalBetAmount', 'point'])),
    win: formatNandiMoney(pick(player, ['winAmount', 'winningAmount', 'totalWinAmount'])),
    ggr: formatNandiMoney(ggrValue),
    ggrTone: Number.isFinite(ggrNum) ? (ggrNum < 0 ? 'neg' : ggrNum > 0 ? 'pos' : '') : '',
    session: normalizeNandiSessionLabel(
      pick(player, ['session', 'sessionName'], selectedSession),
      selectedSession,
    ),
  };
}

export type NandiPlayerSortKey =
  | 'user'
  | 'mobile'
  | 'customerId'
  | 'partnerCustomerId'
  | 'count'
  | 'betCount'
  | 'bet'
  | 'win'
  | 'ggr'
  | 'session';

export function getNandiPlayerSortValue(
  player: Record<string, unknown>,
  key: NandiPlayerSortKey,
  selectedSession: string,
): string | number {
  switch (key) {
    case 'user':
      return String(
        pick(player, ['userName', 'name', 'userBankName', 'accountHolderName'], ''),
      ).toLowerCase();
    case 'mobile':
      return String(pick(player, ['mobile', 'phone', 'userMobile'], ''));
    case 'customerId':
      return String(pick(player, ['customerId', 'customer_id', 'userId', 'dp_id'], ''));
    case 'partnerCustomerId':
      return String(pick(player, ['partnerCustomerId', 'partner_customer_id', 'partnerId'], ''));
    case 'count':
      return Number(
        pick(player, ['count', 'totalCount', 'total_count', 'ticketCount', 'noOfBets', 'numberOfBets'], 0),
      );
    case 'betCount':
      return Number(pick(player, ['betCount', 'bet_count', 'totalBets', 'totalBetCount', 'betsCount'], 0));
    case 'bet':
      return Number(pick(player, ['betAmount', 'amount', 'totalBetAmount', 'point'], 0));
    case 'win':
      return Number(pick(player, ['winAmount', 'winningAmount', 'totalWinAmount'], 0));
    case 'ggr':
      return Number(pick(player, ['ggr', 'GGR', 'totalGgr', 'profit'], 0));
    case 'session':
      return String(pick(player, ['session', 'sessionName'], selectedSession)).toLowerCase();
    default:
      return '';
  }
}

export function sortNandiPlayers(
  players: Record<string, unknown>[],
  sortKey: NandiPlayerSortKey,
  sortDir: 'asc' | 'desc',
  selectedSession: string,
): Record<string, unknown>[] {
  const rows = [...players];
  const dir = sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = getNandiPlayerSortValue(a, sortKey, selectedSession);
    const bv = getNandiPlayerSortValue(b, sortKey, selectedSession);
    if (typeof av === 'number' && typeof bv === 'number') {
      return ((Number.isFinite(av) ? av : 0) - (Number.isFinite(bv) ? bv : 0)) * dir;
    }
    return (
      String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
    );
  });
  return rows;
}
