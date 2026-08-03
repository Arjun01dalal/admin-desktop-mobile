/** Shared helpers for Deposit / Withdrawal / Fund Request pages. */

export const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  flexShrink: 0,
  minWidth: 'fit-content',
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export const actionBtnSx = {
  ...orangeBtnSx,
  height: 28,
  fontSize: 11,
  px: 1,
  py: 0.25,
};

export const fieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

export const filterSelectSx = {
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 },
};

export const toolbarBoxSx = {
  mb: 1.5,
  p: 1.5,
  borderRadius: 1.5,
  bgcolor: '#1a1a1f',
  border: '1px solid rgba(255,255,255,0.08)',
} as const;

export const toolbarGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(3, minmax(0, 1fr))',
    md: 'repeat(4, minmax(0, 1fr))',
    lg: 'repeat(5, minmax(0, 1fr))',
  },
  gap: 1.25,
  alignItems: 'center',
  width: '100%',
} as const;

export const chipSx = {
  bgcolor: 'rgba(255,159,10,0.15)',
  color: '#ff9f0a',
  fontWeight: 700,
} as const;

export const kpiCardSx = {
  p: 2,
  bgcolor: '#1a1a1f',
  border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: '#ff9f0a' },
  '&.active': { borderColor: '#ff9f0a' },
} as const;

export const DEPOSIT_STATUSES = [
  '',
  'Pending',
  'Approved',
  'Rejected',
  'Reverse',
  'on hold',
  'Processing',
] as const;

export const WITHDRAWAL_STATUSES = [
  '',
  'Pending',
  'IN PROGRESS',
  'Processing',
  'Approved',
  'Failed',
  'Cancel',
  'Rejected',
  'Reverse',
  'on hold',
] as const;

export const PAGE_SIZE_OPTIONS = [
  '10',
  '25',
  '50',
  '75',
  '100',
  '300',
  '500',
  '1000',
  '5000',
  '10000',
  '20000',
] as const;

export type MidOption = {
  _id?: string;
  mid?: string | number;
  name?: string;
  paymentGatewayName?: string;
};

export type FundSummaryBucket = {
  count?: number;
  totalAmount?: number;
};

export type DepositFundSummary = {
  depositData?: {
    depositApprovedCount?: number;
    depositApprovedTotal?: number;
    depositPendingCount?: number;
    depositPendingTotal?: number;
    depositRejectedCount?: number;
    depositRejectedTotal?: number;
  };
  uniquePendingDetail?: {
    pendingCount?: number;
    pendingAmount?: number;
  };
  appDeposit?: {
    appUserDepositSum?: number;
    appuserDepositCount?: number;
  };
  depositUserDetail?: {
    oldUserDepositSum?: number;
    oldUserDepositCount?: number;
    newUserDepositSum?: number;
    newUserDepositCount?: number;
  };
  coinScannerData?: {
    totalscannerDepositCount?: number;
    totalscannerDepositAmount?: number;
  };
  /** Flat withdrawal totals from fund-request payload.WithdrawalData */
  WithdrawalData?: {
    totalApprovedAmount?: number;
    totalApprovedCount?: number;
    todaysTotalApprovedAmount?: number;
    todaysTotalApprovedCount?: number;
    previousTotalApprovedAmount?: number;
    previousTotalApprovedCount?: number;
    totalPendingAmount?: number;
    totalPendingCount?: number;
    totalRejectedAmount?: number;
    totalRejectedCount?: number;
    totalReversedAmount?: number;
    totalReversedCount?: number;
    totalOnholdAmount?: number;
    totalOnholdCount?: number;
    totalCanceledAmount?: number;
    totalCanceledCount?: number;
  };
  depositeApprovedData?: FundSummaryBucket;
  depositePendingData?: FundSummaryBucket;
  totalApprovedWithdrawalData?: FundSummaryBucket;
  totalPendingWithdrawalData?: FundSummaryBucket;
  totalReverseWithdrawalData?: FundSummaryBucket;
  totalWithdrawalRejected?: FundSummaryBucket;
  totalOnholdWithdrawalData?: FundSummaryBucket;
};

export type FundRequestCoinSummary = {
  coinData?: {
    totalcasinoCredit?: number;
    totalcasinoCreditCount?: number;
    totalcasinoDebit?: number;
    totalcasinoDebitCount?: number;
    totalexchangeCredit?: number;
    totalexchangeCreditCount?: number;
    totalexchangeDebit?: number;
    totalexchangeDebitCount?: number;
    totalscannerDepositAmount?: number;
    totalscannerDepositCount?: number;
  };
};

export type BonusWalletSummary = {
  pendingCount?: number;
  totalPendingAmount?: number;
  totalAmountTransferToMainWallet?: number;
  totalCountTransferToMainWallet?: number;
  totalBonusWallet?: number;
  totalBonusWalletCount?: number;
};

export function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

export function asFundSummary(data: unknown): DepositFundSummary {
  return unpackPayload(data) as DepositFundSummary;
}

export function asFundCoinSummary(data: unknown): FundRequestCoinSummary {
  return unpackPayload(data) as FundRequestCoinSummary;
}

export function asBonusWalletSummary(data: unknown): BonusWalletSummary {
  return unpackPayload(data) as BonusWalletSummary;
}

export function bucketLabel(prefix: string, bucket?: FundSummaryBucket): string {
  const count = bucket?.count ?? 0;
  const amt = bucket?.totalAmount ?? 0;
  return `${prefix} (${count}) : ${amt}`;
}

export function statLabel(prefix: string, count?: number, amount?: number): string {
  return `${prefix} (${count ?? 0}) : ${amount ?? 0}`;
}

/** Map flat WithdrawalData (+ nested bucket fallback) into FundSummaryBucket. */
export function withdrawalBucket(
  summary: DepositFundSummary,
  flatCountKey: keyof NonNullable<DepositFundSummary['WithdrawalData']>,
  flatAmountKey: keyof NonNullable<DepositFundSummary['WithdrawalData']>,
  nested?: FundSummaryBucket,
): FundSummaryBucket {
  const w = summary.WithdrawalData;
  const count = Number(w?.[flatCountKey] ?? nested?.count ?? 0);
  const totalAmount = Number(w?.[flatAmountKey] ?? nested?.totalAmount ?? 0);
  return {
    count: Number.isFinite(count) ? count : 0,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : 0,
  };
}
