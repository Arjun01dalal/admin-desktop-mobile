/**
 * Pure helpers for the Withdrawal screen: response unpacking, summary parsing,
 * desktop action-gating rules, and display formatting.
 *
 * Kept free of component state so each rule can be reasoned about (and tested)
 * on its own — `WithdrawalScreen.tsx` only wires them to UI.
 */
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import { colors } from '../../theme';
import { formatDisplayDate, formatDisplayTime } from '../../utils/dates';
import { TERMINAL_STATUSES } from './constants';

export type Rec = Record<string, unknown>;

export function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function fmtAmount(v: unknown): string {
  return Math.floor(num(v)).toLocaleString('en-IN');
}

/** Desktop UPIQR parity: build the UPI payment query string. */
export function buildUpiQuery(r: Rec): string {
  const params = new URLSearchParams();
  params.set('pa', String(r.upiId ?? ''));
  if (r.amount !== undefined && r.amount !== null) params.set('am', String(r.amount));
  params.set('cu', 'INR');
  params.set(
    'tn',
    `Note:${String(r.accountHolderName ?? '').slice(0, 6)}-${String(r.dp_id ?? '').slice(-6)}`,
  );
  params.set('tr', `ORD-${Date.now()}`);
  return params.toString();
}

/* ----------------------------- response shapes ---------------------------- */

export function unpack(data: unknown): Rec {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Rec;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Rec;
  }
  return obj;
}

export function listOf(data: unknown): Rec[] {
  const obj = unpack(data);
  for (const k of ['items', 'transactions', 'list', 'docs']) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return Array.isArray(data) ? (data as Rec[]) : [];
}

export function pagesOf(data: unknown): number {
  const obj = unpack(data);
  const total = num(obj.totalPages ?? obj.total_pages);
  if (total > 0) return total;
  const count = num(obj.total ?? obj.totalCount ?? obj.count);
  const per = num(obj.itemsPerPage ?? obj.perPage) || 10;
  return count > 0 ? Math.max(1, Math.ceil(count / per)) : 1;
}

/** admin-panel-domains Withdrawal: payload.total → "Total User". */
export function totalUsersOf(data: unknown): number {
  return num(unpack(data).total ?? unpack(data).totalCount);
}

export type Summary = { label: string; count: number; amount: number }[];

/** Desktop asWithdrawalSummary parity: flat keys with nested-bucket fallback. */
export function parseSummary(data: unknown): Summary {
  const payload = unpack(data);
  const src =
    payload.WithdrawalData && typeof payload.WithdrawalData === 'object'
      ? (payload.WithdrawalData as Rec)
      : payload;
  const bucket = (obj: unknown) => {
    const b = (obj && typeof obj === 'object' ? obj : {}) as Rec;
    return { count: num(b.count), amount: num(b.totalAmount) };
  };
  const approved = bucket(src.totalApprovedWithdrawalData);
  const pending = bucket(src.totalPendingWithdrawalData);
  const rejected = bucket(src.totalWithdrawalRejected);
  const reverse = bucket(src.totalReverseWithdrawalData);
  const onhold = bucket(src.totalOnholdWithdrawalData);
  return [
    {
      label: 'Approved',
      count: num(src.totalApprovedCount ?? approved.count),
      amount: num(src.totalApprovedAmount ?? approved.amount),
    },
    {
      label: 'Pending',
      count: num(src.totalPendingCount ?? pending.count),
      amount: num(src.totalPendingAmount ?? pending.amount),
    },
    {
      label: 'Rejected',
      count: num(src.totalRejectedCount ?? rejected.count),
      amount: num(src.totalRejectedAmount ?? rejected.amount),
    },
    {
      label: 'Reverse',
      count: num(src.totalReversedCount ?? reverse.count),
      amount: num(src.totalReversedAmount ?? reverse.amount),
    },
    {
      label: 'On Hold',
      count: num(src.totalOnholdCount ?? onhold.count),
      amount: num(src.totalOnholdAmount ?? onhold.amount),
    },
    {
      label: 'Cancelled',
      count: num(src.totalCanceledCount),
      amount: num(src.totalCanceledAmount),
    },
  ];
}

/* ------------------------- desktop gating helpers ------------------------- */

export type CheckMark = { status?: string | boolean; name?: string; date?: string };

export function checkOf(r: Rec, key: 'checkBy' | 'crossCheckBy'): CheckMark | null {
  const v = r[key];
  return v && typeof v === 'object' ? (v as CheckMark) : null;
}

export function bothChecksOk(r: Rec): boolean {
  return Boolean(checkOf(r, 'checkBy')?.status && checkOf(r, 'crossCheckBy')?.status);
}

/** Desktop extractBeneficiaryAccounts parity. */
export function extractBeneficiaryAccounts(r: Rec): string[] {
  const accounts = r.beneficiaryAccounts;
  if (Array.isArray(accounts)) return accounts.map(String).filter(Boolean);
  if (typeof accounts === 'string' && accounts.trim()) return [accounts.trim()];
  return [];
}

/** Desktop: check column hidden only for Cancel/Rejected/Reverse/Failed. */
export function checksAllowedFor(r: Rec, checksDisabled: boolean): boolean {
  return (
    !checksDisabled && !['Cancel', 'Rejected', 'Reverse', 'Failed'].includes(String(r.status || ''))
  );
}

export function isTerminal(r: Rec): boolean {
  return TERMINAL_STATUSES.has(String(r.status || ''));
}

export function canLockRow(r: Rec): boolean {
  if (isTerminal(r)) return false;
  if (r.status === 'IN PROGRESS') return false;
  return bothChecksOk(r);
}

export function canUnlockRow(r: Rec): boolean {
  return r.status === 'IN PROGRESS' || r.status === 'Lock';
}

export function canShowApproveAction(r: Rec): boolean {
  if (isTerminal(r)) return false;
  if (r.status === 'IN PROGRESS') return true;
  if ((r.status === 'Lock' || r.status === 'Pending') && bothChecksOk(r)) return true;
  return (
    bothChecksOk(r) || ['on hold', 'Processing', 'IN PROGRESS'].includes(String(r.status || ''))
  );
}

export function canRejectRow(r: Rec): boolean {
  if (r.status === 'Approved' || r.status === 'Rejected' || r.status === 'Reverse') return false;
  if (r.status === 'on hold') return true;
  return (
    bothChecksOk(r) ||
    Boolean(checkOf(r, 'checkBy')?.status) ||
    Boolean(checkOf(r, 'crossCheckBy')?.status)
  );
}

/* ------------------------------ geo + alerts ------------------------------ */

export type Geo = { city: string; state: string; lat: string; long: string };

/**
 * Never call Alert.alert while a Modal is open/animating — RN freezes all
 * touches (the "cards stop responding" bug). Always close sheets first and
 * show alerts after a short delay.
 */
export function notify(title: string, message?: string): void {
  setTimeout(() => Alert.alert(title, message), 450);
}

/** Desktop requireWithdrawalGeo parity: lat/long + city/state or abort (no alert here). */
export async function requireGeo(): Promise<Geo | null> {
  try {
    if (Platform.OS === 'web') throw new Error('unsupported');
    const pos =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const { latitude, longitude } = pos.coords;
    let city = '';
    let state = '';
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = places[0];
      city = p?.city || p?.subregion || p?.district || '';
      state = p?.region || '';
    } catch {
      /* fall through */
    }
    if (!city || !state) return null;
    return { city, state, lat: String(latitude), long: String(longitude) };
  } catch {
    return null;
  }
}

/* -------------------------------- display -------------------------------- */

export function statusColor(s: unknown): string | undefined {
  const v = String(s || '').toLowerCase();
  if (v === 'approved' || v === 'manual approved') return colors.success;
  if (v === 'rejected' || v === 'failed' || v === 'cancel') return colors.destructive;
  if (v === 'pending' || v === 'in progress' || v === 'processing') return '#f5b942';
  return undefined;
}

export function statusBadgeBg(status: unknown): string {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'manual approved' || s === 'success') return '#16a34a';
  if (s === 'pending' || s === 'in progress' || s === 'processing' || s === 'on hold') {
    return '#d97706';
  }
  if (s === 'lock') return '#2563eb';
  if (s === 'rejected' || s === 'failed' || s === 'cancel' || s === 'reverse') return '#dc2626';
  return '#64748b';
}

export function isRecord(value: unknown): value is Rec {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function formatPrimitive(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

export function formatValidationCheckedAt(value: unknown): string {
  if (!value) return '';
  return `${formatDisplayDate(String(value))} ${formatDisplayTime(String(value))}`.trim();
}
