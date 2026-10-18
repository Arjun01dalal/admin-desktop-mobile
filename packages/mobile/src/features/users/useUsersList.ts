/**
 * CX / Users list — always-fresh (useScreenQuery).
 */
import { queryKeys } from '../../api/queryKeys';
import { useScreenQuery } from '../../hooks/useScreenQuery';
import { fetchUsersList, type UsersListParams } from './fetchUsersList';
import type { Row } from './helpers';

export function useUsersList(params: UsersListParams): {
  rows: Row[];
  total: number;
  totalPages: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
} {
  const query = useScreenQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => fetchUsersList(params),
  });

  return {
    rows: query.data?.rows ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.errorMessage,
    refresh: query.refresh,
  };
}
