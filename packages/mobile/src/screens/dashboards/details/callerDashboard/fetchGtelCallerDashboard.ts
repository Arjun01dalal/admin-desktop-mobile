import {
  assembleGtelCallerDashboard,
  type GtelCallerDashCard,
  type GtelCallerDashRow,
} from '@astro/shared';
import { secureApi } from '../../../../api/client';

export type FetchGtelCallerDashboardParams = {
  from: string;
  to: string;
  empCode: string;
  lockEmpCode: boolean;
  loginEmpCode: string;
  restrictToAssignedCallers: boolean;
  roleId: string;
  loginUserId: string;
  loginNames: string[];
};

export type FetchGtelCallerDashboardResult = {
  cards: GtelCallerDashCard[];
  callers: GtelCallerDashRow[];
  emptyMessage: string | null;
};

export async function fetchGtelCallerDashboard(
  params: FetchGtelCallerDashboardParams,
): Promise<FetchGtelCallerDashboardResult> {
  const payload: Record<string, unknown> = {};
  if (params.from.trim()) payload.from = params.from.trim();
  if (params.to.trim()) payload.to = params.to.trim();
  const code = params.lockEmpCode ? params.loginEmpCode : params.empCode.trim();
  if (code) payload.empCode = code;

  const dashPromise = secureApi('gtel.callerDashboard', payload);
  const allotPromise = params.restrictToAssignedCallers
    ? secureApi('ops.callerAllotmentSubadmins', { filter: {} })
    : Promise.resolve(null);

  const [res, allotRes] = await Promise.all([dashPromise, allotPromise]);
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load caller dashboard');
  }
  if (params.restrictToAssignedCallers) {
    if (!allotRes?.ok) {
      throw new Error(allotRes?.message || 'Failed to load caller allotment');
    }
  }

  const allotByRole =
    allotRes?.data && typeof allotRes.data === 'object'
      ? (allotRes.data as { byRole?: unknown }).byRole
      : undefined;

  return assembleGtelCallerDashboard({
    dashBody: res.data,
    allotByRole,
    restrictToAssignedCallers: params.restrictToAssignedCallers,
    roleId: params.roleId,
    userId: params.loginUserId,
    empCode: params.loginEmpCode,
    loginNames: params.loginNames,
  });
}
