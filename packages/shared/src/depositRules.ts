/**
 * Deposit settle / check rules shared by desktop and mobile.
 * UI colors stay in each client.
 */

export const SETTLE_REASONS = [
  'deposit-uco-trpl',
  'Deposit Failure',
  'instant-deposit-manual',
  'deposit-upi-id',
  'deposit-sapt-rishi',
  'deposit-manual',
] as const;

const UPI_GATEWAYS = new Set(['upi-payment', 'IMPS', 'NEFT']);

export type DepositGateRow = {
  status?: string;
  createdOn?: string;
  amount?: number | string;
  checkBy?: unknown;
  crossCheckBy?: unknown;
  paymentGatewayName?: string;
  paymentType?: string;
};

export function isWithin3Days(date?: string): boolean {
  if (!date) return false;
  const requestDate = new Date(date);
  if (Number.isNaN(requestDate.getTime())) return false;
  const diffDays = (Date.now() - requestDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 3;
}

/** Pencil / settle gate — Deposit_Pensil + amount/age/check rules. */
export function canEditDeposit(row: DepositGateRow, hasPencil: boolean): boolean {
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

/** Show check / cross-check — high amount with pencil, or older than 3 days and not Approved. */
export function canShowCheckAction(row: DepositGateRow, hasPencil: boolean): boolean {
  const amount = Number(row.amount ?? 0);
  if (hasPencil && amount >= 10000) return true;
  const status = String(row.status || '');
  return !isWithin3Days(row.createdOn) && status !== 'Approved';
}

export function defaultSettleReason(row: DepositGateRow): string {
  const gateway = String(row.paymentGatewayName || '').replace(/\t/g, '');
  const status = String(row.status || '').toLowerCase();
  if (status === 'pending') {
    if (String(row.paymentType || '') === 'instant-deposit-manual') {
      return 'instant-deposit-manual';
    }
    return gateway ? `manual-deposit-${gateway}` : 'deposit-manual';
  }
  return 'deposit-manual';
}

export function settleReasonOptions(row: DepositGateRow): string[] {
  const gateway = String(row.paymentGatewayName || '').replace(/\t/g, '');
  const dynamic = gateway ? `manual-deposit-${gateway}` : '';
  const base: string[] = [...SETTLE_REASONS];
  if (dynamic && !base.includes(dynamic)) return [dynamic, ...base];
  return base;
}

export function isUpiGateway(gateway?: string): boolean {
  return UPI_GATEWAYS.has(String(gateway || ''));
}
