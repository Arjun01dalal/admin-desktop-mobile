/**
 * Balance / Bonus / Registered lists — always-fresh (useScreenQuery).
 */
import { queryKeys } from '../../api/queryKeys';
import { useScreenQuery } from '../../hooks/useScreenQuery';
import {
  fetchDashboardUsersList,
  type DashboardUsersListParams,
  type DashboardUsersListResult,
} from './fetchDashboardUsersList';

export function useDashboardUsersList(params: DashboardUsersListParams): {
  rows: DashboardUsersListResult['rows'];
  totalPages: number;
  totalBalance: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
} {
  const query = useScreenQuery({
    queryKey: queryKeys.dashboardUsers.list(params.kind, params),
    queryFn: () => fetchDashboardUsersList(params),
  });

  return {
    rows: query.data?.rows ?? [],
    totalPages: query.data?.totalPages ?? 1,
    totalBalance: query.data?.totalBalance ?? 0,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.errorMessage,
    refresh: query.refresh,
  };
}
