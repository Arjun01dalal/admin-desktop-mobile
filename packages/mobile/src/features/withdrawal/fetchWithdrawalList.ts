/**
 * Withdrawal / refund transactions — network fetch for useWithdrawalScreen.
 */
import { secureApi } from '../../api/client';
import {
  listOf,
  pagesOf,
  totalUsersOf,
  type Rec,
} from './helpers';

export type WithdrawalListParams = {
  page: number;
  pageSize: number;
  status: string;
  applied: { field: string; text: string };
  startDate: string;
  endDate: string;
  allData: boolean;
  sortChecked: boolean;
  redFlagOnly: boolean;
  uniqueOnly: boolean;
  bankAmt: string;
  midFilter: string;
  selectedBeneficiaryAccounts: string[];
  showAll: boolean;
  adminName?: string;
  app?: string | string[];
};

export type WithdrawalListResult = {
  rows: Rec[];
  totalPages: number;
  totalUsers: number;
};

export async function fetchWithdrawalList(
  params: WithdrawalListParams,
): Promise<WithdrawalListResult> {
  const filter: Rec = {};
  if (params.uniqueOnly) {
    filter.status = 'Pending';
    filter.isUnique = true;
  } else if (params.selectedBeneficiaryAccounts.length > 0) {
    filter.beneficiaryAccounts = params.selectedBeneficiaryAccounts;
    filter.status = 'Pending';
  } else if (params.status) {
    filter.status = params.status;
  }
  const effectiveStatus = params.uniqueOnly
    ? 'Pending'
    : params.selectedBeneficiaryAccounts.length > 0
      ? 'Pending'
      : params.status;
  if (effectiveStatus === 'IN PROGRESS' && !params.showAll && params.adminName) {
    filter.name = params.adminName;
  }
  if (params.applied.text.trim()) filter[params.applied.field] = params.applied.text.trim();
  if (params.sortChecked) filter.sort = true;
  if (params.redFlagOnly) filter.redFlag = true;
  if (params.bankAmt.trim()) filter.bankAmt = params.bankAmt.trim();
  if (params.midFilter) filter.mid = params.midFilter;

  const payload: Rec = {
    type: 'withdrawal',
    itemsPerPage: params.pageSize,
    pageNo: params.page,
    filter,
  };
  if (!params.allData) {
    payload.startDate = params.startDate;
    payload.endDate = params.endDate;
  }
  if (params.app) payload.app = params.app;

  const res = await secureApi('withdrawals.transactions', payload);
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load refunds');
  }
  return {
    rows: listOf(res.data),
    totalPages: pagesOf(res.data),
    totalUsers: totalUsersOf(res.data),
  };
}

export async function fetchWithdrawalSummary(params: {
  allData: boolean;
  startDate: string;
  endDate: string;
}): Promise<unknown> {
  const payload: Rec = {};
  if (!params.allData) {
    payload.startDate = params.startDate;
    payload.endDate = params.endDate;
  }
  const res = await secureApi('withdrawals.fundRequest', payload);
  if (!res.ok) {
    throw new Error(res.message || 'Failed to load refund summary');
  }
  return res.data;
}
