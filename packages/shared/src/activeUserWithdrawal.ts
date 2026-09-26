export type ActiveUserWithdrawalSortBy = 'activeUser' | 'createdOn';
export type ActiveUserWithdrawalSortOrder = 'asc' | 'desc';

export type ActiveUserWithdrawalRow = {
  _id?: string;
  name?: string;
  userName?: string;
  userId?: string;
  dp_id?: string;
  Dp_ID?: string;
  clientName?: string;
  appName?: string;
  mobile?: string;
  userMobile?: string;
  createdOn?: string;
  createdAt?: string;
  amount?: number | string;
  Amount?: number | string;
  orderId?: string;
  order_id?: string;
  status?: string;
  empCode?: string;
  activeUser?: unknown;
  isActiveUser?: unknown;
  userBankName?: string;
  accountNo?: string;
  accountNumber?: string;
  bankName?: string;
  [key: string]: unknown;
};

export type ActiveUserWithdrawalQuery = {
  empCode?: string | null;
  status?: string;
  sortBy?: ActiveUserWithdrawalSortBy | string;
  sortOrder?: ActiveUserWithdrawalSortOrder | string;
  startDate?: string;
  endDate?: string;
  pageNo: number;
  itemPerPage: number;
  /** When non-empty → status forced to Pending and dates omitted. */
  beneficiaryAccounts?: string[];
};

export type ActiveUserWithdrawalPage = {
  rows: ActiveUserWithdrawalRow[];
  total: number;
  totalPages: number;
};

export const ACTIVE_USER_WITHDRAWAL_STATUSES = [
  { value: 'All', label: 'All' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Processing', label: 'Processing' },
] as const;

export const ACTIVE_USER_WITHDRAWAL_SORT_BY = [
  { value: 'activeUser', label: 'Active User' },
  { value: 'createdOn', label: 'Created On' },
] as const;

export const ACTIVE_USER_WITHDRAWAL_SORT_ORDER = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const;

export const DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE = 100;

export function empCodeFromUser(user: Record<string, unknown> | null | undefined): string {
  if (!user || typeof user !== 'object') return '';
  const raw = user.empCode ?? user.emp_code ?? user.EmpCode;
  return raw == null ? '' : String(raw).trim();
}

function normalizeBeneAccounts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((s) => String(s ?? '').trim()).filter(Boolean);
}

/** Build the API body (Laxmi useActiveUserWithdrawals parity). */
export function buildActiveUserWithdrawalPayload(
  query: ActiveUserWithdrawalQuery,
): Record<string, unknown> {
  const beneficiaryAccounts = normalizeBeneAccounts(query.beneficiaryAccounts);
  const hasBeneFilter = beneficiaryAccounts.length > 0;

  const rawStatus = String(query.status ?? '').trim();
  const status = hasBeneFilter
    ? 'Pending'
    : !rawStatus || rawStatus.toLowerCase() === 'all'
      ? 'All'
      : rawStatus;

  const body: Record<string, unknown> = {
    sortBy: query.sortBy === 'createdOn' ? 'createdOn' : 'activeUser',
    sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc',
    pageNo: Math.max(1, Number(query.pageNo) || 1),
    itemPerPage: Math.max(1, Number(query.itemPerPage) || DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE),
    status,
  };

  // Beneficiary filter: do not send startDate/endDate
  if (!hasBeneFilter) {
    const startDate = String(query.startDate ?? '').trim();
    const endDate = String(query.endDate ?? '').trim();
    if (startDate) body.startDate = startDate;
    if (endDate) body.endDate = endDate;
  }

  const empCode = String(query.empCode ?? '').trim();
  if (empCode) body.empCode = empCode;

  if (hasBeneFilter) body.beneficiaryAccounts = beneficiaryAccounts;

  return body;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickRowList(value: unknown): ActiveUserWithdrawalRow[] {
  if (Array.isArray(value)) return value as ActiveUserWithdrawalRow[];
  const obj = asRecord(value);
  if (!obj) return [];
  for (const key of [
    'items',
    'withdrawals',
    'docs',
    'transactions',
    'list',
    'records',
    'data',
    'rows',
  ] as const) {
    const candidate = obj[key];
    if (Array.isArray(candidate)) return candidate as ActiveUserWithdrawalRow[];
  }
  const nested = asRecord(obj.payload ?? obj.result);
  if (nested) return pickRowList(nested);
  return [];
}

export function normalizeActiveUserWithdrawals(
  data: unknown,
  pageSize = DEFAULT_ACTIVE_USER_WITHDRAWAL_PAGE_SIZE,
): ActiveUserWithdrawalPage {
  const rows = pickRowList(data);
  const root = asRecord(data) ?? {};
  const nested = asRecord(root.payload ?? root.result) ?? root;
  const total = Number(
    nested.total ?? nested.totalCount ?? nested.count ?? root.total ?? root.count ?? rows.length,
  );
  const rawPages = Number(nested.totalPages ?? root.totalPages ?? 0);
  const safeTotal = Number.isFinite(total) ? total : rows.length;
  const totalPages =
    Number.isFinite(rawPages) && rawPages > 0
      ? rawPages
      : Math.max(1, Math.ceil(safeTotal / Math.max(1, pageSize)) || 1);
  return { rows, total: safeTotal, totalPages };
}

export function pickWithdrawalName(row: ActiveUserWithdrawalRow): string {
  return String(row.userName || row.name || '—');
}

export function pickWithdrawalDpId(row: ActiveUserWithdrawalRow): string {
  return String(row.dp_id || row.Dp_ID || row.userId || '');
}

export function pickWithdrawalApp(row: ActiveUserWithdrawalRow): unknown {
  return row.clientName || row.appName || row.app_name || row.AppName || row.subDomain;
}

export function pickWithdrawalMobile(row: ActiveUserWithdrawalRow): string {
  return String(row.mobile || row.userMobile || '');
}

export function pickWithdrawalCreatedAt(row: ActiveUserWithdrawalRow): unknown {
  return row.createdOn || row.createdAt || row.created_at;
}

export function pickWithdrawalAmount(row: ActiveUserWithdrawalRow): unknown {
  return row.amount ?? row.Amount;
}

export function pickWithdrawalOrderId(row: ActiveUserWithdrawalRow): string {
  return String(row.orderId || row.order_id || '—');
}

export function pickWithdrawalStatus(row: ActiveUserWithdrawalRow): string {
  return String(row.status || '—');
}

export function pickWithdrawalRowKey(row: ActiveUserWithdrawalRow, index: number): string {
  return String(row._id || row.orderId || row.order_id || `${pickWithdrawalDpId(row)}-${index}`);
}
