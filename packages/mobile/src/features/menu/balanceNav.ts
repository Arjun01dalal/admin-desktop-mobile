/**
 * Welcome Balance tile → navigation targets (pure; unit-tested).
 */
export type BalanceStatKey = 'balance' | 'deposit' | 'pending' | 'total';

export type BalanceNavTarget =
  | { type: 'panel'; href: '/balance-f' }
  | { type: 'stack'; name: 'dashboard' }
  | { type: 'stack'; name: 'withdrawal'; params?: { status?: string; startDate?: string; endDate?: string } }
  | { type: 'none' };

/** Map a Balance KPI tile to a navigation target. */
export function balanceNavTarget(
  key: BalanceStatKey,
  opts: { asOfDate?: string; canOpenUsersBalance: boolean; canSeeDashboard: boolean; canOpenWithdrawal: boolean },
): BalanceNavTarget {
  if (key === 'balance') {
    return opts.canOpenUsersBalance ? { type: 'panel', href: '/balance-f' } : { type: 'none' };
  }
  if (key === 'deposit') {
    return opts.canSeeDashboard ? { type: 'stack', name: 'dashboard' } : { type: 'none' };
  }
  if (key === 'pending') {
    if (!opts.canOpenWithdrawal) return { type: 'none' };
    return {
      type: 'stack',
      name: 'withdrawal',
      params: {
        status: 'Pending',
        startDate: opts.asOfDate,
        endDate: opts.asOfDate,
      },
    };
  }
  if (key === 'total') {
    return opts.canOpenWithdrawal ? { type: 'stack', name: 'withdrawal' } : { type: 'none' };
  }
  return { type: 'none' };
}
