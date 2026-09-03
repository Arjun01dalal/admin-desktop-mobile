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

export const PROVIDER_CONFIG: Record<ProviderKey, { title: string; defaultNote: string }> = {
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

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';

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
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
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
  const raw = item.toppedUpAt || item.recordedAt || item.createdAt || item.toppedUpAtIst || '';
  const normalized = String(raw).replace(' IST', '').replace(' ', 'T');
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : 0;
}

function sortRecordsDesc(records: TopupRecord[]): TopupRecord[] {
  return [...records].sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
}

/** API doc shape: { type: "qtech topped up balance", data: { amount, currency, history } } */
export function parseTopupDocument(doc: unknown): Omit<ProviderState, 'loading'> {
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
  return obj.payload ?? nestedData?.payload ?? obj.data ?? obj.result ?? decrypted;
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

// Remaining balance parsers / form helpers — shared with mobile.
export {
  type RemainingBreakdownRow,
  type QtechRemainingSummary,
  type RemainingFormState,
  type RemainingFormErrors,
  type RemainingSubmitPayload,
  emptyRemainingSummary,
  emptyRemainingForm,
  emptyRemainingFormErrors,
  buildRemainingSubmitPayload,
  formatMoney,
  parseQtechRemaining,
  mergeRemainingAfterSubmit,
  remainingRowLabel,
  remainingRowCode,
  remainingRowGgrUsd,
  remainingRowGgrInr,
  remainingRowConsumed,
  formatRemainingDateIst,
  formatRemainingTimeIst,
} from '@astro/shared/casinoTopup';
