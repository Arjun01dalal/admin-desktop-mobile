import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Pagination,
  Typography,
} from '@mui/material';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import {
  asPaged,
  display,
  maskMobile,
  useReportQuery,
} from '@/screens/panel/shared';
import {
  formatDisplayTime,
  formatLocalDate,
  todayIST,
} from '@/utils/dates';
import type { SecureAction } from '@/api/secureActions';

type FundType = 'pending' | 'approved' | 'totalData';

type LocationState = {
  type?: FundType;
  startDate?: string;
  endDate?: string;
  allData?: boolean;
};

type FundRow = {
  _id: string;
  name?: string;
  mobile?: string;
  bonusWalletOpenBalance?: number | string;
  amount?: number | string;
  bonusWalletClosingBalance?: number | string;
  referredByName?: string;
  referredByMobile?: string;
  referredToName?: string;
  referredToMobile?: string;
  firstDepositPercentage?: number | string;
  referralPercentage?: number | string;
  status?: string;
  createdOn?: string | number;
  updatedOn?: string | number;
  createdAt?: string | number;
  updatedAt?: string | number;
};

const ITEMS_PER_PAGE = 50;

const ACTION_BY_TYPE: Record<FundType, SecureAction> = {
  pending: 'bonusWallet.fundPending',
  approved: 'bonusWallet.fundApproved',
  totalData: 'bonusWallet.fundTransferIn',
};

const TITLE_BY_TYPE: Record<FundType, string> = {
  pending: 'Pending',
  approved: 'Approved',
  totalData: 'Total Data',
};

/** Match laxminarayan: `${formatDate(x)} , ${formatedTime(x)}` */
function formatDateTime(value?: string | number): string {
  if (value == null || value === '') return '—';
  const d = formatLocalDate(value);
  const t = formatDisplayTime(value);
  if (!d && !t) return '—';
  if (!t) return d || '—';
  return `${d} , ${t}`;
}

function rowCreatedOn(row: FundRow): string | number | undefined {
  return row.createdOn ?? row.createdAt;
}

function rowUpdatedOn(row: FundRow): string | number | undefined {
  return row.updatedOn ?? row.updatedAt;
}

function unpackDocuments(res: { data?: unknown }) {
  const data = res.data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
        ? (obj.payload as Record<string, unknown>)
        : obj;
    if (Array.isArray(nested.documents)) {
      return {
        rows: nested.documents as FundRow[],
        totalPages: Number(nested.totalPages ?? 1) || 1,
        total: Number(nested.total ?? nested.documents.length) || 0,
      };
    }
  }
  return asPaged<FundRow>(data);
}

export function BonusWalletFundRequestTablePage() {
  const location = useLocation();
  const navState = (location.state || {}) as LocationState;
  const type: FundType =
    navState.type === 'pending' ||
    navState.type === 'approved' ||
    navState.type === 'totalData'
      ? navState.type
      : 'pending';

  const canShowMobile = hasPermission(Permissions.show_mobile);
  const [page, setPage] = useState(1);
  const [draftName, setDraftName] = useState('');
  const [draftMobile, setDraftMobile] = useState('');
  const [filters, setFilters] = useState({ name: '', mobile: '' });

  const action = ACTION_BY_TYPE[type];

  const buildPayload = useCallback(() => {
    const today = todayIST();
    const start = navState.startDate || today;
    const end = navState.endDate || today;
    const filter: Record<string, string> = {};
    if (filters.name.trim()) filter.name = filters.name.trim();
    if (filters.mobile.trim()) filter.mobile = filters.mobile.trim();

    if (navState.allData) {
      return {
        allData: true,
        itemsPerPage: ITEMS_PER_PAGE,
        pageNo: page,
        filter,
      };
    }

    return {
      startDate: start,
      endDate: end,
      allData: false,
      itemsPerPage: ITEMS_PER_PAGE,
      pageNo: page,
      filter,
    };
  }, [navState.startDate, navState.endDate, navState.allData, page, filters]);

  const unpack = useCallback(
    (res: { data?: unknown }) => unpackDocuments(res),
    [],
  );

  const { rows, totalPages, loading } = useReportQuery<FundRow>({
    action,
    buildPayload,
    unpack,
    autoDeps: [page, filters, type, navState.startDate, navState.endDate, navState.allData],
    errorMessage: 'Failed to load bonus wallet fund requests',
    cacheTtlMs: 0,
  });

  const applySearch = useCallback(() => {
    setFilters({ name: draftName, mobile: draftMobile });
    setPage(1);
  }, [draftName, draftMobile]);

  const columns = useMemo<CommonTableColumn<FundRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 64,
        render: (_row, index) => (page - 1) * ITEMS_PER_PAGE + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <TableSearchBar
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onSearch={applySearch}
            placeholder="Name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <TableSearchBar
            value={draftMobile}
            onChange={(e) => setDraftMobile(e.target.value)}
            onSearch={applySearch}
            placeholder="Mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'openBal',
        label: 'Opening Balance',
        render: (row) => display(row.bonusWalletOpenBalance),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row) => display(row.amount),
      },
      {
        id: 'closeBal',
        label: 'Closing Balance',
        render: (row) => display(row.bonusWalletClosingBalance),
      },
      {
        id: 'refByName',
        label: 'Referred By Name',
        render: (row) => display(row.referredByName),
      },
      {
        id: 'refByMobile',
        label: 'Referred By Mobile',
        render: (row) => maskMobile(row.referredByMobile, canShowMobile),
      },
      {
        id: 'refToName',
        label: 'Referred To Name',
        render: (row) => display(row.referredToName),
      },
      {
        id: 'refToMobile',
        label: 'Referred To Mobile',
        render: (row) => maskMobile(row.referredToMobile, canShowMobile),
      },
      {
        id: 'firstDeposit',
        label: 'First Deposit %',
        render: (row) =>
          row.firstDepositPercentage !== undefined && row.firstDepositPercentage !== ''
            ? `${row.firstDepositPercentage}%`
            : '—',
      },
      {
        id: 'referral',
        label: 'Referral %',
        render: (row) =>
          row.referralPercentage !== undefined && row.referralPercentage !== ''
            ? `${row.referralPercentage}%`
            : '—',
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => display(row.status),
      },
      {
        id: 'created',
        label: 'Created',
        render: (row) => formatDateTime(rowCreatedOn(row)),
      },
      {
        id: 'updated',
        label: 'Updated',
        render: (row) => formatDateTime(rowUpdatedOn(row)),
      },
    ],
    [page, draftName, draftMobile, applySearch, canShowMobile],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Typography variant="h6" fontWeight={700} mb={1.5}>
        Bonus Wallet Table — {TITLE_BY_TYPE[type]}
      </Typography>

      <TablePanel
        footer={
          totalPages > 1 ? (
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              color="secondary"
              onChange={(_e, next) => setPage(next)}
            />
          ) : undefined
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          getRowKey={(row, index) => row._id || index}
          emptyMessage="No records found"
          stickyHeader
          dense
          minWidth={1400}
          virtualize={false}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
