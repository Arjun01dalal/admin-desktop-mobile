/**
 * Welcome Balance KPIs — always fetched from API (no local cache layer).
 */
import { secureApi } from '../../api/client';
import { floorNum, pickNum, toNum } from '../../dashboards/mergeMetrics';
import { todayIST } from '../../utils/dates';
import type { MenuStats } from './useMenuStats';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unwrapFor(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  const root = asRecord(raw);
  const candidates: Record<string, unknown>[] = [];
  const visit = (obj: Record<string, unknown>, depth: number) => {
    candidates.push(obj);
    if (depth >= 3) return;
    for (const nestKey of ['payload', 'data', 'result']) {
      const nested = asRecord(obj[nestKey]);
      if (Object.keys(nested).length) visit(nested, depth + 1);
    }
  };
  visit(root, 0);

  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];
    if (keys.some((k) => k in candidate && candidate[k] != null && candidate[k] !== '')) {
      return candidate;
    }
  }
  return root;
}

function readTodayBalance(summaryRaw: unknown, analyticsRaw: unknown): number {
  const fromSummary = pickNum(
    unwrapFor(summaryRaw, ['totalBalanceOfUsers']),
    ['totalBalanceOfUsers'],
  );
  if (fromSummary > 0) return Math.round(fromSummary);

  const fromAnalytics = pickNum(unwrapFor(analyticsRaw, ['totalBalance', 'balance']), [
    'totalBalance',
    'balance',
  ]);
  return Math.round(toNum(fromAnalytics || fromSummary));
}

export async function fetchMenuStats(): Promise<MenuStats> {
  const day = todayIST();
  const base = { startDate: day, endDate: day };

  const [summaryRes, dwRes, balRes] = await Promise.all([
    secureApi('dashboard.summary', base),
    secureApi('profitLoss.depositWithdrawal', base),
    secureApi('analytics.userBalance', { date: day, startDate: day, endDate: day }),
  ]);

  if (!summaryRes.ok && !dwRes.ok && !balRes.ok) {
    throw new Error(
      summaryRes.message || dwRes.message || balRes.message || 'Failed to load balance stats',
    );
  }

  const summary = unwrapFor(summaryRes.ok ? summaryRes.data : {}, [
    'totalBalanceOfUsers',
    'totalDeposit',
    'totalPendingWithdrawal',
    'totalWithdrawal',
    'totalRefund',
  ]);
  const dw = unwrapFor(dwRes.ok ? dwRes.data : {}, [
    'totalDeposit',
    'totalPendingWithdrawal',
    'totalWithdrawal',
    'totalRefund',
  ]);

  return {
    asOfDate: day,
    balance: readTodayBalance(
      summaryRes.ok ? summaryRes.data : {},
      balRes.ok ? balRes.data : {},
    ),
    totalDeposit: floorNum(dw.totalDeposit ?? summary.totalDeposit),
    pendingWithdrawal: floorNum(dw.totalPendingWithdrawal ?? summary.totalPendingWithdrawal),
    totalWithdrawal: floorNum(
      dw.totalRefund ?? dw.totalWithdrawal ?? summary.totalRefund ?? summary.totalWithdrawal,
    ),
  };
}
