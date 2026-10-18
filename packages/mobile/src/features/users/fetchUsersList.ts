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
  if (callerEmpScoped && !loginEmpCode) {
    throw new Error('No empCode on this login. Ask admin to assign empCode.');
  }

  const filter: Record<string, unknown> = {};
  if (
    userType !== 'Sub_Admin' &&
    userType !== 'LAXMI_999_Users' &&
    userType !== 'Active_User'
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
  const app =
    userType !== 'User' && allottedApps && !searchingDpId ? { app: allottedApps } : {};
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
      scoped[appClientName] = [...(map[appClientName] as string[])];
    } else {
      for (const [key, states] of Object.entries(map)) {
        if (Array.isArray(states)) scoped[key] = [...(states as string[])];
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
  if (callerEmpScoped && loginEmpCode && !searchingDpId) {
    list = filterCallerEmpScope(list, loginEmpCode, Boolean(callerSearchingOther));
  }

  return {
    rows: list,
    totalPages: Math.max(1, Number(nested.totalPages ?? raw.totalPages ?? 1) || 1),
    total: Number(nested.total ?? nested.count ?? raw.total ?? raw.count ?? list.length) || 0,
  };
}
