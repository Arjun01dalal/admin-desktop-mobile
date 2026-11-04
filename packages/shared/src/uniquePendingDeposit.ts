/**
 * Unique Deposit Pending — dual summary APIs + client-side analytics.
 *
 * Primary data source (admin-panel parity):
 *   POST /transaction/unique-pending-amount-summary
 *   POST /transaction/unique-pending-amount-all-summary
 *
 * Both return the filtered `list` plus aggregate counters / byState.
 * UI paginates and filters gateway / region client-side.
 */

import { unpackPayload } from './api/parse';

export const UNIQUE_PENDING_POLL_MS = 5000;

/** South-India states used for South / North region cards. */
export const UNIQUE_PENDING_SOUTH_STATES = new Set([
  'tamil nadu',
  'kerala',
  'karnataka',
  'andhra pradesh',
  'telangana',
  'puducherry',
  'lakshadweep',
]);

export type UniquePendingRegion = '' | 'south' | 'north';

export type UniquePendingReason = {
  reason?: string;
  name?: string;
  _id?: string;
};

export type UniquePendingRow = {
  _id?: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  mobile?: string;
  orderId?: string;
  amount?: number | string;
  paymentGatewayName?: string;
  mid?: string | number;
  status?: string;
  createdOn?: string;
  clientName?: string;
  userState?: string;
  state?: string;
  userCity?: string;
  city?: string;
  empCode?: string;
  transactionId?: string;
  uniquePendingReason?: UniquePendingReason;
};

export type UniquePendingServerFilter = {
  userId?: string;
  mobile?: string;
  state?: string;
  city?: string;
  clientName?: string;
  mid?: string;
  amount?: string | number;
};

export type UniquePendingSummaryFilterInput = {
  userId?: string;
  mobile?: string;
  state?: string;
  city?: string;
  clientName?: string;
  mid?: string;
  amount?: string;
};

export type UniquePendingByStateRow = {
  state: string;
  uniqueRequestCount: number;
  totalAmount: number;
  uniqueCustomerCount: number;
  allUniqueRequestCount: number;
  allTotalAmount: number;
  allUniqueCustomerCount: number;
  approvedTxnCount: number;
  approvedTotalAmount: number;
  approvedCustomerCount: number;
};

export type UniquePendingBucket = {
  uniqueRequestCount: number;
  totalAmount: number;
  uniqueCustomerCount: number;
};

export type UniquePendingGatewayCount = { name: string; count: number };

export type UniquePendingRegionCounts = { south: number; north: number };

export type UniquePendingSummaryView = {
  rows: UniquePendingRow[];
  pending: UniquePendingBucket;
  all: UniquePendingBucket;
  approved: UniquePendingBucket;
  gatewayCounts: UniquePendingGatewayCount[];
  regionCounts: UniquePendingRegionCounts;
  byState: UniquePendingByStateRow[];
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function rowState(row: Pick<UniquePendingRow, 'state' | 'userState'> | null | undefined): string {
  return String(row?.userState || row?.state || '').trim();
}

export function isSouthState(state: string): boolean {
  return UNIQUE_PENDING_SOUTH_STATES.has(state.trim().toLowerCase());
}

export function matchesUniquePendingRegion(
  row: Pick<UniquePendingRow, 'state' | 'userState'> | null | undefined,
  region: UniquePendingRegion,
): boolean {
  if (!region) return true;
  const south = isSouthState(rowState(row));
  return region === 'south' ? south : !south;
}

/** Approved = max(0, all − pending). */
export function diffUniquePendingApproved(allVal: unknown, pendingVal: unknown): number {
  return Math.max(0, num(allVal) - num(pendingVal));
}

export function buildUniquePendingServerFilter(
  input: UniquePendingSummaryFilterInput,
): UniquePendingServerFilter {
  const filter: UniquePendingServerFilter = {};
  const userId = String(input.userId || '').trim();
  const mobile = String(input.mobile || '').trim();
  const state = String(input.state || '').trim();
  const city = String(input.city || '').trim();
  const clientName = String(input.clientName || '').trim();
  const mid = String(input.mid || '').trim();
  const amount = String(input.amount || '').trim();

  if (userId) filter.userId = userId;
  if (mobile) filter.mobile = mobile;
  if (state) filter.state = state;
  if (city) filter.city = city;
  if (clientName) filter.clientName = clientName;
  if (mid) filter.mid = mid;
  if (amount) {
    const n = Number(amount);
    filter.amount = Number.isFinite(n) ? n : amount;
  }
  return filter;
}

export function buildUniquePendingSummaryPayload(
  startDate: string,
  endDate: string,
  input: UniquePendingSummaryFilterInput,
  fallbackDate: string,
): { startDate: string; endDate: string; filter: UniquePendingServerFilter } {
  return {
    startDate: String(startDate || '').trim() || fallbackDate,
    endDate: String(endDate || '').trim() || fallbackDate,
    filter: buildUniquePendingServerFilter(input),
  };
}

function parseBucket(src: Record<string, unknown> | null | undefined): UniquePendingBucket {
  return {
    uniqueRequestCount: num(src?.uniqueRequestCount),
    totalAmount: num(src?.totalAmount),
    uniqueCustomerCount: num(src?.uniqueCustomerCount),
  };
}

function parseRow(raw: unknown): UniquePendingRow | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = String(obj._id || obj.orderId || obj.transactionId || '').trim();
  if (!id && !obj.userId && !obj.userName) return null;
  const reason = asRecord(obj.uniquePendingReason);
  return {
    _id: id || String(obj.userId || ''),
    userId: obj.userId != null ? String(obj.userId) : undefined,
    userName: obj.userName != null ? String(obj.userName) : undefined,
    userMobile: obj.userMobile != null ? String(obj.userMobile) : undefined,
    mobile: obj.mobile != null ? String(obj.mobile) : undefined,
    orderId: obj.orderId != null ? String(obj.orderId) : undefined,
    amount: obj.amount as number | string | undefined,
    paymentGatewayName:
      obj.paymentGatewayName != null ? String(obj.paymentGatewayName) : undefined,
    mid: obj.mid as string | number | undefined,
    status: obj.status != null ? String(obj.status) : undefined,
    createdOn: obj.createdOn != null ? String(obj.createdOn) : undefined,
    clientName: obj.clientName != null ? String(obj.clientName) : undefined,
    userState: obj.userState != null ? String(obj.userState) : undefined,
    state: obj.state != null ? String(obj.state) : undefined,
    userCity: obj.userCity != null ? String(obj.userCity) : undefined,
    city: obj.city != null ? String(obj.city) : undefined,
    empCode: obj.empCode != null ? String(obj.empCode) : undefined,
    transactionId: obj.transactionId != null ? String(obj.transactionId) : undefined,
    uniquePendingReason: reason
      ? {
          reason: reason.reason != null ? String(reason.reason) : undefined,
          name: reason.name != null ? String(reason.name) : undefined,
          _id: reason._id != null ? String(reason._id) : undefined,
        }
      : undefined,
  };
}

export function aggregateUniquePendingGatewayCounts(
  rows: readonly UniquePendingRow[],
): UniquePendingGatewayCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = String(row.paymentGatewayName || '').trim() || 'Unknown';
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function countUniquePendingByRegion(
  rows: readonly UniquePendingRow[],
): UniquePendingRegionCounts {
  let south = 0;
  let north = 0;
  for (const row of rows) {
    if (isSouthState(rowState(row))) south += 1;
    else north += 1;
  }
  return { south, north };
}

export function mergeUniquePendingByState(
  pendingByState: unknown,
  allByState: unknown,
): UniquePendingByStateRow[] {
  const allMap = new Map<string, Record<string, unknown>>();
  for (const raw of asArray(allByState)) {
    const row = asRecord(raw);
    if (!row) continue;
    const key = String(row.state || '')
      .trim()
      .toLowerCase();
    if (!key) continue;
    allMap.set(key, row);
  }

  const merged = asArray(pendingByState)
    .map((raw) => {
      const row = asRecord(raw);
      if (!row) return null;
      const state = String(row.state || '').trim();
      if (!state) return null;
      const key = state.toLowerCase();
      const allRow = allMap.get(key) ?? {};
      return {
        state,
        uniqueRequestCount: num(row.uniqueRequestCount),
        totalAmount: num(row.totalAmount),
        uniqueCustomerCount: num(row.uniqueCustomerCount),
        allUniqueRequestCount: num(allRow.uniqueRequestCount),
        allTotalAmount: num(allRow.totalAmount),
        allUniqueCustomerCount: num(allRow.uniqueCustomerCount),
        approvedTxnCount: diffUniquePendingApproved(
          allRow.uniqueRequestCount,
          row.uniqueRequestCount,
        ),
        approvedTotalAmount: diffUniquePendingApproved(allRow.totalAmount, row.totalAmount),
        approvedCustomerCount: diffUniquePendingApproved(
          allRow.uniqueCustomerCount,
          row.uniqueCustomerCount,
        ),
      } satisfies UniquePendingByStateRow;
    })
    .filter((row): row is UniquePendingByStateRow => Boolean(row));

  merged.sort(
    (a, b) =>
      b.allTotalAmount - a.allTotalAmount ||
      b.totalAmount - a.totalAmount ||
      a.state.localeCompare(b.state),
  );
  return merged;
}

export type UniquePendingClientFilter = {
  accessibleStates?: readonly string[] | null;
  empCode?: string;
  gatewayName?: string;
  region?: UniquePendingRegion;
};

/** Apply accessible-states + empCode (server list already filtered by request filter). */
export function filterUniquePendingList(
  rows: readonly UniquePendingRow[],
  opts: Pick<UniquePendingClientFilter, 'accessibleStates' | 'empCode'> = {},
): UniquePendingRow[] {
  const states = (opts.accessibleStates || [])
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  const emp = String(opts.empCode || '')
    .trim()
    .toLowerCase();

  return rows.filter((row) => {
    if (states.length > 0) {
      const state = rowState(row).toLowerCase();
      if (!states.includes(state)) return false;
    }
    if (emp) {
      if (!String(row.empCode || '').toLowerCase().includes(emp)) return false;
    }
    return true;
  });
}

/** Gateway chip + South/North region (client-only). */
export function filterUniquePendingDisplay(
  rows: readonly UniquePendingRow[],
  opts: Pick<UniquePendingClientFilter, 'gatewayName' | 'region'> = {},
): UniquePendingRow[] {
  const gateway = String(opts.gatewayName || '').trim();
  const region = opts.region || '';
  return rows.filter((row) => {
    if (gateway && String(row.paymentGatewayName || '').trim() !== gateway) return false;
    return matchesUniquePendingRegion(row, region);
  });
}

export function paginateUniquePendingRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number,
): { pageRows: T[]; totalPages: number; total: number; safePage: number } {
  const total = rows.length;
  const size = Math.max(1, pageSize || 1);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page || 1), totalPages);
  const start = (safePage - 1) * size;
  return {
    pageRows: rows.slice(start, start + size) as T[],
    totalPages,
    total,
    safePage,
  };
}

export function assembleUniquePendingSummary(args: {
  pendingData: unknown;
  allData: unknown;
  accessibleStates?: readonly string[] | null;
  empCode?: string;
}): UniquePendingSummaryView {
  const pendingPayload = unpackPayload(args.pendingData);
  const allPayload = unpackPayload(args.allData);

  const parsedRows = asArray(pendingPayload.list)
    .map(parseRow)
    .filter((row): row is UniquePendingRow => Boolean(row));

  const rows = filterUniquePendingList(parsedRows, {
    accessibleStates: args.accessibleStates,
    empCode: args.empCode,
  });

  const pending = parseBucket(pendingPayload);
  const all = parseBucket(allPayload);
  const approved: UniquePendingBucket = {
    uniqueRequestCount: diffUniquePendingApproved(
      all.uniqueRequestCount,
      pending.uniqueRequestCount,
    ),
    totalAmount: diffUniquePendingApproved(all.totalAmount, pending.totalAmount),
    uniqueCustomerCount: diffUniquePendingApproved(
      all.uniqueCustomerCount,
      pending.uniqueCustomerCount,
    ),
  };

  return {
    rows,
    pending,
    all,
    approved,
    gatewayCounts: aggregateUniquePendingGatewayCounts(rows),
    regionCounts: countUniquePendingByRegion(rows),
    byState: mergeUniquePendingByState(pendingPayload.byState, allPayload.byState),
  };
}

export function uniquePendingPaymentMethod(
  gateway: unknown,
  mid: unknown,
): string {
  const g = gateway == null || gateway === '' ? '' : String(gateway);
  const m = mid != null && mid !== '' ? String(mid) : '';
  if (!g && !m) return '—';
  return m ? `${g} - ${m}` : g;
}

export function uniquePendingStatusColor(status: unknown): string | undefined {
  const s = String(status || '').toLowerCase();
  if (s === 'approve' || s === 'approved' || s === 'success') return '#16a34a';
  if (s === 'pending') return '#d97706';
  if (s === 'failed' || s === 'reject' || s === 'rejected') return '#dc2626';
  return undefined;
}

/** Highlight callers with this many (or more) pending deposits. */
export const CALLER_WISE_HIGH_PENDING = 5;

export type CallerWiseUniquePendingRow = {
  empCode: string;
  callerName: string;
  successful: number;
  successfulAmount: number;
  pending: number;
  pendingAmount: number;
  approved: number;
  approvedAmount: number;
};

export type CallerWiseUniquePendingTotals = {
  successful: number;
  successfulAmount: number;
  pending: number;
  pendingAmount: number;
  approved: number;
  approvedAmount: number;
};

export type CallerWiseUniquePendingBundle = {
  rows: CallerWiseUniquePendingRow[];
  pendingByEmpCode: Record<string, UniquePendingRow[]>;
};

export function normalizeUniquePendingEmpCode(empCode: unknown): string {
  const value = String(empCode ?? '').trim();
  return value || 'Unassigned';
}

export function extractUniquePendingList(data: unknown): UniquePendingRow[] {
  const payload = unpackPayload(data);
  return asArray(payload.list)
    .map(parseRow)
    .filter((row): row is UniquePendingRow => Boolean(row));
}

function sumAmount(rows: readonly UniquePendingRow[]): number {
  return rows.reduce((sum, row) => sum + num(row.amount), 0);
}

function groupByEmpCode(rows: readonly UniquePendingRow[]): Map<string, UniquePendingRow[]> {
  const map = new Map<string, UniquePendingRow[]>();
  for (const row of rows) {
    const empCode = normalizeUniquePendingEmpCode(row.empCode);
    const bucket = map.get(empCode);
    if (bucket) bucket.push(row);
    else map.set(empCode, [row]);
  }
  return map;
}

function resolveCallerName(empCode: string, nameMap: Record<string, string>): string {
  if (empCode === 'Unassigned') return '';
  const direct = nameMap[empCode];
  if (direct) return direct;
  const stripped = empCode.replace(/^0+/, '') || '0';
  return nameMap[stripped] || '';
}

/**
 * Caller-wise aggregation for Unique Pending (admin-panel CallerWiseWithdrawalModal).
 * `pendingRows` = unique-pending-amount-summary list
 * `allRows` = unique-pending-amount-all-summary list ("successful")
 */
export function buildCallerWiseUniquePending(
  pendingRows: readonly UniquePendingRow[],
  allRows: readonly UniquePendingRow[],
  nameMap: Record<string, string> = {},
): CallerWiseUniquePendingBundle {
  const pendingGrouped = groupByEmpCode(pendingRows);
  const successfulGrouped = groupByEmpCode(allRows);

  const empCodes = new Set<string>([...pendingGrouped.keys(), ...successfulGrouped.keys()]);
  const pendingByEmpCode: Record<string, UniquePendingRow[]> = {};
  pendingGrouped.forEach((items, empCode) => {
    pendingByEmpCode[empCode] = items;
  });

  const rows: CallerWiseUniquePendingRow[] = Array.from(empCodes).map((empCode) => {
    const pendingItems = pendingGrouped.get(empCode) || [];
    const successfulItems = successfulGrouped.get(empCode) || [];
    const successful = successfulItems.length;
    const pending = pendingItems.length;
    const pendingAmount = sumAmount(pendingItems);
    const successfulAmount = sumAmount(successfulItems);
    return {
      empCode,
      callerName: resolveCallerName(empCode, nameMap),
      successful,
      successfulAmount,
      pending,
      pendingAmount,
      approved: Math.max(0, successful - pending),
      approvedAmount: Math.max(0, successfulAmount - pendingAmount),
    };
  });

  rows.sort((a, b) => b.pending - a.pending || b.pendingAmount - a.pendingAmount);

  return { rows, pendingByEmpCode };
}

export function filterCallerWiseUniquePendingRows(
  rows: readonly CallerWiseUniquePendingRow[],
  search: string,
): CallerWiseUniquePendingRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows as CallerWiseUniquePendingRow[];
  return rows.filter(
    (row) =>
      row.empCode.toLowerCase().includes(q) || row.callerName.toLowerCase().includes(q),
  );
}

export function sumCallerWiseUniquePendingTotals(
  rows: readonly CallerWiseUniquePendingRow[],
): CallerWiseUniquePendingTotals {
  return rows.reduce(
    (acc, row) => {
      acc.successful += row.successful;
      acc.successfulAmount += row.successfulAmount;
      acc.pending += row.pending;
      acc.pendingAmount += row.pendingAmount;
      acc.approved += row.approved;
      acc.approvedAmount += row.approvedAmount;
      return acc;
    },
    {
      successful: 0,
      successfulAmount: 0,
      pending: 0,
      pendingAmount: 0,
      approved: 0,
      approvedAmount: 0,
    },
  );
}

export function filterCallerWisePendingItems(
  items: readonly UniquePendingRow[],
  search: string,
  opts: { canShowMobile?: boolean } = {},
): UniquePendingRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return items as UniquePendingRow[];
  const canShowMobile = Boolean(opts.canShowMobile);
  return items.filter((item) => {
    const haystack = [
      item.userName,
      canShowMobile ? item.userMobile || item.mobile : '',
      item.orderId,
      item.userState,
      item.state,
      item.userCity,
      item.city,
      item.paymentGatewayName,
      item.mid,
      item.clientName,
      item.amount,
      item.status,
    ]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return haystack.includes(q);
  });
}
