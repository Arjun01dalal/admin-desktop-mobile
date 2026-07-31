import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  FULL_ALLOTMENT_ROLE_IDS,
  RESP_TOTAL_DEPOSIT,
  type CallerRow,
} from './constants';
import { formatAmount } from '@/utils/dates';

export type StoredCallerUser = {
  _id?: string;
  name?: string;
  Role_ID?: string;
  empCode?: string;
  Responsibilities?: string[];
};

export function roundAmt(value: unknown): number | string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return formatAmount(Math.round(n));
}

export function pnl(deposit: unknown, withdrawApproved: unknown): number | string {
  const d = Number(deposit);
  const w = Number(withdrawApproved);
  if (!Number.isFinite(d) || !Number.isFinite(w)) return '-';
  return formatAmount(Math.round(d - w));
}

export function displayName(value: unknown, empty = '-'): string {
  const s = String(value ?? '').trim();
  if (!s || s === 'not_assigned' || s === 'not assigned') return empty;
  return s;
}

/** Look up minutes for the page startDate inside inactiveTime/activeTime arrays. */
export function minutesForDate(data: unknown, startDate: string): string {
  if (!Array.isArray(data)) return '-';
  const entry = data.find((item) => item && typeof item === 'object' && startDate in item) as
    | Record<string, { minutes?: number }>
    | undefined;
  const minutes = entry?.[startDate]?.minutes;
  return minutes !== undefined ? `${Number(minutes).toFixed(2)} mins` : '-';
}

export function roleFlags(roleId?: string) {
  const id = String(roleId || '');
  const isCaller = CALLER_ROLE_IDS.has(id);
  const isCallerHead = CALLER_HEAD_ROLE_IDS.has(id);
  const isCallerOrHead = isCaller || isCallerHead;
  const isFullAllotment = FULL_ALLOTMENT_ROLE_IDS.has(id);
  return { isCaller, isCallerHead, isCallerOrHead, isFullAllotment };
}

/** Show Summary / By Office when permission present, or when no permissions are configured. */
export function canSeeTotalDeposit(user: StoredCallerUser | null): boolean {
  const list = user?.Responsibilities;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(RESP_TOTAL_DEPOSIT);
}

export function filterCallerRows(
  rows: CallerRow[],
  user: StoredCallerUser | null,
  isCaller: boolean,
  showCompany: boolean,
): CallerRow[] {
  return rows
    .filter((v) => (isCaller ? v.empCode === user?.empCode : !v.block))
    .filter((v) => (showCompany ? true : v.officeLocation !== 'Company'));
}

export function ecs(row: CallerRow): Record<string, unknown> {
  return (row.activePlayersECS || {}) as Record<string, unknown>;
}
