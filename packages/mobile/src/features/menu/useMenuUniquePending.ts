/**
 * Menu Unique Pending Total / Pending / Approved counts.
 */
import { queryKeys } from '../../api/queryKeys';
import { useScreenQuery } from '../../hooks/useScreenQuery';
import { todayIST } from '../../utils/dates';
import {
  fetchMenuUniquePending,
  type MenuUniquePendingStats,
} from './fetchMenuUniquePending';

export type { MenuUniquePendingStats };

export function useMenuUniquePending(enabled = true): {
  stats: MenuUniquePendingStats | null;
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
  refresh: () => Promise<unknown>;
} {
  const day = todayIST();
  const query = useScreenQuery({
    queryKey: queryKeys.menuUniquePending.today(day),
    queryFn: fetchMenuUniquePending,
    enabled,
  });

  return {
    stats: enabled ? (query.data ?? null) : null,
    loading: enabled && query.loading,
    refreshing: enabled && query.refreshing,
    errorMessage: enabled ? query.errorMessage : null,
    refresh: query.refresh,
  };
}
