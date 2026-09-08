/**
 * Types, per-type API/filter maps and pure helpers for the Users screen
 * (desktop UsersPage parity).
 */
import { CALLER_HIDDEN_USER_TYPES, type UserType } from '@astro/shared/userTypes';
import type { SearchFieldOption } from '../dashboards/details/DetailFilterBar';

export const PAGE_SIZE = 25;

/** Desktop parity: reason tag sent with add-to-bot per user type. */
export function reasonForUserType(type: UserType): string {
  switch (type) {
    case 'Non_Performing_User':
      return 'non_performing';
    case 'Todays_Active':
      return 'today_active_user';
    case 'Active_User':
      return 'active_user';
    case 'In_Active_Deposit':
      return 'inactive';
    default:
      return 'Daily User';
  }
}

/** Callers: hide Todays_Active / Active_User / LAXMI_999 (desktop parity). */
export const CALLER_HIDDEN: UserType[] = [...CALLER_HIDDEN_USER_TYPES];

export const TYPE_ACTION: Record<UserType, string> = {
  User: 'users.getAll',
  Sub_Admin: 'users.getSubAdmins',
  Todays_Active: 'ops.activeCustomers',
  Active_User: 'users.getActiveUsers',
  Non_Performing_User: 'ops.nonPerformingUser',
  In_Active_Deposit: 'users.inactiveDeposit',
  Non_Performing_Active_User: 'users.nonPerformingActive',
  LAXMI_999_Users: 'users.laxmi999',
};

export type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  played?: string;
  kyc?: unknown;
  empCode?: string;
  email?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  balance?: number;
  totalDeposit?: number;
  totalWithdrawal?: number;
  createdOn?: string;
  blockUser?: boolean;
  block?: boolean;
  blockUserReason?: string;
  Role_Name?: string;
  telegramUsername?: string;
  activeDays?: number;
  [key: string]: unknown;
};

/* -------------------------- block OTP target rules ------------------------- */
/** Desktop users/constants: OTP goes to SuperAdmin unless self-allowlisted. */
const BLOCK_OTP_DEFAULT_MOBILE = '9373114572';
const BLOCK_OTP_SELF_MOBILES = new Set(['9608010101', '9561139951']);

export function resolveBlockOtpMobile(loginMobile?: string): string {
  const mobile = String(loginMobile || '').trim();
  if (BLOCK_OTP_SELF_MOBILES.has(mobile)) return mobile;
  return BLOCK_OTP_DEFAULT_MOBILE;
}

/* --------------------------------- helpers -------------------------------- */

export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

export function isBlocked(r: Row): boolean {
  return Boolean(r.blockUser ?? r.block);
}

export function empCodesEqual(a: unknown, b: unknown): boolean {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  if (!x || !y) return false;
  if (x === y) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    return x.padStart(3, '0') === y.padStart(3, '0');
  }
  return false;
}

const DEFAULT_EMP_CODE = '001';

export function isDefaultEmpCode(code: unknown): boolean {
  const c = String(code ?? '').trim();
  return c === '' || empCodesEqual(c, DEFAULT_EMP_CODE);
}

/** Caller list scope: own emp only, or own + 001 when searching another field. */
export function filterCallerEmpScope(
  rows: Row[],
  loginEmpCode: string,
  allowOwnAndDefault: boolean,
): Row[] {
  const mine = String(loginEmpCode || '').trim();
  if (!mine) return rows;
  if (allowOwnAndDefault) {
    return rows.filter((row) => empCodesEqual(row.empCode, mine) || isDefaultEmpCode(row.empCode));
  }
  return rows.filter((row) => empCodesEqual(row.empCode, mine));
}

/** Per-type filter allowlists (desktop buildUserFilter parity — APIs reject unknown keys). */
export function searchFieldsFor(
  type: UserType,
  hideContact: boolean,
  isCaller: boolean,
): readonly SearchFieldOption[] {
  if (type === 'Sub_Admin') {
    return [
      { key: 'name', label: 'Name' },
      { key: 'mobile', label: 'Mobile' },
    ];
  }
  if (type === 'LAXMI_999_Users') {
    return [
      { key: 'dp_id', label: 'Dp Id' },
      { key: 'userId', label: 'User Id' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
    ];
  }
  if (type === 'Non_Performing_Active_User') {
    return isCaller ? [] : [{ key: 'empCode', label: 'Emp Code' }];
  }
  if (type === 'Active_User' || type === 'Todays_Active') {
    const fields: SearchFieldOption[] = [{ key: 'name', label: 'Name' }];
    if (type === 'Active_User') {
      fields.push({ key: '_id', label: 'Dp Id' });
    }
    if (!hideContact) {
      fields.push(
        { key: 'mobile', label: 'Mobile' },
        { key: 'accountNumber', label: 'Account' },
        { key: 'aadhaarNumber', label: 'Aadhar' },
        { key: 'email', label: 'Email' },
      );
    }
    fields.push(
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'deviceType', label: 'Device' },
    );
    if (!isCaller) fields.push({ key: 'empCode', label: 'Emp Code' });
    fields.push({ key: 'played', label: 'In (E/C/S)' });
    return fields;
  }
  const fields: SearchFieldOption[] = [
    { key: 'name', label: 'Name' },
    { key: '_id', label: 'Dp Id' },
  ];
  if (!hideContact) {
    fields.push(
      { key: 'mobile', label: 'Mobile' },
      { key: 'accountNumber', label: 'Account' },
      { key: 'aadhaarNumber', label: 'Aadhar' },
      { key: 'email', label: 'Email' },
    );
  }
  fields.push(
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'deviceType', label: 'Device' },
  );
  if (type === 'User' || type === 'Non_Performing_User') {
    if (!isCaller) fields.push({ key: 'empCode', label: 'Emp Code' });
    fields.push({ key: 'played', label: 'In (E/C/S)' });
  }
  return fields;
}
