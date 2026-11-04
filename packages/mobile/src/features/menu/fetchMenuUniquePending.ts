/**
 * Menu Unique Pending counts — today via amount-summary + amount-all-summary.
 */
import {
  assembleUniquePendingSummary,
  buildUniquePendingSummaryPayload,
} from '@astro/shared';
import { secureApi } from '../../api/client';
import { todayIST } from '../../utils/dates';

export type MenuUniquePendingStats = {
  asOfDate: string;
  /** All / Total unique request count + amount */
  total: number;
  totalAmount: number;
  pending: number;
  pendingAmount: number;
  approved: number;
  approvedAmount: number;
};

export async function fetchMenuUniquePending(): Promise<MenuUniquePendingStats> {
  const day = todayIST();
  const payload = buildUniquePendingSummaryPayload(day, day, {}, day);

  const [pendingRes, allRes] = await Promise.all([
    secureApi('uniquePending.amountSummary', payload),
    secureApi('uniquePending.amountAllSummary', payload),
  ]);

  if (!pendingRes.ok) {
    throw new Error(pendingRes.message || 'Failed to load unique pending summary');
  }
  if (!allRes.ok) {
    throw new Error(allRes.message || 'Failed to load unique pending summary');
  }

  const summary = assembleUniquePendingSummary({
    pendingData: pendingRes.data,
    allData: allRes.data,
  });

  return {
    asOfDate: day,
    total: summary.all.uniqueRequestCount,
    totalAmount: summary.all.totalAmount,
    pending: summary.pending.uniqueRequestCount,
    pendingAmount: summary.pending.totalAmount,
    approved: summary.approved.uniqueRequestCount,
    approvedAmount: summary.approved.totalAmount,
  };
}
