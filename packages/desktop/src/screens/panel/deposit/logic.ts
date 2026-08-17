/** Simplified Deposit business rules (from laxminarayan Deposit.tsx). */

import type { DepositRow } from './DepositCells';

const UPI_GATEWAYS = new Set(['upi-payment', 'IMPS', 'NEFT']);

export const SETTLE_REASONS = [
  'deposit-uco-trpl',
  'Deposit Failure',
  'instant-deposit-manual',
  'deposit-upi-id',
  'deposit-sapt-rishi',
  'deposit-manual',
] as const;

export function isWithin3Days(date?: string): boolean {
  if (!date) return false;
  const requestDate = new Date(date);
  if (Number.isNaN(requestDate.getTime())) return false;
  const diffDays = (Date.now() - requestDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}

/** Pencil / settle gate — Deposit_Pensil + amount/age/check rules. */
export function canEditDeposit(row: DepositRow, hasPencil: boolean): boolean {
  if (!hasPencil) return false;
  const status = String(row.status || '').toLowerCase();
  if (status !== 'pending' && status !== 'processing') return false;

  const isOld = !isWithin3Days(row.createdOn);
  const isChecked = !!(row.checkBy && row.crossCheckBy);
  const isHighAmount = Number(row.amount ?? 0) >= 10000;

  if (isOld) return isChecked;
  if (!isHighAmount) return true;
  return isChecked;
}

/** Show check / cross-check — Laxmi Deposit.tsx:
 *  (Deposit_Pensil && amount ≥ 10000) || (!within3Days && status !== Approved)
 *  So low-amount rows still get check options when older than 3 days and not Approved.
 */
export function canShowCheckAction(row: DepositRow, hasPencil: boolean): boolean {
  const amount = Number(row.amount ?? 0);
  if (hasPencil && amount >= 10000) return true;
  const status = String(row.status || '');
  return !isWithin3Days(row.createdOn) && status !== 'Approved';
}

export function defaultSettleReason(row: DepositRow): string {
  const gateway = String(row.paymentGatewayName || '').replace(/\t/g, '');
  const status = String(row.status || '').toLowerCase();
  if (status === 'pending') {
    if (String((row as { paymentType?: string }).paymentType || '') === 'instant-deposit-manual') {
      return 'instant-deposit-manual';
    }
    return gateway ? `manual-deposit-${gateway}` : 'deposit-manual';
  }
  return 'deposit-manual';
}

export function settleReasonOptions(row: DepositRow): string[] {
  const gateway = String(row.paymentGatewayName || '').replace(/\t/g, '');
  const dynamic = gateway ? `manual-deposit-${gateway}` : '';
  const base = [...SETTLE_REASONS];
  if (dynamic && !base.includes(dynamic as (typeof SETTLE_REASONS)[number])) {
    return [dynamic, ...base];
  }
  return base;
}

export function isUpiGateway(gateway?: string): boolean {
  return UPI_GATEWAYS.has(String(gateway || ''));
}

export function depositRowBg(
  status?: string,
  mode: 'light' | 'dark' = 'dark',
): string | undefined {
  const s = String(status || '').toLowerCase();
  const light = mode === 'light';
  // Light mode needs pale tints — the dark greens/reds turn rows unreadable.
  if (s === 'approved' || s === 'approved-clr' || s === 'success') {
    // Brighter parrot / lime green (not forest-dark).
    return light ? '#e8fbc8' : '#2f5f1c';
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
