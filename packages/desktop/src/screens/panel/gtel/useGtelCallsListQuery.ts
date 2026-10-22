/**
 * Gtel Calls list via useSecureQuery (normalize in hook).
 */
import { useMemo } from 'react';

import { useSecureQuery } from '@/screens/panel/dashboards/useSecureQuery';
import {
  buildGtelCallsQuery,
  buildGtelSummaryCards,
  normalizeGtelCallsPage,
  type GtelCall,
  type GtelFilters,
  type GtelSummaryCard,
} from '@astro/shared';

export type GtelCallsListQueryParams = {
  page: number;
  pageSize: number;
  filters: GtelFilters;
  canShowMobile: boolean;
  shouldLockEmpCode: boolean;
  loginEmpCode: string;
  isCaller: boolean;
  loginExtensionId: string;
  /** When set (Dashboard→Calls), require emp and override date/emp from route. */
  hideHeroActions?: boolean;
  routeEmp?: string;
  routeFrom?: string;
  routeTo?: string;
  enabled?: boolean;
};

export type GtelCallsListQueryResult = {
  rows: GtelCall[];
  total: number;
  totalPages: number;
  summary: Record<string, unknown> | null;
  summaryCards: GtelSummaryCard[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useGtelCallsListQuery(params: GtelCallsListQueryParams): GtelCallsListQueryResult {
  const empCodeFilter = params.shouldLockEmpCode
    ? params.loginEmpCode
    : (params.hideHeroActions
        ? params.routeEmp || params.filters.empCode
        : params.filters.empCode
      ).trim();

  const missingEmp = Boolean(params.hideHeroActions && !empCodeFilter);

  const payload = useMemo(
    () =>
      buildGtelCallsQuery({
        pageNo: params.page,
        itemsPerPage: params.pageSize,
        filters: {
          ...params.filters,
          status: '',
          empCode: empCodeFilter || params.filters.empCode,
          from: params.hideHeroActions
            ? params.routeFrom || params.filters.from
            : params.filters.from,
          to: params.hideHeroActions ? params.routeTo || params.filters.to : params.filters.to,
        },
        canShowMobile: params.canShowMobile,
        shouldLockEmpCode: params.shouldLockEmpCode,
        loginEmpCode: params.loginEmpCode,
        isCaller: params.isCaller,
        loginExtensionId: params.loginExtensionId,
      }),
    [
      empCodeFilter,
      params.canShowMobile,
      params.filters,
      params.hideHeroActions,
      params.isCaller,
      params.loginEmpCode,
      params.loginExtensionId,
      params.page,
      params.pageSize,
      params.routeFrom,
      params.routeTo,
      params.shouldLockEmpCode,
    ],
  );

  const { data, loading, error, refetch } = useSecureQuery<unknown>('gtel.calls', payload, {
    enabled: (params.enabled ?? true) && !missingEmp,
    cacheTtlMs: 0,
  });

  const parsed = useMemo(() => {
    if (!data) {
      return {
        rows: [] as GtelCall[],
        total: 0,
        totalPages: 1,
        summary: null as Record<string, unknown> | null,
        summaryCards: [] as GtelSummaryCard[],
      };
    }
    const page = normalizeGtelCallsPage(data, params.pageSize, empCodeFilter || undefined);
    return {
      rows: page.rows,
      total: page.total,
      totalPages: page.totalPages,
      summary: page.summary,
      summaryCards: buildGtelSummaryCards(page.summary, page.rows, page.total),
    };
  }, [data, empCodeFilter, params.pageSize]);

  return {
    ...parsed,
    loading: missingEmp ? false : loading,
    error: missingEmp ? 'Employee code is required to load caller calls.' : error,
    refetch,
  };
}
