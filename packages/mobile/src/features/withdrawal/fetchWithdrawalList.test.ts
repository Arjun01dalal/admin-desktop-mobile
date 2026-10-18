import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/client', () => ({
  secureApi: vi.fn(),
}));

vi.mock('./helpers', () => ({
  listOf: (data: unknown) => {
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return (rec.data as unknown[]) || [];
  },
  pagesOf: (data: unknown) => {
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return Number(rec.totalPages || 1) || 1;
  },
  totalUsersOf: (data: unknown) => {
    const rec = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return Number(rec.totalUsers || 0) || 0;
  },
}));

import { secureApi } from '../../api/client';
import { fetchWithdrawalList } from './fetchWithdrawalList';

const mockedApi = vi.mocked(secureApi);

const baseParams = {
  page: 1,
  pageSize: 25,
  status: 'Pending',
  applied: { field: 'userName', text: '' },
  startDate: '2026-04-01',
  endDate: '2026-04-01',
  allData: false,
  sortChecked: false,
  redFlagOnly: false,
  bankAmt: '',
  midFilter: '',
  selectedBeneficiaryAccounts: [] as string[],
  showAll: true,
};

describe('fetchWithdrawalList', () => {
  beforeEach(() => {
    mockedApi.mockReset();
  });

  it('returns rows from API payload', async () => {
    mockedApi.mockResolvedValue({
      ok: true,
      data: {
        data: [{ _id: '1', status: 'Pending' }],
        totalPages: 2,
        totalUsers: 40,
      },
    });

    const result = await fetchWithdrawalList(baseParams);
    expect(result).toEqual({
      rows: [{ _id: '1', status: 'Pending' }],
      totalPages: 2,
      totalUsers: 40,
    });
    expect(mockedApi).toHaveBeenCalledWith(
      'withdrawals.transactions',
      expect.objectContaining({
        type: 'withdrawal',
        pageNo: 1,
        itemsPerPage: 25,
        startDate: '2026-04-01',
      }),
    );
  });

  it('throws on API failure', async () => {
    mockedApi.mockResolvedValue({ ok: false, message: 'Denied' });
    await expect(fetchWithdrawalList(baseParams)).rejects.toThrow('Denied');
  });
});
