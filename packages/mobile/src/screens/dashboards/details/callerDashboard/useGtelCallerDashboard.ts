/** Gtel Caller Dashboard data — always-fresh (useScreenQuery). */
import { useMemo } from 'react';
import {
  CALLER_ROLE_IDS,
  EMPCODE_LIST_FILTER_ROLE_ID,
  isGtelCallerHeadDashboardRole,
  type GtelCallerDashCard,
  type GtelCallerDashRow,
} from '@astro/shared';
import { queryKeys } from '../../../../api/queryKeys';
import { hasPermission, isCallerRole } from '../../../../auth/permissions';
import { useScreenQuery } from '../../../../hooks/useScreenQuery';
import { getStoredUser } from '../../../../lib/webShim';
import { fetchGtelCallerDashboard } from './fetchGtelCallerDashboard';

export function useGtelCallerDashboard(filters: {
  from: string;
  to: string;
  empCode: string;
}): {
  canAccess: boolean;
  lockEmpCode: boolean;
  loginEmpCode: string;
  cards: GtelCallerDashCard[];
  callers: GtelCallerDashRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
} {
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const canAccess = hasPermission('show_gtel_dashboard', admin);
  const loginEmpCode = String(admin?.empCode || '').trim();
  const loginUserId = String(admin?._id || '').trim();
  const roleId = String(admin?.Role_ID || '');
  const isCallerNew = roleId === EMPCODE_LIST_FILTER_ROLE_ID;
  const isCaller = CALLER_ROLE_IDS.has(roleId) || isCallerRole(admin);
  const restrictToAssignedCallers = isGtelCallerHeadDashboardRole(roleId);
  const lockEmpCode = (isCaller || isCallerNew) && Boolean(loginEmpCode);

  const loginNames = useMemo(
    () =>
      [admin?.name, admin?.realName, admin?.chatName].map((n) => String(n || '').trim()),
    [admin],
  );

  const params = useMemo(
    () => ({
      from: filters.from,
      to: filters.to,
      empCode: filters.empCode,
      lockEmpCode,
      loginEmpCode,
      restrictToAssignedCallers,
      roleId,
      loginUserId,
      loginNames,
    }),
    [
      filters.empCode,
      filters.from,
      filters.to,
      lockEmpCode,
      loginEmpCode,
      loginNames,
      loginUserId,
      restrictToAssignedCallers,
      roleId,
    ],
  );

  const query = useScreenQuery({
    queryKey: queryKeys.gtelCallerDashboard.page(params),
    queryFn: () => fetchGtelCallerDashboard(params),
    enabled: canAccess,
  });

  return {
    canAccess,
    lockEmpCode,
    loginEmpCode,
    cards: query.data?.cards ?? [],
    callers: query.data?.callers ?? [],
    loading: query.loading || query.refreshing,
    error: query.errorMessage ?? (!query.loading ? query.data?.emptyMessage ?? null : null),
    refresh: query.refresh,
  };
}
