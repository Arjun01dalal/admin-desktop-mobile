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

/** Show check / cross-check only when amount ≥ 10000 (lax Deposit). */
export function canShowCheckAction(row: DepositRow, hasPencil: boolean): boolean {
  if (!hasPencil) return false;
  return Number(row.amount ?? 0) >= 10000;
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

export function depositRowBg(status?: string): string | undefined {
  const s = String(status || '').toLowerCase();
  // Dark CommonTable-friendly tints (same idea as UPI Payments)
  if (s === 'approved' || s === 'approved-clr' || s === 'success') return '#1b3d2f';
  if (s === 'rejected' || s === 'failed' || s === 'cancel') return '#3d1b1b';
  if (s === 'pending' || s === 'processing') return undefined;
  return '#1a2f45';
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
