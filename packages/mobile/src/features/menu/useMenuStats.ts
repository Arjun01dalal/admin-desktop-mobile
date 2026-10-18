/**
 * Menu hub stats — always-fresh on focus + pull-to-refresh (useScreenQuery).
 */
import { queryKeys } from '../../api/queryKeys';
import { useScreenQuery } from '../../hooks/useScreenQuery';
import { todayIST } from '../../utils/dates';
import { fetchMenuStats } from './fetchMenuStats';

export type MenuStats = {
  balance: number;
  totalDeposit: number;
  pendingWithdrawal: number;
  totalWithdrawal: number;
  asOfDate: string;
};

export function useMenuStats(enabled = true): {
  stats: MenuStats | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<unknown>;
} {
  const day = todayIST();
  const query = useScreenQuery({
    queryKey: queryKeys.menuStats.today(day),
    queryFn: fetchMenuStats,
    enabled,
  });

  return {
    stats: enabled ? (query.data ?? null) : null,
    loading: enabled && query.loading,
    refreshing: enabled && query.refreshing,
    refresh: query.refresh,
  };
}
