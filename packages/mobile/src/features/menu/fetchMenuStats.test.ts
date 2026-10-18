import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/client', () => ({
  secureApi: vi.fn(),
}));

vi.mock('../../utils/dates', () => ({
  todayIST: () => '2026-04-01',
}));

import { secureApi } from '../../api/client';
import { fetchMenuStats } from './fetchMenuStats';

const mockedApi = vi.mocked(secureApi);

describe('fetchMenuStats', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('maps summary + deposit-withdrawal into MenuStats', async () => {
    mockedApi.mockImplementation(async (action: string) => {
      if (action === 'dashboard.summary') {
        return {
          ok: true,
          data: { totalBalanceOfUsers: 1500.9, totalPendingWithdrawal: 10 },
        };
      }
      if (action === 'profitLoss.depositWithdrawal') {
        return {
          ok: true,
          data: { totalDeposit: 200, totalPendingWithdrawal: 11, totalRefund: 30 },
        };
      }
      if (action === 'analytics.userBalance') {
        return { ok: true, data: { totalBalance: 1 } };
      }
      return { ok: false, message: 'unknown' };
    });

    const stats = await fetchMenuStats();
    expect(stats).toEqual({
      asOfDate: '2026-04-01',
      balance: 1501,
      totalDeposit: 200,
      pendingWithdrawal: 11,
      totalWithdrawal: 30,
    });
    expect(mockedApi).toHaveBeenCalledTimes(3);
  });

  it('throws when all endpoints fail', async () => {
    mockedApi.mockResolvedValue({ ok: false, message: 'down' });
    await expect(fetchMenuStats()).rejects.toThrow(/down|Failed to load/);
  });
});
