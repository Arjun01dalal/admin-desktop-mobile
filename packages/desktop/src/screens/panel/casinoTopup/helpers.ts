export type ProviderKey = 'qtech' | 'betconstruct';

export type TopupRecord = {
  _id?: string;
  amount?: number;
  currency?: string;
  toppedUpAtIst?: string;
  toppedUpAt?: string;
  recordedAt?: string;
  note?: string;
  createdAt?: string;
  balance?: number;
  toppedUpBalance?: number;
  [key: string]: unknown;
};

export type ProviderState = {
  records: TopupRecord[];
  balance: number | null;
  currency: string;
  loading: boolean;
};

export type FormState = {
  amount: string;
  currency: string;
  toppedUpAtIst: string;
  note: string;
};

export const PROVIDER_CONFIG: Record<
  ProviderKey,
  { title: string; defaultNote: string }
> = {
  qtech: {
    title: 'Qtech',
    defaultNote: 'Qtech wallet top-up',
  },
  betconstruct: {
    title: 'Betconstruct',
    defaultNote: 'Betconstruct wallet top-up',
  },
};

export const CURRENCY_OPTIONS = ['USD', 'INR', 'EUR'] as const;

/** Current IST as datetime-local value: "YYYY-MM-DDTHH:mm:ss" */
export function getCurrentIstDatetimeLocal(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || '00';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

export function emptyForm(note: string): FormState {
  return {
    amount: '',
    currency: 'USD',
    toppedUpAtIst: getCurrentIstDatetimeLocal(),
    note,
  };
}

export function toApiDateTime(datetimeLocal: string): string {
  if (!datetimeLocal) return '';
  const normalized = datetimeLocal.trim().replace('T', ' ').replace('Z', '');
  const match = normalized.match(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return normalized;
  const [, date, hours, minutes, seconds = '00'] = match;
  return `${date} ${hours}:${minutes}:${seconds}`;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyProvider(): Omit<ProviderState, 'loading'> {
  return { records: [], balance: null, currency: 'USD' };
}

function recordTimestamp(item: TopupRecord): number {
  const raw =
    item.toppedUpAt ||
    item.recordedAt ||
    item.createdAt ||
    item.toppedUpAtIst ||
    '';
  const normalized = String(raw).replace(' IST', '').replace(' ', 'T');
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : 0;
}

function sortRecordsDesc(records: TopupRecord[]): TopupRecord[] {
  return [...records].sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
}

/** API doc shape: { type: "qtech topped up balance", data: { amount, currency, history } } */
export function parseTopupDocument(
  doc: unknown,
): Omit<ProviderState, 'loading'> {
  if (!doc || typeof doc !== 'object') return emptyProvider();
  const root = doc as Record<string, unknown>;
  const wallet =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const records = Array.isArray(wallet.history)
    ? (wallet.history as TopupRecord[])
    : Array.isArray(wallet.records)
      ? (wallet.records as TopupRecord[])
      : Array.isArray(root.history)
        ? (root.history as TopupRecord[])
        : [];

  return {
    records: sortRecordsDesc(records),
    balance:
      toNumber(wallet.amount) ??
      toNumber(wallet.balance) ??
      toNumber(wallet.toppedUpBalance) ??
      null,
    currency: String(wallet.currency || records[0]?.currency || 'USD'),
  };
}

function providerFromType(type: unknown): ProviderKey | null {
  const value = String(type || '').toLowerCase();
  if (value.includes('qtech')) return 'qtech';
  if (value.includes('betconstruct') || value.includes('bet construct')) {
    return 'betconstruct';
  }
  return null;
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
  return (
    obj.payload ??
    nestedData?.payload ??
    obj.data ??
    obj.result ??
    decrypted
  );
}

export function parseBothProviders(
  decrypted: unknown,
): Record<ProviderKey, Omit<ProviderState, 'loading'>> {
  const payload = resolveRootPayload(decrypted);
  const result: Record<ProviderKey, Omit<ProviderState, 'loading'>> = {
    qtech: emptyProvider(),
    betconstruct: emptyProvider(),
  };

  const applyDoc = (doc: unknown) => {
    if (!doc || typeof doc !== 'object') return false;
    const obj = doc as Record<string, unknown>;
    const key =
      providerFromType(obj.type) ||
      providerFromType(obj.provider) ||
      providerFromType(obj.providerName);
    if (!key) return false;
    result[key] = parseTopupDocument(doc);
    return true;
  };

  if (Array.isArray(payload)) {
    payload.forEach(applyDoc);
    return result;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;

    if (obj.data && (obj.type || (obj.data as Record<string, unknown>)?.amount != null)) {
      const matched = applyDoc(payload);
      if (matched) return result;
      result.qtech = parseTopupDocument(payload);
      return result;
    }

    if (obj.qtech != null) result.qtech = parseTopupDocument(obj.qtech);
    if (obj.Qtech != null) result.qtech = parseTopupDocument(obj.Qtech);
    if (obj.betconstruct != null) {
      result.betconstruct = parseTopupDocument(obj.betconstruct);
    }
    if (obj.betConstruct != null) {
      result.betconstruct = parseTopupDocument(obj.betConstruct);
    }
    if (obj.Betconstruct != null) {
      result.betconstruct = parseTopupDocument(obj.Betconstruct);
    }

    if (
      result.qtech.balance != null ||
      result.qtech.records.length ||
      result.betconstruct.balance != null ||
      result.betconstruct.records.length
    ) {
      return result;
    }

    if (obj.amount != null || Array.isArray(obj.history)) {
      result.qtech = parseTopupDocument(payload);
      return result;
    }
  }

  return result;
}

export function displayToppedUpAt(item: TopupRecord): string {
  return String(item.toppedUpAtIst || item.createdAt || item.toppedUpAt || '—');
}

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

  return {
    remainingUsd:
      toNumber(payload.remainingUsd) ?? toNumber(payload.remainingBalance),
    toppedUpUsd:
      toNumber(payload.toppedUpUsd) ?? toNumber(payload.toppedUpBalance),
    consumedUsd:
      toNumber(payload.consumedUsd) ?? toNumber(payload.consumedBalance),
    currency: String(payload.currency || 'USD'),
    usdToInr: toNumber(payload.usdToInr) ?? toNumber(payload.usdInr),
    feeInr: toNumber(payload.feeInr) ?? toNumber(payload.fee),
    ggrUsd: toNumber(payload.ggrUsd) ?? toNumber(payload.ggr),
    ggrInr: toNumber(payload.ggrInr),
    rangeStart: String(range.start || ''),
    rangeEnd: String(range.end || ''),
    toppedUpAt: String(payload.toppedUpAt || ''),
    toppedUpAtIst: String(payload.toppedUpAtIst || ''),
    byGame: Array.isArray(payload.byGame)
      ? (payload.byGame as RemainingBreakdownRow[])
      : [],
    byProvider: Array.isArray(payload.byProvider)
      ? (payload.byProvider as RemainingBreakdownRow[])
      : [],
    unmatchedGamesCount: toNumber(payload.unmatchedGamesCount),
  };
}

export function remainingRowLabel(
  item: RemainingBreakdownRow,
  mode: 'provider' | 'game',
): string {
  if (mode === 'provider') {
    return String(
      item.provider || item.providerName || item.name || '—',
    );
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
  return formatMoney(
    toNumber(item.ggrInr) ?? toNumber(item.amountInr) ?? toNumber(item.inr),
  );
}

export function remainingRowConsumed(item: RemainingBreakdownRow): string {
  return formatMoney(
    toNumber(item.consumedUsd) ??
      toNumber(item.betAmount) ??
      toNumber(item.turnover),
  );
}
