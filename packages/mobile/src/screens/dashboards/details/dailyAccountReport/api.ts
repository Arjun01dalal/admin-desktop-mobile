import {
  listAllotments,
  listBankAccounts,
  listDaySheet,
  listMids,
  normalizeDailyBalance,
  parseSubAdminOptions,
  parseSubAdminsFromByRole,
  type BankAccount,
  type DailyBalanceRow,
  type DarSubAdminOption,
  type DaySheetItem,
  type ListResult,
  type MidAllotment,
  type MidRecord,
  type UpdatedBy,
} from '@astro/shared/dailyAccountReport';

import { secureApi } from '../../../../api/client';

export type {
  BankAccount,
  DailyBalanceRow,
  DaySheetItem,
  ListResult,
  MidAllotment,
  MidRecord,
  UpdatedBy,
};
export type SubAdminOption = DarSubAdminOption;

function throwIfFailed(message: string | undefined, fallback: string): never {
  throw new Error(message || fallback);
}

export function darApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function fetchBankAccounts(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<ListResult<BankAccount>> {
  const page = query.page || 1;
  const limit = query.limit || 50;
  const res = await secureApi('dailyAccountReport.bankAccounts.list', {
    page,
    limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load bank accounts');
  return listBankAccounts(res.data, page, limit);
}

export async function createBankAccount(body: Record<string, unknown>) {
  const res = await secureApi('dailyAccountReport.bankAccounts.create', body);
  if (!res.ok) throwIfFailed(res.message, 'Failed to create bank account');
  return res;
}

export async function updateBankAccount(body: Record<string, unknown>) {
  const res = await secureApi('dailyAccountReport.bankAccounts.update', body);
  if (!res.ok) throwIfFailed(res.message, 'Failed to update bank account');
  return res;
}

export async function fetchMids(query: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
}): Promise<ListResult<MidRecord>> {
  const page = query.page || 1;
  const limit = query.limit || 50;
  const res = await secureApi('dailyAccountReport.mids.list', {
    page,
    limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load MIDs');
  return listMids(res.data, page, limit);
}

export async function createMid(body: Record<string, unknown>) {
  const res = await secureApi('dailyAccountReport.mids.create', body);
  if (!res.ok) throwIfFailed(res.message, 'Failed to create MID');
  return res;
}

export async function updateMid(body: Record<string, unknown>) {
  const res = await secureApi('dailyAccountReport.mids.update', body);
  if (!res.ok) throwIfFailed(res.message, 'Failed to update MID');
  return res;
}

export type AllotmentMutationBody = {
  midId: string;
  subAdminId?: string;
  remark?: string;
  updatedBy: UpdatedBy;
};

export async function allotMid(body: AllotmentMutationBody) {
  const res = await secureApi('dailyAccountReport.allotments.create', body);
  if (!res.ok) {
    const err = new Error(res.message || 'Allotment failed') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function reassignMid(body: AllotmentMutationBody) {
  const res = await secureApi('dailyAccountReport.allotments.reassign', body);
  if (!res.ok) throwIfFailed(res.message, 'Failed to reassign MID');
  return res;
}

export async function revokeMid(body: { midId: string; remark?: string; updatedBy: UpdatedBy }) {
  const res = await secureApi('dailyAccountReport.allotments.revoke', body);
  if (!res.ok) throwIfFailed(res.message, 'Failed to revoke MID');
  return res;
}

export async function fetchActiveAllotments(query: {
  subAdminId?: string;
  midId?: string;
} = {}): Promise<ListResult<MidAllotment>> {
  const res = await secureApi('dailyAccountReport.allotments.active', {
    ...(query.subAdminId ? { subAdminId: query.subAdminId } : {}),
    ...(query.midId ? { midId: query.midId } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load roster');
  return listAllotments(res.data, 1, 50);
}

export async function fetchDaySheet(query: {
  date?: string;
  midId?: string;
  subAdminId?: string;
}): Promise<{ items: DaySheetItem[]; total: number }> {
  const res = await secureApi('dailyAccountReport.balances.daySheet', {
    ...(query.date ? { date: query.date } : {}),
    ...(query.midId ? { midId: query.midId } : {}),
    ...(query.subAdminId ? { subAdminId: query.subAdminId } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load day sheet');
  return listDaySheet(res.data);
}

export async function getDailyBalanceById(id: string): Promise<DailyBalanceRow> {
  const res = await secureApi('dailyAccountReport.balances.getById', { id });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load balance detail');
  return normalizeDailyBalance(res.data);
}

export type BalanceImagePart = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

export async function upsertDailyBalance(input: {
  midId: string;
  type: 'open' | 'close';
  amount: number | string;
  date?: string;
  remark?: string;
  image?: BalanceImagePart | null;
  updatedBy: UpdatedBy;
}) {
  const res = await secureApi('dailyAccountReport.balances.upsert', {
    midId: input.midId,
    type: input.type,
    amount: Number(input.amount),
    ...(input.date ? { date: input.date } : {}),
    ...(input.remark ? { remark: input.remark } : {}),
    ...(input.image ? { imageUri: input.image.uri, imageName: input.image.name, imageMime: input.image.type } : {}),
    userId: input.updatedBy.userId,
    userName: input.updatedBy.userName,
  });
  if (!res.ok) {
    const err = new Error(res.message || 'Failed to save balance') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function correctDailyBalance(input: {
  _id: string;
  amount: number | string;
  remark: string;
  image?: BalanceImagePart | null;
  updatedBy: UpdatedBy;
}) {
  const res = await secureApi('dailyAccountReport.balances.correct', {
    _id: input._id,
    amount: Number(input.amount),
    remark: input.remark,
    ...(input.image ? { imageUri: input.image.uri, imageName: input.image.name, imageMime: input.image.type } : {}),
    userId: input.updatedBy.userId,
    userName: input.updatedBy.userName,
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to save balance');
  return res;
}

export async function loadSubAdminOptions(): Promise<SubAdminOption[]> {
  try {
    const byRoleRes = await secureApi('caller.subadminsByRole', { filter: {} });
    if (byRoleRes.ok) {
      const fromRoles = parseSubAdminsFromByRole(byRoleRes.data);
      if (fromRoles.length) return fromRoles;
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await secureApi('users.getSubAdmins', { pageNo: 1, itemPerPage: 1000 });
    if (!res.ok) return [];
    return parseSubAdminOptions(res.data);
  } catch {
    return [];
  }
}
