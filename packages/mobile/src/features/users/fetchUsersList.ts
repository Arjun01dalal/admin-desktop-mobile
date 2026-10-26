/**
 * CX / Users list — network fetch only (used by useUsersList).
 */
import { balanceRangeToFilter, type UserType } from '@astro/shared/userTypes';
import { secureApi } from '../../api/client';
import type { SearchFieldKey } from '../../screens/dashboards/details/DetailFilterBar';
import { TYPE_ACTION, filterCallerEmpScope, type Row } from './helpers';

export type UsersListResponse = {
  items?: Row[];
  users?: Row[];
  user?: Row[];
  data?: Row[];
  payload?: Record<string, unknown>;
  totalPages?: number;
  total?: number;
  count?: number;
};

export type UsersListParams = {
  userType: UserType;
  page: number;
  pageSize: number;
  dates: { start: string; end: string } | null;
  appClientName: string;
  blockFilter: '' | 'block' | 'unblock';
  balanceRange: string;
  appliedSearch: { field: SearchFieldKey; text: string };
  isCaller: boolean;
  admin: Record<string, unknown> | null;
};

export type UsersListResult = {
  rows: Row[];
  total: number;
  totalPages: number;
};

export async function fetchUsersList(params: UsersListParams): Promise<UsersListResult> {
  const {
    userType,
    page,
    pageSize,
    dates,
    appClientName,
    blockFilter,
    balanceRange,
    appliedSearch,
    isCaller,
    admin,
  } = params;

  const adminRec = admin ?? {};
  const loginEmpCode = String(adminRec.empCode || '').trim();
  const callerEmpScoped = isCaller && userType !== 'Sub_Admin';
  // In_Active_Deposit does not use empCode (API + client) — allow load without it.
  if (callerEmpScoped && userType !== 'In_Active_Deposit' && !loginEmpCode) {
    throw new Error('No empCode on this login. Ask admin to assign empCode.');
  }

  const filter: Record<string, unknown> = {};
  if (
    userType !== 'Sub_Admin' &&
    userType !== 'LAXMI_999_Users' &&
    userType !== 'Active_User' &&
    userType !== 'In_Active_Deposit'
  ) {
    filter.uniqueUser = false;
  }
  const searchText = appliedSearch.text.trim();
  const searchingDpId =
    Boolean(searchText) &&
    (appliedSearch.field === '_id' ||
      appliedSearch.field === 'dpId' ||
      appliedSearch.field === 'dp_id');
  if (searchText && !(callerEmpScoped && appliedSearch.field === 'empCode')) {
    const field =
      appliedSearch.field === 'dpId' || appliedSearch.field === 'dp_id'
        ? '_id'
        : appliedSearch.field;
    if (searchingDpId) {
      for (const key of Object.keys(filter)) {
        if (key !== 'uniqueUser') delete filter[key];
      }
      filter._id = searchText;
    } else {
      filter[field] = searchText;
    }
  }
  if (blockFilter && userType === 'User' && !searchingDpId) {
    filter.blockUser = blockFilter === 'block';
  }
  if (
    balanceRange &&
    !searchingDpId &&
    userType !== 'Sub_Admin' &&
    userType !== 'Non_Performing_Active_User' &&
    userType !== 'LAXMI_999_Users'
  ) {
    Object.assign(filter, balanceRangeToFilter(balanceRange));
  }
  const callerSearchingOther =
    callerEmpScoped && Boolean(searchText) && appliedSearch.field !== 'empCode';
  if (
    callerEmpScoped &&
    loginEmpCode &&
    userType !== 'In_Active_Deposit' &&
    !callerSearchingOther &&
    !searchingDpId
  ) {
    filter.empCode = loginEmpCode;
  }

  const allottedApps = (adminRec.clientName || adminRec.allotedApps) as
    | string
    | string[]
    | undefined;
  const hasAppValue =
    typeof allottedApps === 'string'
      ? allottedApps.trim().length > 0
      : Array.isArray(allottedApps) && allottedApps.length > 0;
  const app =
    userType !== 'User' && hasAppValue && !searchingDpId ? { app: allottedApps } : {};
  let withAppState: Record<string, unknown> = {};
  const aws = adminRec.appWithState;
  if (
    !searchingDpId &&
    userType !== 'User' &&
    userType !== 'Sub_Admin' &&
    aws &&
    typeof aws === 'object' &&
    !Array.isArray(aws)
  ) {
    const map = aws as Record<string, unknown>;
    const scoped: Record<string, string[]> = {};
    if (appClientName && Array.isArray(map[appClientName])) {
      const states = (map[appClientName] as string[]).filter(Boolean);
      if (states.length > 0) scoped[appClientName] = states;
    } else {
      for (const [key, states] of Object.entries(map)) {
        if (!Array.isArray(states)) continue;
        const cleaned = (states as string[]).filter(Boolean);
        if (cleaned.length > 0) scoped[key] = cleaned;
      }
    }
    if (Object.keys(scoped).length > 0) withAppState = { appWithState: scoped };
  }

  if (
    appClientName &&
    userType !== 'Sub_Admin' &&
    userType !== 'LAXMI_999_Users' &&
    !searchingDpId
  ) {
    filter.clientName = appClientName;
  }

  const datePayload =
    !searchingDpId && dates ? { startDate: dates.start, endDate: dates.end } : {};

  let payload: Record<string, unknown>;
  switch (userType) {
    case 'Sub_Admin':
      payload = {
        pageNo: page,
        itemPerPage: pageSize,
        ...(Object.keys(filter).length ? { filter } : {}),
      };
      break;
    case 'Non_Performing_User':
      payload = {
        pageNo: page,
        itemPerPage: pageSize,
        filter,
        ...datePayload,
        ...app,
        ...withAppState,
      };
      break;
    case 'Non_Performing_Active_User':
      payload = { filter };
      break;
    case 'LAXMI_999_Users':
      payload = { pageNo: page, itemsPerPage: pageSize, filter };
      break;
    case 'Active_User':
      payload = {
        pageNo: page,
        itemsPerPage: pageSize,
        filter,
        ...(!searchingDpId && dates
          ? { activeUserStartDate: dates.start, activeUserEndDate: dates.end }
          : {}),
        ...app,
        ...withAppState,
      };
      break;
    case 'In_Active_Deposit': {
      // Cap page size. Dates only when set — no today default.
      const perPage = Math.min(Math.max(1, Number(pageSize) || 25), 100);
      payload = {
        pageNo: page,
        itemsPerPage: perPage,
        filter,
        ...datePayload,
        ...app,
        ...withAppState,
      };
      break;
    }
    default:
      payload = {
        pageNo: page,
        itemsPerPage: pageSize,
        filter,
        ...datePayload,
        ...(userType === 'User'
          ? { activeUserStart: '', activeUserEnd: '' }
          : { ...app, ...withAppState }),
      };
  }

  const res = await secureApi<UsersListResponse | Row[]>(TYPE_ACTION[userType], payload);
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load users');
  }

  const raw = Array.isArray(res.data) ? {} : ((res.data ?? {}) as UsersListResponse);
  const nested =
    raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
      ? (raw.payload as Record<string, unknown>)
      : (raw as Record<string, unknown>);
  let list = Array.isArray(res.data)
    ? res.data
    : ((nested.items ??
        nested.users ??
        nested.user ??
        nested.data ??
        raw.items ??
        raw.users ??
        raw.user ??
        raw.data ??
        []) as Row[]);
  // In_Active_Deposit is app/state scoped — do not wipe rows by empCode (desktop parity).
  if (
    callerEmpScoped &&
    loginEmpCode &&
    !searchingDpId &&
    userType !== 'In_Active_Deposit'
  ) {
    list = filterCallerEmpScope(list, loginEmpCode, Boolean(callerSearchingOther));
  }

  return {
    rows: list,
    totalPages: Math.max(1, Number(nested.totalPages ?? raw.totalPages ?? 1) || 1),
    total: Number(nested.total ?? nested.count ?? raw.total ?? raw.count ?? list.length) || 0,
  };
}
