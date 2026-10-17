/**
 * Menu hub stats for today (IST) —
 * Balance / Total Deposits / Pending Withdrawal / Total Withdrawal.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { secureApi } from '../api/client';
import { floorNum, pickNum, toNum } from '../dashboards/mergeMetrics';
import { todayIST } from '../utils/dates';

export type MenuStats = {
  /** Today's user balance (IST date). */
  balance: number;
  totalDeposit: number;
  pendingWithdrawal: number;
  totalWithdrawal: number;
  /** YYYY-MM-DD IST used for the fetch. */
  asOfDate: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Prefer the deepest payload/data layer that contains any of `keys`. */
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

  // Deepest match first so envelope wrappers don't win over the dated payload.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const candidate = candidates[i];
    if (keys.some((k) => k in candidate && candidate[k] != null && candidate[k] !== '')) {
      return candidate;
    }
  }
  return root;
}

function readTodayBalance(summaryRaw: unknown, analyticsRaw: unknown): number {
  // Same source as Dashboard KPI "Total Users Balance" when date = today.
  const fromSummary = pickNum(
    unwrapFor(summaryRaw, ['totalBalanceOfUsers']),
    ['totalBalanceOfUsers'],
  );
  if (fromSummary > 0) return Math.round(fromSummary);

  // Fallback: dated balance API (Analytics / historical KPI shape).
  const fromAnalytics = pickNum(unwrapFor(analyticsRaw, ['totalBalance', 'balance']), [
    'totalBalance',
    'balance',
  ]);
  return Math.round(toNum(fromAnalytics || fromSummary));
}

export function useMenuStats(enabled = true): {
  stats: MenuStats | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [stats, setStats] = useState<MenuStats | null>(null);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    if (!enabled) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const day = todayIST();
    const base = { startDate: day, endDate: day };

    const [summaryRes, dwRes, balRes] = await Promise.all([
      secureApi('dashboard.summary', base),
      secureApi('profitLoss.depositWithdrawal', base),
      // Explicit today balance — `/change-percentage/get-user-balance`
      secureApi('analytics.userBalance', { date: day, startDate: day, endDate: day }),
    ]);

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

    setStats({
      asOfDate: day,
      balance: readTodayBalance(
        summaryRes.ok ? summaryRes.data : {},
        balRes.ok ? balRes.data : {},
      ),
      // Same as Dashboard KPI "Total Deposits" for today's range.
      totalDeposit: floorNum(dw.totalDeposit ?? summary.totalDeposit),
      // Pending is current open amount; still read from today's deposit-withdrawal payload.
      pendingWithdrawal: floorNum(dw.totalPendingWithdrawal ?? summary.totalPendingWithdrawal),
      // Settled withdrawals for today's date range only.
      totalWithdrawal: floorNum(
        dw.totalRefund ?? dw.totalWithdrawal ?? summary.totalRefund ?? summary.totalWithdrawal,
      ),
    });
    setLoading(false);
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { stats, loading, refresh: load };
}
