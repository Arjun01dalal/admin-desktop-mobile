import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/client', () => ({
  secureApi: vi.fn(),
}));

vi.mock('../../utils/dates', () => ({
  todayIST: () => '2026-04-01',
}));

import { secureApi } from '../../api/client';
import { fetchMenuUniquePending } from './fetchMenuUniquePending';

const mockedApi = vi.mocked(secureApi);

describe('fetchMenuUniquePending', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('maps amount-summary + amount-all-summary into counts', async () => {
    mockedApi.mockImplementation(async (action: string) => {
      if (action === 'uniquePending.amountSummary') {
        return {
          ok: true,
          data: {
            uniqueRequestCount: 4,
            totalAmount: 400,
            uniqueCustomerCount: 3,
            list: [],
          },
        };
      }
      if (action === 'uniquePending.amountAllSummary') {
        return {
          ok: true,
          data: {
            uniqueRequestCount: 10,
            totalAmount: 1000,
            uniqueCustomerCount: 8,
            list: [],
          },
        };
      }
      return { ok: false, message: 'unknown' };
    });

    const stats = await fetchMenuUniquePending();
    expect(stats).toEqual({
      asOfDate: '2026-04-01',
      total: 10,
      totalAmount: 1000,
      pending: 4,
      pendingAmount: 400,
      approved: 6,
      approvedAmount: 600,
    });
    expect(mockedApi).toHaveBeenCalledWith(
      'uniquePending.amountSummary',
      expect.objectContaining({ startDate: '2026-04-01', endDate: '2026-04-01' }),
    );
    expect(mockedApi).toHaveBeenCalledWith(
      'uniquePending.amountAllSummary',
      expect.objectContaining({ startDate: '2026-04-01', endDate: '2026-04-01' }),
    );
  });

  it('throws when a summary endpoint fails', async () => {
    mockedApi.mockImplementation(async (action: string) => {
      if (action === 'uniquePending.amountSummary') {
        return { ok: false, message: 'pending down' };
      }
      return {
        ok: true,
        data: { uniqueRequestCount: 1, totalAmount: 1, uniqueCustomerCount: 1 },
      };
    });
    await expect(fetchMenuUniquePending()).rejects.toThrow(/pending down/);
  });
});
