/** User-row field pickers — port of desktop screens/panel/newRegisters/utils.ts. */
import { formatDisplayDate, formatDisplayTime } from '../utils/dates';

export type UserRow = Record<string, unknown>;

type NestedCaller = { name?: unknown; Dp_ID?: unknown } | null | undefined;

export function nestedName(value: unknown): string {
  return String((value as NestedCaller)?.name || '-');
}

export function nestedDpId(value: unknown): string {
  return String((value as NestedCaller)?.Dp_ID || '-');
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function firstDefined(...values: unknown[]): unknown {
  for (const v of values) {
    if (!isEmptyValue(v)) return v;
  }
  return undefined;
}

/** Normalize API date (ISO string, timestamp, or Mongo `{ $date }`). */
function asDateInput(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.$date != null) return obj.$date;
    if (typeof obj.date === 'string' || typeof obj.date === 'number') return obj.date;
  }
  return raw;
}

export function pickLastActivity(row: UserRow): string {
  const raw = firstDefined(
    row.activeUser,
    row.lastActivity,
    row.lastActive,
    row.last_activity,
    row.lastLogin,
  );
  if (raw == null) return '-';
  const value = asDateInput(raw);
  const date = formatDisplayDate(value);
  const time = formatDisplayTime(value);
  if (!date && !time) return '-';
  return time ? `${date} | ${time}` : date;
}

export function pickUserBankName(row: UserRow): string {
  const bankDetails = (row.bankDetails || {}) as Record<string, unknown>;
  const raw = firstDefined(
    row.userBankName,
    row.bankName,
    row.user_bank_name,
    row.accountHolderName,
    row.bankHolderName,
    bankDetails.bankName,
    bankDetails.name,
  );
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function pickPlayIn(row: UserRow): string {
  const raw = firstDefined(row.played, row.playIn, row.play_in, row.PlayIn, row.playedGames);
  if (raw === true) return 'Yes';
  if (raw === false) return 'No';
  if (Array.isArray(raw)) {
    const joined = raw.map((v) => String(v).trim()).filter(Boolean).join(', ');
    return joined || '-';
  }
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function pickAccountNumber(row: UserRow): string {
  const bankDetails = (row.bankDetails || {}) as Record<string, unknown>;
  const raw = firstDefined(
    row.accountNumber,
    row.accountNo,
    row.accNo,
    row.account_number,
    bankDetails.accountNumber,
  );
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function pickAadharNumber(row: UserRow): string {
  const raw = firstDefined(row.aadhaarNumber, row.aadharNumber, row.aadhar, row.aadhaar);
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function pickAppName(row: UserRow): unknown {
  return firstDefined(row.clientName, row.appName, row.app_name);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function flattenUserRow(row: UserRow): UserRow {
  const root = asRecord(row);
  if (!root) return row;
  const nests = [root._doc, root.user, root.data, root.User]
    .map(asRecord)
    .filter((v): v is Record<string, unknown> => Boolean(v));
  if (!nests.length) return row;
  let merged: Record<string, unknown> = {};
  for (const nest of nests) merged = { ...merged, ...nest };
  return { ...merged, ...root };
}

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findByNormKeys(row: Record<string, unknown>, candidates: string[]): unknown {
  const wanted = new Set(candidates.map(normKey));
  for (const [key, value] of Object.entries(row)) {
    if (!wanted.has(normKey(key))) continue;
    if (!isEmptyValue(value)) return value;
  }
  return undefined;
}

/** Laxmi: `User?.userComesFrom ?? "Company"`. */
export function pickUserComesFrom(row: UserRow): string {
  const flat = flattenUserRow(row);
  const rec = asRecord(flat) || {};
  const raw = firstDefined(
    flat.userComesFrom,
    rec.user_comes_from,
    rec.comesFrom,
    rec.userComeFrom,
    rec.UserComesFrom,
    findByNormKeys(rec, [
      'userComesFrom',
      'user_comes_from',
      'comesFrom',
      'userComeFrom',
      'usercomesfrom',
    ]),
  );
  const text = raw == null ? '' : String(raw).trim();
  return text || 'Company';
}

export function pickBalance(row: UserRow): number | null {
  const flat = flattenUserRow(row);
  const rec = asRecord(flat) || {};
  const raw = firstDefined(
    flat.balance,
    rec.walletBalance,
    rec.availableBalance,
    rec.userBalance,
    rec.Balance,
    findByNormKeys(rec, [
      'balance',
      'walletBalance',
      'availableBalance',
      'userBalance',
    ]),
  );
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatAadharAddress(row: UserRow): string {
  const addr = (row.aadharAddress || row.aadhaarAddress || {}) as Record<string, unknown>;
  if (!row.kyc || !Object.keys(addr).length) return '-';
  return [
    addr.country && `Country: ${addr.country}`,
    addr.dist && `Dist: ${addr.dist}`,
    addr.house && `House: ${addr.house}`,
    addr.landmark && `Landmark: ${addr.landmark}`,
    addr.loc && `Loc: ${addr.loc}`,
    addr.pin && `Pin: ${addr.pin}`,
    addr.state && `State: ${addr.state}`,
    addr.vtc && `Vtc: ${addr.vtc}`,
  ]
    .filter(Boolean)
    .join(' | ');
}
