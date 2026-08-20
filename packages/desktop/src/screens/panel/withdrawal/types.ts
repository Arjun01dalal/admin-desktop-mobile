export type CheckPerson = {
  name?: string;
  status?: boolean;
  date?: string;
  userId?: string;
};

export type DelayReason = {
  name?: string;
  userId?: string;
  reason?: string;
  date?: string;
};

/** Row of `validationResults` from getAllTransaction (laxmi ValidationModal). */
export type ValidationItem = {
  _id?: string;
  point?: string | number;
  name?: string;
  passed?: boolean;
  reason?: string;
  details?: Record<string, unknown>;
};

export type WithdrawalRow = {
  _id: string;
  userId?: string;
  userName?: string;
  empCode?: string;
  accountHolderName?: string;
  mobile?: string;
  userMobile?: string;
  clientName?: string;
  amount?: number | string;
  status?: string;
  state?: string;
  city?: string;
  userBankName?: string;
  bankName?: string;
  orderId?: string;
  transactionId?: string;
  dp_id?: string;
  accountNo?: string;
  ifscCode?: string;
  commissionAmount?: number | string;
  createdOn?: string;
  updatedOn?: string;
  mid?: string | number;
  paymentGatewayName?: string;
  withdrewalProviderName?: string;
  lockBy?: { name?: string; date?: string };
  checkBy?: CheckPerson;
  crossCheckBy?: CheckPerson;
  action?: { name?: string; status?: string };
  pnl?: number | string;
  afterWithdrawalPnl?: number | string;
  playedGames?: string;
  beneficiaryAccounts?: string[] | string;
  delayReason?: DelayReason;
  validationCheckedAt?: string;
  passedPoints?: number;
  totalPoints?: number;
  validationResults?: ValidationItem[];
  upiId?: string;
};

export type ColumnFilters = {
  userName: string;
  empCode: string;
  amount: string;
  status: string;
  clientName: string;
  state: string;
  city: string;
  transactionId: string;
  dp_id: string;
  accountNo: string;
  ifscCode: string;
  mobile: string;
  mid: string;
  playedGames: string;
};

export type QueryState = {
  startDate: string;
  endDate: string;
  allData: boolean;
  filters: ColumnFilters;
};

export const EMPTY_FILTERS: ColumnFilters = {
  userName: '',
  empCode: '',
  amount: '',
  status: '',
  clientName: '',
  state: '',
  city: '',
  transactionId: '',
  dp_id: '',
  accountNo: '',
  ifscCode: '',
  mobile: '',
  mid: '',
  playedGames: '',
};

export const ACTION_STATUSES = [
  'Approved',
  'Rejected',
  'Reverse',
  'on hold',
  'Manual Approved',
] as const;

export const TERMINAL_STATUSES = new Set([
  'Approved',
  'Rejected',
  'Reverse',
  'Cancel',
  'Failed',
]);

export const MANUAL_GATEWAYS = [
  'bramhadev',
  'jk Bank',
  'personal',
  'kotak',
  'OFS-HDFC',
  'OFS-AXIS',
  'axis',
  'yesBank',
  'payok',
  'uco',
  'ansin-ecommerce-JK',
  'OFS-ansin',
  'digitech',
  'rpf',
  'shyam-trading',
] as const;

/** Flat summary from `/SubAdmin/fund-request` → `payload.WithdrawalData`. */
export type WithdrawalSummary = {
  totalApprovedCount?: number;
  totalApprovedAmount?: number;
  totalPendingCount?: number;
  totalPendingAmount?: number;
  totalRejectedCount?: number;
  totalRejectedAmount?: number;
  totalReversedCount?: number;
  totalReversedAmount?: number;
  totalOnholdCount?: number;
  totalOnholdAmount?: number;
  totalCanceledCount?: number;
  totalCanceledAmount?: number;
};

export function emptyWithdrawalSummary(): WithdrawalSummary {
  return {};
}

export function withdrawalStatLabel(
  prefix: string,
  count?: number,
  amount?: number,
): string {
  return `${prefix} (${count ?? 0}) : ${amount ?? 0}`;
}

/** Normalize fund-request response into WithdrawalData flat fields. */
export function asWithdrawalSummary(data: unknown): WithdrawalSummary {
  if (!data || typeof data !== 'object') return {};
  const root = data as Record<string, unknown>;
  const payload =
    root.payload && typeof root.payload === 'object' && !Array.isArray(root.payload)
      ? (root.payload as Record<string, unknown>)
      : root;
  const nested = payload.WithdrawalData;
  const src =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : payload;

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Prefer flat WithdrawalData keys; fall back to nested deposit-style buckets
  const bucket = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return { count: 0, amount: 0 };
    const b = obj as Record<string, unknown>;
    return { count: num(b.count), amount: num(b.totalAmount) };
  };

  const approvedBucket = bucket(src.totalApprovedWithdrawalData);
  const pendingBucket = bucket(src.totalPendingWithdrawalData);
  const rejectedBucket = bucket(src.totalWithdrawalRejected);
  const reverseBucket = bucket(src.totalReverseWithdrawalData);
  const onholdBucket = bucket(src.totalOnholdWithdrawalData);

  return {
    totalApprovedCount: num(src.totalApprovedCount ?? approvedBucket.count),
    totalApprovedAmount: num(src.totalApprovedAmount ?? approvedBucket.amount),
    totalPendingCount: num(src.totalPendingCount ?? pendingBucket.count),
    totalPendingAmount: num(src.totalPendingAmount ?? pendingBucket.amount),
    totalRejectedCount: num(src.totalRejectedCount ?? rejectedBucket.count),
    totalRejectedAmount: num(src.totalRejectedAmount ?? rejectedBucket.amount),
    totalReversedCount: num(src.totalReversedCount ?? reverseBucket.count),
    totalReversedAmount: num(src.totalReversedAmount ?? reverseBucket.amount),
    totalOnholdCount: num(src.totalOnholdCount ?? onholdBucket.count),
    totalOnholdAmount: num(src.totalOnholdAmount ?? onholdBucket.amount),
    totalCanceledCount: num(src.totalCanceledCount),
    totalCanceledAmount: num(src.totalCanceledAmount),
  };
}

export const DELAY_REASONS = [
  'delayed due to High ratio winning',
  'Tikit raised to the provider',
  'Withdrawal is delayed due to down payment gateways',
  'Withdrawal delayed due to suspicious activity',
  'withdraw request without playing',
  'multiple withdrawal will be given one by one',
  'withdrawal is on hold  due to high loss PNL',
  'waiting for the boss  reply',
] as const;

export const WIN_IN_OPTIONS = ['', 'E', 'C', 'S'] as const;
