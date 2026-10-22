import {
  buildGtelCallsQuery,
  buildGtelSummaryCards,
  emptyGtelFilters,
  normalizeGtelCallsPage,
  type GtelCall,
  type GtelFilters,
  type GtelStatusFilter,
  type GtelSummaryCard,
} from '@astro/shared';
import { secureApi } from '../../../../api/client';

export type GtelCallsPageParams = {
  page: number;
  pageSize: number;
  filters: GtelFilters;
  statusFilter: GtelStatusFilter;
  canShowMobile: boolean;
  shouldLockEmpCode: boolean;
  loginEmpCode: string;
  isCaller: boolean;
  loginExtensionId: string;
};

export type GtelCallsPageResult = {
  rows: GtelCall[];
  total: number;
  totalPages: number;
  summary: Record<string, unknown> | null;
  summaryCards: GtelSummaryCard[];
};

export async function fetchGtelCallsPage(
  params: GtelCallsPageParams,
): Promise<GtelCallsPageResult> {
  const empCodeFilter = params.shouldLockEmpCode
    ? params.loginEmpCode
    : params.filters.empCode.trim();
  const res = await secureApi(
    'gtel.calls',
    buildGtelCallsQuery({
      pageNo: params.page,
      itemsPerPage: params.pageSize,
      filters: { ...params.filters, status: params.statusFilter },
      canShowMobile: params.canShowMobile,
      shouldLockEmpCode: params.shouldLockEmpCode,
      loginEmpCode: params.loginEmpCode,
      isCaller: params.isCaller,
      loginExtensionId: params.loginExtensionId,
    }),
  );
  if (!res.ok) {
    throw new Error(res.message || 'Failed to fetch calls');
  }
  const parsed = normalizeGtelCallsPage(res.data, params.pageSize, empCodeFilter || undefined);
  return {
    rows: parsed.rows,
    total: parsed.total,
    totalPages: parsed.totalPages,
    summary: parsed.summary,
    summaryCards: buildGtelSummaryCards(parsed.summary, parsed.rows, parsed.total),
  };
}

export type GtelCallerCallsCappedParams = {
  empCode: string;
  from: string;
  to: string;
  canShowMobile: boolean;
  shouldLockEmpCode: boolean;
  loginEmpCode: string;
  isCaller: boolean;
  loginExtensionId: string;
  maxCalls?: number;
  pageSize?: number;
};

export type GtelCallerCallsCappedResult = {
  calls: GtelCall[];
  totalAvailable: number;
  summaryCards: GtelSummaryCard[];
  truncated: boolean;
};

/** Page gtel.calls until maxCalls — used for Dashboard→Calls CX chips. */
export async function fetchGtelCallerCallsCapped(
  params: GtelCallerCallsCappedParams,
): Promise<GtelCallerCallsCappedResult> {
  const empCode = params.empCode.trim();
  if (!empCode) {
    throw new Error('Employee code is required to load caller calls.');
  }
  const pageSize = params.pageSize ?? 200;
  const maxCalls = params.maxCalls ?? 600;
  const collected: GtelCall[] = [];
  let pageNo = 1;
  let serverTotal = 0;
  let serverPages = 1;
  const today = params.from || params.to || '';
  const filters = {
    ...emptyGtelFilters(today, empCode),
    from: params.from || today,
    to: params.to || today,
    empCode,
  };

  while (pageNo <= serverPages && collected.length < maxCalls) {
    const res = await secureApi(
      'gtel.calls',
      buildGtelCallsQuery({
        pageNo,
        itemsPerPage: pageSize,
        filters,
        canShowMobile: params.canShowMobile,
        shouldLockEmpCode: params.shouldLockEmpCode,
        loginEmpCode: params.loginEmpCode,
        isCaller: params.isCaller,
        loginExtensionId: params.loginExtensionId,
      }),
    );
    if (!res.ok) {
      throw new Error(res.message || 'Failed to fetch calls');
    }
    const parsed = normalizeGtelCallsPage(res.data, pageSize, empCode);
    serverTotal = parsed.total;
    serverPages = parsed.totalPages;
    collected.push(...parsed.rows);
    if (!parsed.rows.length) break;
    pageNo += 1;
  }

  return {
    calls: collected,
    totalAvailable: serverTotal,
    summaryCards: buildGtelSummaryCards(null, collected, collected.length),
    truncated: serverTotal > collected.length,
  };
}
