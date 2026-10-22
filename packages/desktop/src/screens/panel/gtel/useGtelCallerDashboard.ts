/** Load + filter Gtel Caller Dashboard via useSecureQuery. */

import { useCallback, useMemo } from 'react';

import {
  assembleGtelCallerDashboard,
  type GtelCallerDashCard,
  type GtelCallerDashRow,
} from '@astro/shared';
import { useSecureQuery } from '@/screens/panel/dashboards/useSecureQuery';

import { useGtelAuth } from './useGtelAuth';

type Filters = { from: string; to: string; empCode: string };

export function useGtelCallerDashboard(filters: Filters): {
  cards: GtelCallerDashCard[];
  callers: GtelCallerDashRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  lockEmpCode: boolean;
  loginEmpCode: string;
} {
  const {
    admin,
    loginEmpCode,
    loginUserId,
    roleId,
    lockEmpCode,
    restrictToAssignedCallers,
  } = useGtelAuth();

  const dashPayload = useMemo(() => {
    const payload: Record<string, unknown> = {};
    if (filters.from.trim()) payload.from = filters.from.trim();
    if (filters.to.trim()) payload.to = filters.to.trim();
    const code = lockEmpCode ? loginEmpCode : filters.empCode.trim();
    if (code) payload.empCode = code;
    return payload;
  }, [filters.empCode, filters.from, filters.to, lockEmpCode, loginEmpCode]);

  const dashQuery = useSecureQuery<unknown>('gtel.callerDashboard', dashPayload, {
    cacheTtlMs: 0,
  });

  const allotQuery = useSecureQuery<{ byRole?: unknown }>(
    'ops.callerAllotmentSubadmins',
    { filter: {} },
    { enabled: restrictToAssignedCallers, cacheTtlMs: 0 },
  );

  const loginNames = useMemo(
    () =>
      [admin?.name, (admin as { realName?: string } | null)?.realName].map((n) =>
        String(n || '').trim(),
      ),
    [admin],
  );

  const assembled = useMemo(() => {
    if (!dashQuery.data) {
      return { cards: [] as GtelCallerDashCard[], callers: [] as GtelCallerDashRow[], emptyMessage: null };
    }
    if (restrictToAssignedCallers && allotQuery.error) {
      return { cards: [] as GtelCallerDashCard[], callers: [] as GtelCallerDashRow[], emptyMessage: null };
    }
    if (restrictToAssignedCallers && allotQuery.loading && !allotQuery.data) {
      return { cards: [] as GtelCallerDashCard[], callers: [] as GtelCallerDashRow[], emptyMessage: null };
    }
    return assembleGtelCallerDashboard({
      dashBody: dashQuery.data,
      allotByRole: allotQuery.data?.byRole,
      restrictToAssignedCallers,
      roleId,
      userId: loginUserId,
      empCode: loginEmpCode,
      loginNames,
    });
  }, [
    allotQuery.data,
    allotQuery.error,
    allotQuery.loading,
    dashQuery.data,
    loginEmpCode,
    loginNames,
    loginUserId,
    restrictToAssignedCallers,
    roleId,
  ]);

  const loading =
    dashQuery.loading || (restrictToAssignedCallers && allotQuery.loading && !allotQuery.data);
  const error =
    dashQuery.error ||
    (restrictToAssignedCallers ? allotQuery.error : null) ||
    (!loading ? assembled.emptyMessage : null);

  const dashRefetch = dashQuery.refetch;
  const allotRefetch = allotQuery.refetch;
  const reload = useCallback(async () => {
    await dashRefetch();
    if (restrictToAssignedCallers) await allotRefetch();
  }, [allotRefetch, dashRefetch, restrictToAssignedCallers]);

  return {
    cards: assembled.cards,
    callers: assembled.callers,
    loading,
    error,
    reload,
    lockEmpCode,
    loginEmpCode,
  };
}
