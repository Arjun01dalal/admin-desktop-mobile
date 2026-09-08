/** Loads the wallet/bonus/exposure tiles shown above the User Report tabs. */
import { useEffect, useState } from 'react';
import { secureApi } from '../../api/client';
import { num, unwrap, type Rec, type Summary } from './helpers';

export function useWalletSummary(userId: string): Summary | null {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const [wallet, bonus, approved, exposure] = await Promise.all([
        secureApi('userReport.walletHistory', {
          itemsPerPage: 1,
          pageNo: 1,
          filter: { userId },
        }),
        secureApi('userReport.bonusTotalEarning', { userId, itemsPerPage: 10, pageNo: 1 }),
        secureApi('userReport.bonusApprovedTotal', { userId }),
        secureApi('userReport.userExposure', { _id: userId }),
      ]);
      if (!live) return;
      const w = unwrap(wallet.ok ? wallet.data : {});
      const b = unwrap(bonus.ok ? bonus.data : {});
      const a = unwrap(approved.ok ? approved.data : {});
      const rawExp = exposure.ok ? exposure.data : 0;
      const exp = typeof rawExp === 'object' ? num((rawExp as Rec).total) : num(rawExp);
      setSummary({
        totalDeposit: num(w.totalDeposit),
        totalWithdrawal: num(w.totalWithdrawal),
        balance: num(w.balance),
        bonusWalletBalance: num(w.bonusWalletBalance),
        pendingWithdrawal: num(w.pendingWithdrawal),
        exposure: exp,
        referralEarning: num(b.userReferral),
        referralCount: num(b.userReferralCount),
        ownEarning: num(b.userOwnEarning),
        ownEarningCount: num(b.userOwnEarningCount),
        approvedBonus: num(a.totalAmount),
        approvedBonusCount: num(a.count),
        approvedBonusItems: Array.isArray(a.items) ? (a.items as Rec[]) : [],
      });
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  return summary;
}
