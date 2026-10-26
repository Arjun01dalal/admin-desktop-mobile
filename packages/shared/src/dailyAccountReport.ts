/**
 * Daily Account Report — shared types, normalizers, validators, labels.
 * Desktop + mobile both consume this; no DOM / Electron / fetch here.
 * Ported from admin-panel-domains DailyAccountReport (dailyAccountApi /
 * midAllotmentApi / midDailyBalanceApi) onto the ganesha secureApi contract.
 */
import { asList } from './api/parse';

export type UpdatedBy = {
  userId: string;
  userName: string;
};

export type BankAccount = {
  _id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: string;
  displayName: string;
  status: string;
};

export type MidRecord = {
  _id: string;
  mid: string;
  displayName: string;
  phoneNumber: string;
  upiId: string;
  bankAccountId: string;
  bankLabel: string;
  source: string;
  sourceAccountId: string;
  status: string;
};

export type MidAllotment = {
  _id: string;
  midId: string;
  mid: string;
  subAdminId: string;
  subAdminName: string;
  empCode: string;
  active: boolean;
  assignedAt: string;
  remark: string;
  previousAllotmentId: string;
  deactivatedAt: string;
  deactivateReason: string;
  replacedBy: string;
  assignedByName: string;
  updatedByName: string;
};

export type BalanceType = 'open' | 'close';

export type BalanceImage = {
  key: string;
  url: string;
};

export type DailyBalanceRow = {
  _id: string;
  midAllotmentId: string;
  midId: string;
  mid: string;
  subAdminId: string;
  subAdminName: string;
  date: string;
  type: BalanceType | string;
  amount: number;
  image: BalanceImage | null;
  remark: string;
  updatedByName: string;
  createdOn: string;
  updatedOn: string;
};

export type DaySheetItem = {
  midId: string;
  mid: string;
  subAdminId: string;
  subAdminName: string;
  date: string;
  open: DailyBalanceRow | null;
  close: DailyBalanceRow | null;
};

/** Renamed from `SubAdminOption` to avoid colliding with `midLimits.ts`'s export of the same name. */
export type DarSubAdminOption = {
  id: string;
  label: string;
  name: string;
  empCode: string;
};

export type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export const PAGE_SIZE = 20;
export const ACCOUNT_TYPES = ['savings', 'current'] as const;
export const MID_SOURCES = ['manual', 'payoutAccount', 'payinAccount'] as const;

export const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  payoutAccount: 'Payout account',
  payinAccount: 'Payin account',
};

const text = (value: unknown): string => String(value ?? '').trim();

/** Secure API already unwraps `{payload: ...}` / decrypted envelopes — this handles any remaining nesting. */
function unwrapListPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  let cur = data as Record<string, unknown>;
  for (let i = 0; i < 3; i += 1) {
    if (Array.isArray(cur)) return { items: cur };
    if (
      Array.isArray(cur.items) ||
      Array.isArray(cur.docs) ||
      Array.isArray(cur.list) ||
      Array.isArray(cur.data)
    ) {
      return cur;
    }
    if (cur.payload && typeof cur.payload === 'object') {
      cur = cur.payload as Record<string, unknown>;
      continue;
    }
    break;
  }
  return cur;
}

function pickItems(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.docs)) return payload.docs;
  if (Array.isArray(payload.list)) return payload.list;
  if (Array.isArray(payload.data)) return payload.data as unknown[];
  return asList(payload);
}

function toList<T extends { _id: string }>(
  data: unknown,
  mapRow: (row: unknown) => T,
  page: number,
  limit: number,
): ListResult<T> {
  const payload = unwrapListPayload(data);
  const items = pickItems(payload).map(mapRow).filter((item) => item._id);
  return {
    items,
    total: Number(payload.total ?? payload.totalCount ?? items.length) || 0,
    page: Number(payload.page) || page,
    limit: Number(payload.limit) || limit,
  };
}

/** Drop empty optional string fields before create (keeps payloads lean). */
export function omitEmpty<T extends Record<string, unknown>>(body: T): Partial<T> {
  const next: Partial<T> = {};
  (Object.entries(body) as Array<[keyof T, unknown]>).forEach(([key, value]) => {
    if (value === '' || value === undefined || value === null) return;
    next[key] = value as T[keyof T];
  });
  return next;
}

function bankIdOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  const obj = value as Record<string, unknown>;
  return text(obj._id || obj.id);
}

function bankLabelOf(value: unknown): string {
  if (!value || typeof value === 'string') return '';
  const obj = value as Record<string, unknown>;
  const name = text(obj.displayName || obj.bankName);
  const number = text(obj.accountNumber);
  return [name, number].filter(Boolean).join(' · ');
}

export function bankOptionLabel(account: BankAccount): string {
  const name = account.displayName || account.bankName || 'Bank';
  const number = account.accountNumber ? ` · ${account.accountNumber}` : '';
  const status = account.status && account.status !== 'active' ? ` (${account.status})` : '';
  return `${name}${number}${status}`;
}

export function sourceLabel(value: string): string {
  return SOURCE_LABELS[value] || value || 'Manual';
}

export function normalizeBankAccount(row: unknown): BankAccount {
  const obj = (row || {}) as Record<string, unknown>;
  return {
    _id: text(obj._id || obj.id),
    bankName: text(obj.bankName ?? obj.bank_name ?? obj.bank),
    accountHolderName: text(obj.accountHolderName ?? obj.account_holder_name ?? obj.holderName),
    accountNumber: text(obj.accountNumber ?? obj.account_number),
    ifscCode: text(obj.ifscCode ?? obj.ifsc_code ?? obj.ifsc),
    accountType: text(obj.accountType ?? obj.account_type),
    displayName: text(obj.displayName ?? obj.display_name),
    status: text(obj.status) || 'active',
  };
}

export function normalizeMid(row: unknown): MidRecord {
  const obj = (row || {}) as Record<string, unknown>;
  return {
    _id: text(obj._id || obj.id),
    mid: text(obj.mid),
    displayName: text(obj.displayName),
    phoneNumber: text(obj.phoneNumber),
    upiId: text(obj.upiId),
    bankAccountId: bankIdOf(obj.bankAccountId ?? obj.bankAccount),
    bankLabel: bankLabelOf(obj.bankAccount ?? obj.bankAccountId),
    source: text(obj.source) || 'manual',
    sourceAccountId: text(obj.sourceAccountId),
    status: text(obj.status) || 'active',
  };
}

export function normalizeAllotment(row: unknown): MidAllotment {
  const obj = (row || {}) as Record<string, unknown>;
  const midIdRaw = obj.midId as Record<string, unknown> | string | undefined;
  const midRaw = obj.mid as Record<string, unknown> | string | undefined;
  const subAdminIdRaw = obj.subAdminId as Record<string, unknown> | string | undefined;
  return {
    _id: text(obj._id || obj.id),
    midId: text(
      (typeof midIdRaw === 'object' ? midIdRaw?._id : midIdRaw) ??
        (typeof midRaw === 'object' ? midRaw?._id : undefined),
    ),
    mid: text(
      (typeof midRaw === 'object' ? midRaw?.mid || midRaw?.displayName : midRaw) ?? obj.midName,
    ),
    subAdminId: text(typeof subAdminIdRaw === 'object' ? subAdminIdRaw?._id : subAdminIdRaw),
    subAdminName: text(
      obj.subAdminName ??
        (typeof subAdminIdRaw === 'object' ? subAdminIdRaw?.name : undefined) ??
        (obj.subAdmin as Record<string, unknown> | undefined)?.name ??
        '',
    ),
    empCode: text(obj.empCode ?? (typeof subAdminIdRaw === 'object' ? subAdminIdRaw?.empCode : undefined)),
    active: obj.active !== false,
    assignedAt: text(obj.assignedAt ?? obj.createdOn),
    remark: text(obj.remark),
    previousAllotmentId: text(obj.previousAllotmentId),
    deactivatedAt: text(obj.deactivatedAt),
    deactivateReason: text(obj.deactivateReason),
    replacedBy: text(obj.replacedBy),
    assignedByName: text(
      (obj.assignedBy as Record<string, unknown> | undefined)?.userName ||
        (obj.assignedBy as Record<string, unknown> | undefined)?.name,
    ),
    updatedByName: text(
      (obj.updatedBy as Record<string, unknown> | undefined)?.userName ||
        (obj.updatedBy as Record<string, unknown> | undefined)?.name,
    ),
  };
}

function normalizeImage(value: unknown): BalanceImage | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const url = value.trim();
    return url ? { key: '', url } : null;
  }
  const obj = value as Record<string, unknown>;
  const url = text(obj.url || obj.location || obj.path);
  const key = text(obj.key || obj.Key);
  if (!url && !key) return null;
  return { key, url };
}

export function normalizeDailyBalance(row: unknown): DailyBalanceRow {
  const obj = (row || {}) as Record<string, unknown>;
  const midIdRaw = obj.midId as Record<string, unknown> | string | undefined;
  const midRaw = obj.mid as Record<string, unknown> | string | undefined;
  const subAdminIdRaw = obj.subAdminId as Record<string, unknown> | string | undefined;
  return {
    _id: text(obj._id || obj.id),
    midAllotmentId: text(obj.midAllotmentId),
    midId: text(typeof midIdRaw === 'object' ? midIdRaw?._id : midIdRaw),
    mid: text((typeof midRaw === 'object' ? midRaw?.mid : midRaw) ?? obj.midName),
    subAdminId: text(typeof subAdminIdRaw === 'object' ? subAdminIdRaw?._id : subAdminIdRaw),
    subAdminName: text(
      obj.subAdminName ??
        (typeof subAdminIdRaw === 'object' ? subAdminIdRaw?.name : undefined) ??
        (obj.subAdmin as Record<string, unknown> | undefined)?.name,
    ),
    date: text(obj.date).slice(0, 10),
    type: text(obj.type).toLowerCase() || 'open',
    amount: Number(obj.amount) || 0,
    image: normalizeImage(obj.image),
    remark: text(obj.remark),
    updatedByName: text(
      (obj.updatedBy as Record<string, unknown> | undefined)?.userName ||
        (obj.updatedBy as Record<string, unknown> | undefined)?.name,
    ),
    createdOn: text(obj.createdOn),
    updatedOn: text(obj.updatedOn),
  };
}

export function normalizeDaySheetItem(row: unknown): DaySheetItem {
  const obj = (row || {}) as Record<string, unknown>;
  const openRaw = obj.open ?? obj.opening ?? null;
  const closeRaw = obj.close ?? obj.closing ?? null;
  const open = openRaw ? normalizeDailyBalance(openRaw) : null;
  const close = closeRaw ? normalizeDailyBalance(closeRaw) : null;
  const midRaw = obj.mid as Record<string, unknown> | string | undefined;
  return {
    midId: text(obj.midId ?? open?.midId ?? close?.midId ?? (midRaw as Record<string, unknown> | undefined)?._id),
    mid: text((typeof midRaw === 'object' ? midRaw?.mid : midRaw) ?? open?.mid ?? close?.mid),
    subAdminId: text(obj.subAdminId ?? open?.subAdminId ?? close?.subAdminId),
    subAdminName: text(obj.subAdminName ?? open?.subAdminName ?? close?.subAdminName),
    date: text(obj.date ?? open?.date ?? close?.date).slice(0, 10),
    open,
    close,
  };
}

export function normalizeSubAdminOption(row: unknown): DarSubAdminOption | null {
  const obj = (row || {}) as Record<string, unknown>;
  const id = text(obj._id || obj.id);
  if (!id) return null;
  const name = text(obj.name || obj.userName);
  const empCode = text(obj.empCode || obj.employeeCode || obj.emp_code);
  const label = [name || id, empCode ? `Emp ${empCode}` : '', id.slice(-6)]
    .filter(Boolean)
    .join(' · ');
  return { id, label, name: name || id, empCode };
}

/** `users.getSubAdmins` response → dropdown options (filters blocked users). */
export function parseSubAdminOptions(data: unknown): DarSubAdminOption[] {
  const payload = unwrapListPayload(data);
  const rows = pickItems(payload);
  return rows
    .filter((row) => {
      const obj = (row || {}) as Record<string, unknown>;
      return obj.block !== true && obj.Block !== true;
    })
    .map(normalizeSubAdminOption)
    .filter((option): option is DarSubAdminOption => option !== null);
}

export function listBankAccounts(data: unknown, page: number, limit: number): ListResult<BankAccount> {
  return toList(data, normalizeBankAccount, page, limit);
}

export function listMids(data: unknown, page: number, limit: number): ListResult<MidRecord> {
  return toList(data, normalizeMid, page, limit);
}

export function listAllotments(data: unknown, page: number, limit: number): ListResult<MidAllotment> {
  return toList(data, normalizeAllotment, page, limit);
}

export function listDailyBalances(
  data: unknown,
  page: number,
  limit: number,
): ListResult<DailyBalanceRow> {
  return toList(data, normalizeDailyBalance, page, limit);
}

export function listDaySheet(data: unknown): { items: DaySheetItem[]; total: number } {
  const payload = unwrapListPayload(data);
  const items = pickItems(payload)
    .map(normalizeDaySheetItem)
    .filter((item) => item.midId || item.mid);
  return { items, total: Number(payload.total ?? items.length) || 0 };
}

/**
 * Merge active allotments with day-sheet rows in O(n).
 * Every held phone appears even when the sheet has no open/close yet;
 * orphan sheet rows (no longer allotted) are kept at the end.
 */
export function mergeDaySheetWithAllotments(input: {
  allotments: MidAllotment[];
  sheetItems: DaySheetItem[];
  date: string;
  fallbackSubAdminId?: string;
  fallbackSubAdminName?: string;
}): DaySheetItem[] {
  const byMid = new Map<string, DaySheetItem>();
  for (const item of input.sheetItems) {
    if (item.midId) byMid.set(item.midId, item);
  }

  const seen = new Set<string>();
  const merged: DaySheetItem[] = [];

  for (const phone of input.allotments) {
    if (!phone.midId || seen.has(phone.midId)) continue;
    seen.add(phone.midId);
    const existing = byMid.get(phone.midId);
    if (existing) {
      merged.push(existing);
      continue;
    }
    merged.push({
      midId: phone.midId,
      mid: phone.mid || phone.midId,
      subAdminId: phone.subAdminId || input.fallbackSubAdminId || '',
      subAdminName: phone.subAdminName || input.fallbackSubAdminName || '',
      date: input.date,
      open: null,
      close: null,
    });
  }

  for (const item of input.sheetItems) {
    if (!item.midId || seen.has(item.midId)) continue;
    seen.add(item.midId);
    merged.push(item);
  }

  return merged;
}

export type DayBalanceStatus = 'done' | 'open' | 'pending';

export function dayBalanceStatus(item: DaySheetItem): DayBalanceStatus {
  if (item.open && item.close) return 'done';
  if (item.open) return 'open';
  return 'pending';
}

export const isAbortError = (error: unknown): boolean => {
  const err = error as { code?: string; name?: string; message?: string } | null | undefined;
  return Boolean(
    err &&
      (err.code === 'ERR_CANCELED' ||
        err.name === 'CanceledError' ||
        err.name === 'AbortError' ||
        err.message === 'canceled'),
  );
};

export function isValidAccountNumber(value: string): boolean {
  return /^\d{9,18}$/.test(value);
}

export function isValidIfsc(value: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
}

export function isValidBalanceAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Today in Asia/Kolkata as YYYY-MM-DD.
 * Named `darTodayIstDate` (not `todayIstDate`) to avoid colliding with `ggrAlert.ts`'s export.
 */
export function darTodayIstDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export function formatBalanceAmount(value?: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('en-IN');
}

export function formatAllotmentTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const MAX_BALANCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_BALANCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function validateBalanceImageFile(file: { type: string; size: number } | null): string {
  if (!file) return '';
  if (!(ALLOWED_BALANCE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Image must be jpeg, png, or webp';
  }
  if (file.size > MAX_BALANCE_IMAGE_BYTES) {
    return 'Image must be 10MB or less';
  }
  return '';
}

/** Generic `{ok:false, message}` extractor for secureApi results (mirrors apiFailed callers). */
export function darErrorMessage(message: string | undefined, fallback: string): string {
  return message || fallback;
}
