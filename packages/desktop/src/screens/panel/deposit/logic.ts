/** Deposit UI helpers. Settle/check rules live in @astro/shared/depositRules. */

export {
  SETTLE_REASONS,
  isWithin3Days,
  canEditDeposit,
  canShowCheckAction,
  defaultSettleReason,
  settleReasonOptions,
  isUpiGateway,
} from '@astro/shared/depositRules';

export function depositRowBg(status?: string, mode: 'light' | 'dark' = 'dark'): string | undefined {
  const s = String(status || '').toLowerCase();
  const light = mode === 'light';
  // Light mode needs pale tints — the dark greens/reds turn rows unreadable.
  if (s === 'approved' || s === 'approved-clr' || s === 'success') {
    // Light orange (replaces parrot green).
    return light ? '#ffe8cc' : 'rgba(255, 159, 10, 0.28)';
  }
  if (s === 'rejected' || s === 'failed' || s === 'cancel') {
    return light ? '#fde8e8' : '#3d1b1b';
  }
  if (s === 'pending' || s === 'processing') return undefined;
  return light ? '#e8f0fb' : '#1a2f45';
}

export type ScannerRow = {
  _id?: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  mobile?: string;
  clientName?: string;
  balance?: number | string;
  state?: string;
  city?: string;
  updatedBy?: { name?: string } | string;
  reason?: string;
  remakr?: string;
  remark?: string;
  mid?: string | number;
  utr?: string;
  createdOn?: string;
  updatedOn?: string;
};
