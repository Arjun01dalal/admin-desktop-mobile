import { describe, expect, it } from 'vitest';
import { balanceNavTarget } from './balanceNav';

const allOn = {
  asOfDate: '2026-04-01',
  canOpenUsersBalance: true,
  canSeeDashboard: true,
  canOpenWithdrawal: true,
};

describe('balanceNavTarget', () => {
  it('maps Total Users Balance → Users Balance panel', () => {
    expect(balanceNavTarget('balance', allOn)).toEqual({
      type: 'panel',
      href: '/balance-f',
    });
  });

  it('maps Total (Deposits) → Dashboard', () => {
    expect(balanceNavTarget('deposit', allOn)).toEqual({
      type: 'stack',
      name: 'dashboard',
    });
  });

  it('maps Pending Refund → Withdrawal Pending', () => {
    expect(balanceNavTarget('pending', allOn)).toEqual({
      type: 'stack',
      name: 'withdrawal',
      params: {
        status: 'Pending',
        startDate: '2026-04-01',
        endDate: '2026-04-01',
      },
    });
  });

  it('maps Total Refund → Withdrawal', () => {
    expect(balanceNavTarget('total', allOn)).toEqual({
      type: 'stack',
      name: 'withdrawal',
    });
  });

  it('returns none when permission missing', () => {
    expect(
      balanceNavTarget('total', { ...allOn, canOpenWithdrawal: false }),
    ).toEqual({ type: 'none' });
  });
});
