import type { SecureAction } from '@/api/secureActions';
import { asList, asPaged, display } from '@/screens/panel/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { DEFAULT_EMP_CODE, type UserType } from './constants';

export type UserRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  userBankName?: string;
  empCode?: string;
  played?: string | string[];
  encryptedUserName?: string;
  kyc?: boolean;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  balance?: number | string;
  totalDeposit?: number | string;
  bonusBalance?: number | string;
  createdOn?: string;
  activeUser?: string;
  blockUser?: boolean;
  block?: boolean;
  blockUserReason?: string;
  dump?: boolean;
  Role_Name?: string;
  deviceType?: string;
  currentAppVersion?: string;
  previousCaller?: { name?: string; Dp_ID?: string };
  currentCaller?: { name?: string; Dp_ID?: string };
  [key: string]: unknown;
};

export type UserFilters = {
  name: string;
  dpId: string;
  mobile: string;
  accountNumber: string;
  aadhaarNumber: string;
  email: string;
  city: string;
  state: string;
  /** Multi-select states (In_Active_Deposit / LAXMI_999), sent as filter.state array. */
  states: string[];
  deviceType: string;
  empCode: string;
  blockStatus: string;
  /** LAXMI_999: API filter.userId */
  userId: string;
  activeUserStart: string;
  activeUserEnd: string;
  lastWalletStart: string;
  lastWalletEnd: string;
};

export const EMPTY_USER_FILTERS: UserFilters = {
  name: '',
  dpId: '',
  mobile: '',
  accountNumber: '',
  aadhaarNumber: '',
  email: '',
  city: '',
  state: '',
  states: [],
  deviceType: '',
  empCode: '',
  blockStatus: '',
  userId: '',
  activeUserStart: '',
  activeUserEnd: '',
  lastWalletStart: '',
  lastWalletEnd: '',
};

export function trimCode(value: unknown): string {
  return String(value ?? '').trim();
}

/** Soft equality so "21" and "021" match without forcing API padding. */
export function empCodesEqual(a: unknown, b: unknown): boolean {
  const x = trimCode(a);
  const y = trimCode(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
    return x.padStart(3, '0') === y.padStart(3, '0');
  }
  return false;
}

export function isDefaultEmpCode(code: unknown): boolean {
  const c = trimCode(code);
  return c === '' || c === DEFAULT_EMP_CODE;
}

/** Default list: only login empCode (laxminarayan filterListByLoginEmpCode). */
export function filterListByLoginEmpCode(
  rows: UserRow[],
  loginEmpCode?: string,
): UserRow[] {
  const mine = trimCode(loginEmpCode);
  if (!mine) return rows;
  return rows.filter((row) => {
    const code = trimCode(row.empCode);
    return code !== '' && empCodesEqual(code, mine);
  });
}

export type EmpSearchResolved =
  | {
      ok: true;
      apiEmpCode?: string;
      allowOwnAndDefault?: boolean;
      matchDefault?: boolean;
    }
  | { ok: false; message: string };

/**
 * EmpCode search rules (laxminarayan resolveSearchEmpCode):
 * - No login emp → optional free search
 * - Typed own → API empCode
 * - Typed 001 → client-match empty/001 (do not send API)
 * - Typed other → reject
 * - Empty + other search fields → own + 001
 * - Empty + no other search → own only
 */
export function resolveSearchEmpCode(
  uiEmpCode: string,
  loginEmpCode: string | undefined,
  hasOtherSearchValue: boolean,
): EmpSearchResolved {
  const trimmed = trimCode(uiEmpCode);
  const mine = trimCode(loginEmpCode);

  if (!mine) {
    return trimmed ? { ok: true, apiEmpCode: trimmed } : { ok: true };
  }
  if (trimmed && empCodesEqual(trimmed, mine)) {
    return { ok: true, apiEmpCode: mine };
  }
  if (trimmed === DEFAULT_EMP_CODE) {
    return { ok: true, matchDefault: true };
  }
  if (trimmed) {
    return {
      ok: false,
      message: 'You can only search your empCode or 001',
    };
  }
  if (hasOtherSearchValue) {
    return { ok: true, allowOwnAndDefault: true };
  }
  return { ok: true, apiEmpCode: mine };
}

export function filterSearchByEmpCode(
  rows: UserRow[],
  loginEmpCode: string | undefined,
  resolved: Extract<EmpSearchResolved, { ok: true }>,
): UserRow[] {
  const mine = trimCode(loginEmpCode);
  if (resolved.allowOwnAndDefault && mine) {
    return rows.filter(
      (row) => empCodesEqual(row.empCode, mine) || isDefaultEmpCode(row.empCode),
    );
  }
  if (resolved.matchDefault) {
    return rows.filter((row) => isDefaultEmpCode(row.empCode));
  }
  if (resolved.apiEmpCode) {
    return rows.filter((row) => empCodesEqual(row.empCode, resolved.apiEmpCode));
  }
  return rows;
}

export function hasOtherUserSearch(
  filters: UserFilters,
  clientName: string,
  playedIn: string,
): boolean {
  return Boolean(
    filters.name.trim() ||
      filters.dpId.trim() ||
      filters.mobile.trim() ||
      filters.accountNumber.trim() ||
      filters.aadhaarNumber.trim() ||
      filters.email.trim() ||
      filters.city.trim() ||
      filters.state.trim() ||
      filters.states.length > 0 ||
      filters.deviceType.trim() ||
      filters.blockStatus ||
      clientName ||
      playedIn,
  );
}

export function actionForType(type: UserType): SecureAction {
  switch (type) {
    case 'Sub_Admin':
      return 'users.getSubAdmins';
    case 'Todays_Active':
      return 'ops.activeCustomers';
    case 'Active_User':
      return 'users.getActiveUsers';
    case 'Non_Performing_User':
      return 'ops.nonPerformingUser';
    case 'In_Active_Deposit':
      return 'users.inactiveDeposit';
    case 'Non_Performing_Active_User':
      return 'users.nonPerformingActive';
    case 'LAXMI_999_Users':
      return 'users.laxmi999';
    default:
      return 'users.getAll';
  }
}

export function buildUserFilter(
  type: UserType,
  filters: UserFilters,
  clientName: string,
  playedIn: string,
  uniqueUser: boolean,
  empResolved?: Extract<EmpSearchResolved, { ok: true }>,
): Record<string, unknown> {
  // SubAdmin get-all-subadmins: name/mobile only — uniqueUser not allowed
  if (type === 'Sub_Admin') {
    const filter: Record<string, unknown> = {};
    if (filters.name.trim()) filter.name = filters.name.trim();
    if (filters.mobile.trim()) filter.mobile = filters.mobile.trim();
    return filter;
  }

  // LAXMI_999: city/state/dp_id/userId/mobile + date ranges (no uniqueUser — API rejects it)
  if (type === 'LAXMI_999_Users') {
    const filter: Record<string, unknown> = {};
    if (filters.city.trim()) filter.city = filters.city.trim();
    if (filters.states.length > 0) filter.state = filters.states;
    if (filters.dpId.trim()) filter.dp_id = filters.dpId.trim();
    if (filters.userId.trim()) filter.userId = filters.userId.trim();
    if (filters.mobile.trim()) filter.mobile = filters.mobile.trim();
    if (filters.activeUserStart.trim()) {
      filter.startDateActiveUser = filters.activeUserStart.trim();
    }
    if (filters.activeUserEnd.trim()) {
      filter.endDateActiveUser = filters.activeUserEnd.trim();
    }
    if (filters.lastWalletStart.trim()) {
      filter.startDateLastWalletDate = filters.lastWalletStart.trim();
    }
    if (filters.lastWalletEnd.trim()) {
      filter.endDateLastWalletDate = filters.lastWalletEnd.trim();
    }
    return filter;
  }

  // Non_Performing_Active: uniqueUser + optional empCode only
  if (type === 'Non_Performing_Active_User') {
    const filter: Record<string, unknown> = { uniqueUser };
    if (empResolved?.apiEmpCode) filter.empCode = empResolved.apiEmpCode;
    return filter;
  }

  // Active_User / Todays_Active: limited filter keys (laxminarayan getActiveUser)
  if (type === 'Active_User' || type === 'Todays_Active') {
    const filter: Record<string, unknown> = { uniqueUser };
    if (filters.name.trim()) filter.name = filters.name.trim();
    if (filters.mobile.trim()) filter.mobile = filters.mobile.trim();
    if (filters.city.trim()) filter.city = filters.city.trim();
    if (filters.states.length > 0) filter.state = filters.states;
    else if (filters.state.trim()) filter.state = filters.state.trim();
    if (clientName) filter.clientName = clientName;
    if (playedIn) filter.played = playedIn;
    return filter;
  }

  // In_Active_Deposit: no played / blockUser / empCode (API rejects unknown keys)
  if (type === 'In_Active_Deposit') {
    const filter: Record<string, unknown> = { uniqueUser };
    if (filters.name.trim()) filter.name = filters.name.trim();
    if (filters.dpId.trim()) filter._id = filters.dpId.trim();
    if (filters.mobile.trim()) filter.mobile = filters.mobile.trim();
    if (filters.accountNumber.trim()) {
      filter.accountNumber = filters.accountNumber.trim();
    }
    if (filters.aadhaarNumber.trim()) {
      filter.aadhaarNumber = filters.aadhaarNumber.trim();
    }
    if (filters.email.trim()) filter.email = filters.email.trim();
    if (filters.city.trim()) filter.city = filters.city.trim();
    if (filters.states.length > 0) filter.state = filters.states;
    if (filters.deviceType.trim()) {
      filter.deviceType = filters.deviceType.trim();
    }
    if (clientName) filter.clientName = clientName;
    return filter;
  }

  // User / Non_Performing
  const filter: Record<string, unknown> = { uniqueUser };
  if (filters.name.trim()) filter.name = filters.name.trim();
  if (filters.dpId.trim()) filter._id = filters.dpId.trim();
  if (filters.mobile.trim()) filter.mobile = filters.mobile.trim();
  if (filters.accountNumber.trim()) {
    filter.accountNumber = filters.accountNumber.trim();
  }
  if (filters.aadhaarNumber.trim()) {
    filter.aadhaarNumber = filters.aadhaarNumber.trim();
  }
  if (filters.email.trim()) filter.email = filters.email.trim();
  if (filters.city.trim()) filter.city = filters.city.trim();
  if (filters.states.length > 0) filter.state = filters.states;
  else if (filters.state.trim()) filter.state = filters.state.trim();
  if (clientName) filter.clientName = clientName;
  if (playedIn) filter.played = playedIn;
  if (filters.blockStatus === 'block') filter.blockUser = true;
  if (filters.blockStatus === 'unblock') filter.blockUser = false;
  if (empResolved?.apiEmpCode) filter.empCode = empResolved.apiEmpCode;
  return filter;
}

/** Build request body per user type (aligned with laxminarayan). */
export function buildPayloadForType(
  type: UserType,
  opts: {
    pageNo: number;
    itemsPerPage: number;
    filter: Record<string, unknown>;
    startDate: string;
    endDate: string;
    allottedApps?: string | string[];
  },
): Record<string, unknown> {
  const { pageNo, itemsPerPage, filter, startDate, endDate, allottedApps } =
    opts;
  const dates =
    startDate && endDate ? { startDate, endDate } : ({} as Record<string, string>);
  const app = allottedApps ? { app: allottedApps } : {};

  switch (type) {
    case 'Sub_Admin': {
      // get-all-subadmins: itemPerPage only (itemsPerPage is rejected)
      const payload: Record<string, unknown> = {
        pageNo,
        itemPerPage: itemsPerPage,
      };
      if (Object.keys(filter).length > 0) payload.filter = filter;
      return payload;
    }
    case 'Active_User':
      return {
        pageNo,
        itemsPerPage,
        filter,
        ...(startDate && endDate
          ? {
              activeUserStartDate: startDate,
              activeUserEndDate: endDate,
            }
          : {}),
        ...app,
      };
    case 'Todays_Active':
      return {
        pageNo,
        itemsPerPage,
        filter,
        ...dates,
        ...app,
      };
    case 'Non_Performing_User':
      return {
        pageNo,
        itemPerPage: itemsPerPage,
        itemsPerPage,
        filter,
        ...dates,
        ...app,
      };
    case 'In_Active_Deposit':
      return {
        pageNo,
        itemsPerPage,
        filter,
        ...dates,
        ...app,
      };
    case 'Non_Performing_Active_User':
      return { filter };
    case 'LAXMI_999_Users':
      return {
        pageNo,
        itemsPerPage,
        filter,
      };
    default:
      // User/getAll — no top-level `app`
      return {
        pageNo,
        itemsPerPage,
        filter,
        ...dates,
      };
  }
}

export function unpackUsers(data: unknown) {
  if (Array.isArray(data)) {
    return {
      rows: data as UserRow[],
      totalPages: 1,
      total: data.length,
    };
  }
  if (!data || typeof data !== 'object') {
    return { rows: [] as UserRow[], totalPages: 1, total: 0 };
  }

  const obj = data as Record<string, unknown>;
  const nested =
    obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
      ? (obj.payload as Record<string, unknown>)
      : obj;

  let rows: UserRow[] = [];
  if (Array.isArray(nested.items)) rows = nested.items as UserRow[];
  else if (Array.isArray(nested.users)) rows = nested.users as UserRow[];
  else if (Array.isArray(nested.user)) rows = nested.user as UserRow[];
  else if (Array.isArray(obj.items)) rows = obj.items as UserRow[];
  else if (Array.isArray(obj.users)) rows = obj.users as UserRow[];
  else rows = asList<UserRow>(nested);

  const total = Number(
    nested.total ?? nested.count ?? obj.total ?? obj.count ?? rows.length,
  );
  const totalPages = Math.max(
    1,
    Number(nested.totalPages ?? obj.totalPages ?? 1) || 1,
  );

  return {
    rows,
    totalPages,
    total: Number.isFinite(total) ? total : rows.length,
  };
}

export function unpackByType(type: UserType, data: unknown) {
  if (type === 'Todays_Active') {
    const raw = data as
      | {
          user?: UserRow[];
          users?: UserRow[];
          items?: UserRow[];
          totalPages?: number;
          count?: number;
          total?: number;
          payload?: {
            user?: UserRow[];
            users?: UserRow[];
            items?: UserRow[];
            count?: number;
            total?: number;
            totalPages?: number;
          };
        }
      | undefined;
    const nested = raw?.payload && typeof raw.payload === 'object' ? raw.payload : raw;
    const rows =
      (Array.isArray(nested?.user) && nested.user) ||
      (Array.isArray(nested?.users) && nested.users) ||
      (Array.isArray(nested?.items) && nested.items) ||
      (Array.isArray(raw?.user) && raw.user) ||
      [];
    return {
      rows,
      totalPages: Math.max(1, Number(nested?.totalPages ?? raw?.totalPages ?? 1) || 1),
      total: Number(nested?.count ?? nested?.total ?? raw?.count ?? raw?.total ?? rows.length) || 0,
    };
  }
  if (
    type === 'Active_User' ||
    type === 'Non_Performing_User' ||
    type === 'In_Active_Deposit' ||
    type === 'Non_Performing_Active_User' ||
    type === 'LAXMI_999_Users' ||
    type === 'Sub_Admin'
  ) {
    return asPaged<UserRow>(data);
  }
  return unpackUsers(data);
}

export function excludeDumped(rows: UserRow[]): UserRow[] {
  return rows.filter((row) => !row.dump);
}

function mapPlayInToken(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (s === 'E' || s === 'Exchange') return 'E';
  if (s === 'C' || s === 'Casino') return 'C';
  if (s === 'S' || s === 'Sports' || s === 'Satta') return 'S';
  return s;
}

export function playInLabel(value: unknown): string {
  if (Array.isArray(value)) {
    const joined = value.map(mapPlayInToken).filter(Boolean).join(', ');
    return joined || '-';
  }
  return mapPlayInToken(value) || display(value, '-');
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
  const raw = firstDefined(
    row.userBankName,
    row.bankName,
    row.user_bank_name,
    row.accountHolderName,
    row.bankHolderName,
    (row.bankDetails as { bankName?: unknown; name?: unknown } | undefined)
      ?.bankName,
    (row.bankDetails as { name?: unknown } | undefined)?.name,
  );
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function pickPlayIn(row: UserRow): string {
  const raw = firstDefined(
    row.played,
    row.playIn,
    row.play_in,
    row.PlayIn,
    row.playedGames,
  );
  return playInLabel(raw);
}

export function pickAccountNumber(row: UserRow): string {
  const raw = firstDefined(
    row.accountNumber,
    row.accountNo,
    row.accNo,
    row.account_number,
    (row.bankDetails as { accountNumber?: unknown } | undefined)?.accountNumber,
  );
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function pickAadharNumber(row: UserRow): string {
  const raw = firstDefined(
    row.aadhaarNumber,
    row.aadharNumber,
    row.aadhar,
    row.aadhaar,
  );
  const text = raw == null ? '' : String(raw).trim();
  return text || '-';
}

export function nestedCallerName(value: unknown): string {
  if (!value || typeof value !== 'object') return '-';
  const name = (value as { name?: unknown }).name;
  return name ? String(name) : '-';
}
