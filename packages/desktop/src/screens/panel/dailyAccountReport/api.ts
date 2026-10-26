/**
 * Daily Account Report — secureApi wrappers.
 * Thin adapters only: normalization / validation live in @astro/shared/dailyAccountReport.
 * Never hardcode API URLs here — paths live in electron/secure/registry.cjs.
 */
import { secureApi } from '@/api/secureClient';
import {
  type BankAccount,
  type DailyBalanceRow,
  type DarSubAdminOption,
  type DaySheetItem,
  type ListResult,
  type MidAllotment,
  type MidRecord,
  type UpdatedBy,
  MAX_BALANCE_IMAGE_BYTES,
  listAllotments,
  listBankAccounts,
  listDailyBalances,
  listDaySheet,
  listMids,
  normalizeAllotment,
  normalizeDailyBalance,
  parseSubAdminOptions,
  validateBalanceImageFile,
} from '@astro/shared/dailyAccountReport';

export type {
  BankAccount,
  DailyBalanceRow,
  DarSubAdminOption as SubAdminOption,
  DaySheetItem,
  ListResult,
  MidAllotment,
  MidRecord,
  UpdatedBy,
};

export type ListQuery = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  source?: string;
  signal?: AbortSignal;
};

/** secureApi failures surface as a thrown Error so callers keep try/catch flows from the reference. */
function throwIfFailed(message: string | undefined, fallback: string): never {
  const err = new Error(message || fallback) as Error & { isDarApiError?: boolean };
  err.isDarApiError = true;
  throw err;
}

export function darApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Bank accounts
// ---------------------------------------------------------------------------

export async function fetchBankAccounts(query: ListQuery): Promise<ListResult<BankAccount>> {
  const res = await secureApi('dailyAccountReport.bankAccounts.list', {
    page: query.page,
    limit: query.limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load bank accounts');
  return listBankAccounts(res.data, query.page, query.limit);
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

// ---------------------------------------------------------------------------
// MIDs
// ---------------------------------------------------------------------------

export async function fetchMids(query: ListQuery): Promise<ListResult<MidRecord>> {
  const res = await secureApi('dailyAccountReport.mids.list', {
    page: query.page,
    limit: query.limit,
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load MIDs');
  return listMids(res.data, query.page, query.limit);
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

// ---------------------------------------------------------------------------
// MID allotments
// ---------------------------------------------------------------------------

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

export type ActiveAllotmentQuery = {
  subAdminId?: string;
  midId?: string;
};

export async function fetchActiveAllotments(
  query: ActiveAllotmentQuery = {},
): Promise<ListResult<MidAllotment>> {
  const res = await secureApi('dailyAccountReport.allotments.active', {
    ...(query.subAdminId ? { subAdminId: query.subAdminId } : {}),
    ...(query.midId ? { midId: query.midId } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load roster');
  return listAllotments(res.data, 1, 50);
}

export type AllotmentHistoryQuery = {
  midId?: string;
  subAdminId?: string;
  active?: boolean;
  page?: number;
  limit?: number;
};

export async function fetchAllotmentHistory(
  query: AllotmentHistoryQuery = {},
): Promise<ListResult<MidAllotment>> {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const res = await secureApi('dailyAccountReport.allotments.history', {
    page,
    limit,
    ...(query.midId ? { midId: query.midId } : {}),
    ...(query.subAdminId ? { subAdminId: query.subAdminId } : {}),
    ...(query.active !== undefined ? { active: query.active } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load history');
  return listAllotments(res.data, page, limit);
}

export { normalizeAllotment };

// ---------------------------------------------------------------------------
// Sub-admins — reuse existing `users.getSubAdmins` secure action.
// ---------------------------------------------------------------------------

export async function loadSubAdminOptions(): Promise<DarSubAdminOption[]> {
  const res = await secureApi('users.getSubAdmins', { pageNo: 1, itemPerPage: 1000 });
  if (!res.ok) return [];
  return parseSubAdminOptions(res.data);
}

// ---------------------------------------------------------------------------
// Daily balances (open / close)
// ---------------------------------------------------------------------------

export type DaySheetQuery = {
  date?: string;
  from?: string;
  to?: string;
  midId?: string;
  subAdminId?: string;
  signal?: AbortSignal;
};

export async function fetchDaySheet(
  query: DaySheetQuery = {},
): Promise<{ items: DaySheetItem[]; total: number }> {
  const res = await secureApi('dailyAccountReport.balances.daySheet', {
    ...(query.date ? { date: query.date } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.midId ? { midId: query.midId } : {}),
    ...(query.subAdminId ? { subAdminId: query.subAdminId } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load day sheet');
  return listDaySheet(res.data);
}

export type BalanceListQuery = {
  midId?: string;
  subAdminId?: string;
  type?: 'open' | 'close';
  date?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export async function fetchDailyBalances(
  query: BalanceListQuery = {},
): Promise<ListResult<DailyBalanceRow>> {
  const page = query.page || 1;
  const limit = query.limit || 50;
  const res = await secureApi('dailyAccountReport.balances.list', {
    page,
    limit,
    ...(query.midId ? { midId: query.midId } : {}),
    ...(query.subAdminId ? { subAdminId: query.subAdminId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.date ? { date: query.date } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load balances');
  return listDailyBalances(res.data, page, limit);
}

export async function getDailyBalanceById(id: string): Promise<DailyBalanceRow> {
  const res = await secureApi('dailyAccountReport.balances.getById', { id });
  if (!res.ok) throwIfFailed(res.message, 'Failed to load balance detail');
  return normalizeDailyBalance(res.data);
}

/** ~10MB binary → base64 ceiling (+ small header slack) before we even hit main. */
const MAX_BALANCE_IMAGE_BASE64_CHARS = Math.ceil((MAX_BALANCE_IMAGE_BYTES * 4) / 3) + 64;

/**
 * Validate + encode a balance screenshot for the IPC bridge.
 * Main process rebuilds multipart FormData — renderer never posts the file itself.
 */
async function encodeBalanceImage(
  file: File,
): Promise<{ image: string; imageMime: string }> {
  const validationError = validateBalanceImageFile(file);
  if (validationError) throw new Error(validationError);

  const image = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',').pop() || '' : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });

  if (!image) throw new Error('Image data is empty');
  if (image.length > MAX_BALANCE_IMAGE_BASE64_CHARS) {
    throw new Error('Image must be 10MB or less');
  }

  return { image, imageMime: file.type };
}

export type UpsertBalanceInput = {
  midId: string;
  type: 'open' | 'close';
  amount: number | string;
  date?: string;
  remark?: string;
  image?: File | null;
  updatedBy: UpdatedBy;
};

export async function upsertDailyBalance(input: UpsertBalanceInput) {
  const encoded = input.image ? await encodeBalanceImage(input.image) : null;
  const res = await secureApi('dailyAccountReport.balances.upsert', {
    midId: input.midId,
    type: input.type,
    amount: Number(input.amount),
    ...(input.date ? { date: input.date } : {}),
    ...(input.remark ? { remark: input.remark } : {}),
    ...(encoded ? encoded : {}),
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

export type CorrectBalanceInput = {
  _id: string;
  amount: number | string;
  remark: string;
  image?: File | null;
  updatedBy: UpdatedBy;
};

export async function correctDailyBalance(input: CorrectBalanceInput) {
  const encoded = input.image ? await encodeBalanceImage(input.image) : null;
  const res = await secureApi('dailyAccountReport.balances.correct', {
    _id: input._id,
    amount: Number(input.amount),
    remark: input.remark,
    ...(encoded ? encoded : {}),
    userId: input.updatedBy.userId,
    userName: input.updatedBy.userName,
  });
  if (!res.ok) throwIfFailed(res.message, 'Failed to save balance');
  return res;
}
