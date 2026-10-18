/**
 * Total Users Balance / Bonus / Registered lists — network fetch.
 */
import { asPaged } from '@astro/shared';
import { secureApi } from '../../api/client';
import type { SearchFieldKey } from '../../screens/dashboards/details/DetailFilterBar';

export type DashboardUsersKind = 'balance' | 'bonus' | 'registered';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  balance?: number;
  bonusBalance?: number;
  clientName?: string;
  city?: string;
  state?: string;
  [key: string]: unknown;
};

type DashboardUsersResponse = {
  users?: UserRow[];
  items?: UserRow[];
  totalBalance?: number;
  totalBonusBalance?: number;
  total?: number;
  totalPages?: number;
};

const ACTION: Record<
  DashboardUsersKind,
  'users.getAllBalance' | 'users.getAllBonus' | 'users.registeredUser'
> = {
  balance: 'users.getAllBalance',
  bonus: 'users.getAllBonus',
  registered: 'users.registeredUser',
};

export type DashboardUsersListParams = {
  kind: DashboardUsersKind;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  appClientName: string;
  userType: '' | 'Active' | 'InActive';
  stateFilter: string;
  appliedSearch: { field: SearchFieldKey; text: string };
};

export type DashboardUsersListResult = {
  rows: UserRow[];
  totalPages: number;
  totalBalance: number;
};

export async function fetchDashboardUsersList(
  params: DashboardUsersListParams,
): Promise<DashboardUsersListResult> {
  const filter: Record<string, unknown> = {};
  if (params.appClientName) filter.clientName = params.appClientName;
  if (params.stateFilter) filter.state = params.stateFilter;
  if (params.userType === 'Active') filter.active = true;
  if (params.userType === 'InActive') filter.inActive = true;

  const searchText = params.appliedSearch.text.trim();
  if (searchText) {
    if (params.appliedSearch.field === 'balance') {
      const n = Number(searchText);
      if (Number.isFinite(n)) filter.balance = n;
    } else {
      filter[params.appliedSearch.field] = searchText;
    }
  }

  const payload: Record<string, unknown> = {
    startDate: params.startDate,
    endDate: params.endDate,
    itemsPerPage: params.pageSize,
    pageNo: params.page,
    filter,
  };
  if (params.kind === 'balance') payload.decreasing = true;

  const res = await secureApi<DashboardUsersResponse | UserRow[]>(ACTION[params.kind], payload);
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load users');
  }

  const paged = asPaged<UserRow>(res.data);
  const envelope = Array.isArray(res.data) ? {} : (res.data ?? {});
  const totalBalance =
    Number(envelope.totalBalance ?? envelope.totalBonusBalance ?? envelope.total ?? 0) || 0;

  return {
    rows: paged.rows,
    totalPages: Math.max(1, paged.totalPages || 1),
    totalBalance,
  };
}
