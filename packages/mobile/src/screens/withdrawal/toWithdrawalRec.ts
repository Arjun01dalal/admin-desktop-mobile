/**
 * Map Active User Withdrawal API rows (and similar shapes) into the Rec shape
 * used by mobile withdrawal actions (lock/approve/check/etc.).
 */
import type { ActiveUserWithdrawalRow } from '@astro/shared';
import type { Rec } from './helpers';

export function toWithdrawalRec(
  row: ActiveUserWithdrawalRow | Rec | Record<string, unknown>,
): Rec {
  const r = row as Record<string, unknown>;
  const orderId = String(r.orderId || r.order_id || r.transactionId || '').trim();
  const id = String(r._id || orderId || '').trim();
  const userName = String(r.userName || r.name || r.accountHolderName || '').trim();
  const accountHolderName = String(r.accountHolderName || r.userName || r.name || '').trim();
  const dpId = String(r.dp_id || r.Dp_ID || r.userId || '').trim();
  const mobile = String(r.mobile || r.userMobile || '').trim();
  const createdOn = String(r.createdOn || r.createdAt || r.created_at || '').trim();
  const accountNo = String(r.accountNo || r.accountNumber || '').trim();

  return {
    ...r,
    _id: id || undefined,
    orderId: orderId || undefined,
    transactionId: String(r.transactionId || orderId || '').trim() || undefined,
    userName: userName || undefined,
    accountHolderName: accountHolderName || undefined,
    name: String(r.name || userName || '').trim() || undefined,
    dp_id: dpId || undefined,
    userId: String(r.userId || dpId || '').trim() || undefined,
    mobile: mobile || undefined,
    userMobile: String(r.userMobile || mobile || '').trim() || undefined,
    createdOn: createdOn || undefined,
    amount: (r.amount ?? r.Amount) as number | string | undefined,
    accountNo: accountNo || undefined,
    clientName: String(r.clientName || r.appName || '').trim() || undefined,
    status: String(r.status || '').trim() || undefined,
  };
}
