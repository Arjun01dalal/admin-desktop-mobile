import { useCallback, useMemo ,ReactNode} from 'react';
import type { NavigateFunction } from 'react-router-dom';

import {
  Box,
  Typography,
} from '@mui/material';
import { type CommonTableColumn } from '@/components/CommonTable';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
import { display } from '@/screens/panel/shared';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import {
  DEPOSIT_STATUSES,
} from '@/screens/panel/transactions/shared';
import {
  type DepositRow,
  depositRowBg,
  IndexCell,
  MobileCell,
  PaymentMethodCell,
  TxnDetailsCell,
  LastActivityCell,
  PersonCell,
  SecondaryNameCell,
  UserUpiCell,
} from '@/screens/panel/deposit/DepositCells';
import { canEditDeposit, canShowCheckAction, type ScannerRow } from '@/screens/panel/deposit/logic';

type ColumnFilters = {
  userName: string;
  empCode: string;
  userMobile: string;
  clientName: string;
  amount: string;
  status: string;
  userState: string;
  userCity: string;
  userBankName: string;
  accountNumber: string;
  aadhaarNumber: string;
  orderId: string;
  orderKeyID: string;
  userId: string;
  mid: string;
  upiId: string;
};

export type DepositColumnCtx = {
  page: number;
  itemsPerPage: number;
  compactRows: boolean;
  canUpdateMid: boolean;
  canShowMobile: boolean;
  canWhatsApp: boolean;
  canPencil: boolean;
  checkingId: string;
  selectedSet: Set<string>;
  toggleOrder: (row: DepositRow, checked: boolean) => void;
  searchFilter: (key: keyof ColumnFilters, placeholder: string) => ReactNode;
  selectFilter: (key: keyof ColumnFilters, options: { value: string; label: string }[]) => ReactNode;
  midOptions: { value: string; label: string }[];
  openEdit: (row: DepositRow) => void;
  markChecked: (row: DepositRow, check: 'first' | 'second') => void;
  load: () => void | Promise<void>;
  navigate: NavigateFunction;
  empCodeNameMap: Record<string, string>;
  isLightMode: boolean;
};

export function useDepositColumns(ctx: DepositColumnCtx) {
  const columns = useMemo<CommonTableColumn<DepositRow>[]>(() => {
    const cols: CommonTableColumn<DepositRow>[] = [
      {
        id: 'index',
        label: 'Sr No',
        width: 64,
        stickyLeft: true,
        render: (row, index) => (
          <IndexCell
            index={index}
            page={ctx.page}
            itemsPerPage={ctx.itemsPerPage}
            row={row}
            selectable={ctx.canUpdateMid}
            selected={ctx.selectedSet.has(row.orderId || '')}
            onToggle={ctx.toggleOrder}
            compact={ctx.compactRows}
            canEdit={canEditDeposit(row, ctx.canPencil)}
            onEdit={ctx.openEdit}
          />
        ),
      },
      {
        id: 'userName',
        label: 'User Name',
        width: 140,
        stickyLeft: true,
        filter: ctx.searchFilter('userName', 'User name'),
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              lineHeight: ctx.compactRows ? 1.3 : undefined,
              fontWeight: 600,
              cursor: row.userId ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 140,
            }}
            onClick={() => {
              if (!row.userId) return;
              ctx.navigate(`/users/report/${row.userId}/${encodeURIComponent(row.userName || '')}`);
            }}
          >
            {display(row.userName)}
          </Typography>
        ),
      },
      {
        id: 'paymentMethod',
        label: 'Payment Method',
        width: 180,
        stickyLeft: true,
        cellSx: {
          whiteSpace: 'normal',
          overflow: 'hidden',
          maxWidth: 180,
          verticalAlign: 'middle',
        },
        filter: ctx.selectFilter('mid', ctx.midOptions),
        render: (row) => <PaymentMethodCell row={row} compact={ctx.compactRows} />,
      },
      {
        id: 'mobile',
        label: 'Mobile No',
        width: 150,
        filter: ctx.searchFilter('userMobile', 'Mobile'),
        render: (row) => (
          <MobileCell
            row={row}
            canShowMobile={ctx.canShowMobile}
            canWhatsApp={ctx.canWhatsApp}
            compact={ctx.compactRows}
          />
        ),
      },
      {
        id: 'clientName',
        label: 'App Name',
        width: 90,
        filter: ctx.selectFilter('clientName', [
          { value: '', label: 'All' },
          ...CLIENT_NAMES.map((n) => ({ value: n, label: appCodeForName(n) })),
        ]),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'amount',
        label: 'Amount',
        width: 90,
        filter: ctx.searchFilter('amount', 'Amount'),
        render: (row) => formatAmount(row.amount ?? 0),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        width: 110,
        filter: ctx.searchFilter('empCode', 'Emp code'),
        render: (row) => {
          const code = String(row.empCode || '').trim();
          const empName = code ? ctx.empCodeNameMap[code] : '';
          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                lineHeight: 1.3,
              }}
            >
              <span>{code || '—'}</span>
              {empName ? (
                <Typography
                  component="span"
                  sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 500 }}
                >
                  {empName}
                </Typography>
              ) : null}
            </Box>
          );
        },
      },
      {
        id: 'txnDetails',
        label: 'Txn Details',
        width: 120,
        render: (row) => <TxnDetailsCell row={row} compact={ctx.compactRows} />,
      },
      {
        id: 'status',
        label: 'Status',
        width: 110,
        filter: ctx.selectFilter(
          'status',
          DEPOSIT_STATUSES.map((s) => ({ value: s, label: s || 'All' })),
        ),
        render: (row) => display(row.status),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        width: 110,
        render: (row) => <LastActivityCell row={row} compact={ctx.compactRows} />,
      },
      {
        id: 'checkBy',
        label: 'Check By',
        width: 110,
        render: (row) =>
          canShowCheckAction(row, ctx.canPencil) ? (
            <PersonCell
              person={row.checkBy}
              canCheck={!row.checkBy}
              checking={ctx.checkingId === `${row.orderId}-first`}
              onCheck={() => void ctx.markChecked(row, 'first')}
              compact={ctx.compactRows}
            />
          ) : (
            '—'
          ),
      },
      {
        id: 'crossCheckBy',
        label: 'Cross Checked By',
        width: 120,
        render: (row) =>
          canShowCheckAction(row, ctx.canPencil) ? (
            <PersonCell
              person={row.crossCheckBy}
              canCheck={!row.crossCheckBy}
              checking={ctx.checkingId === `${row.orderId}-second`}
              onCheck={() => void ctx.markChecked(row, 'second')}
              compact={ctx.compactRows}
            />
          ) : (
            '—'
          ),
      },
      {
        id: 'userState',
        label: 'User State',
        width: 120,
        filter: ctx.selectFilter('userState', [
          { value: '', label: 'All' },
          ...INDIA_STATES.map((s) => ({ value: s, label: s })),
        ]),
        render: (row) => display(row.userState || row.state),
      },
      {
        id: 'userCity',
        label: 'User City',
        width: 110,
        filter: ctx.searchFilter('userCity', 'City'),
        render: (row) => display(row.userCity || row.city),
      },
      {
        id: 'bank',
        label: 'User Bank Name',
        width: 140,
        filter: ctx.searchFilter('userBankName', 'Bank'),
        cellSx: { whiteSpace: 'normal', maxWidth: 140 },
        render: (row) => display(row.userBankName),
      },
      {
        id: 'secondaryName',
        label: 'Secondary User Name',
        width: 160,
        cellSx: {
          overflow: 'hidden',
          maxWidth: 160,
          whiteSpace: 'normal',
          verticalAlign: 'middle',
        },
        render: (row) => (
          <SecondaryNameCell row={row} onSaved={() => void ctx.load()} compact={ctx.compactRows} />
        ),
      },
      {
        id: 'account',
        label: 'Account Number',
        width: 130,
        filter: ctx.searchFilter('accountNumber', 'Account no'),
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'ifsc',
        label: 'IFSC',
        width: 100,
        render: (row) => display(row.ifscCode),
      },
      {
        id: 'aadhaar',
        label: 'Aadhar Number',
        width: 120,
        filter: ctx.searchFilter('aadhaarNumber', 'Aadhar'),
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'orderId',
        label: 'Transaction Id',
        width: 140,
        filter: ctx.searchFilter('orderId', 'Transaction id'),
        render: (row) => display(row.orderId),
      },
      {
        id: 'orderKeyID',
        label: 'Client Txnid',
        width: 120,
        filter: ctx.searchFilter('orderKeyID', 'Client txn id'),
        render: (row) => display(row.orderKeyID),
      },
      {
        id: 'userId',
        label: 'DP Id',
        width: 110,
        filter: ctx.searchFilter('userId', 'DP id'),
        render: (row) => display(row.userId),
      },
      {
        id: 'upiId',
        label: 'UPI ID',
        width: 110,
        filter: ctx.searchFilter('upiId', 'UPI ID'),
        render: (row) => display(row.upiId),
      },
      {
        id: 'userUpiId',
        label: 'User UPI ID',
        width: 200,
        cellSx: { whiteSpace: 'normal' },
        render: (row) => <UserUpiCell row={row} compact={ctx.compactRows} />,
      },
      {
        id: 'updatedBy',
        label: 'Update By Name',
        width: 120,
        render: (row) =>
          display(typeof row.updatedBy === 'object' ? row.updatedBy?.name : row.updatedBy),
      },
      {
        id: 'reason',
        label: 'Rejected Reason',
        width: 140,
        cellSx: { whiteSpace: 'normal', maxWidth: 160 },
        render: (row) => display(row.reason),
      },
    ];
    return cols;
  }, [
    ctx.page,
    ctx.itemsPerPage,
    ctx.compactRows,
    ctx.canUpdateMid,
    ctx.canShowMobile,
    ctx.canWhatsApp,
    ctx.canPencil,
    ctx.checkingId,
    ctx.selectedSet,
    ctx.toggleOrder,
    ctx.searchFilter,
    ctx.selectFilter,
    ctx.midOptions,
    ctx.openEdit,
    ctx.markChecked,
    ctx.load,
    ctx.navigate,
    ctx.empCodeNameMap,
  ]);

  const scannerColumns = useMemo<CommonTableColumn<ScannerRow>[]>(
    () => [
      {
        id: 'index',
        label: 'Sr No',
        width: 90,
        render: (_row, index) => index + 1,
      },
      {
        id: 'userName',
        label: 'User Name',
        render: (row) => display(row.userName),
      },
      {
        id: 'mobile',
        label: 'Mobile No',
        render: (row) =>
          ctx.canShowMobile
            ? display(row.userMobile || row.mobile)
            : row.userMobile || row.mobile
              ? '**********'
              : '—',
      },
      {
        id: 'clientName',
        label: 'App Name',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => formatAmount(row.balance ?? 0),
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => display(row.city),
      },
      {
        id: 'givenBy',
        label: 'Given By',
        render: (row) =>
          display(typeof row.updatedBy === 'object' ? row.updatedBy?.name : row.updatedBy),
      },
      {
        id: 'reason',
        label: 'Reason',
        render: (row) => display(row.reason),
      },
      {
        id: 'remark',
        label: 'Remark',
        render: (row) => display(row.remark ?? row.remakr),
      },
      {
        id: 'userId',
        label: 'User Id',
        render: (row) => display(row.userId),
      },
      {
        id: 'utr',
        label: 'UTR',
        render: (row) => display(row.utr),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => formatDisplayDate(row.createdOn) || '—',
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => formatDisplayTime(row.createdOn) || '—',
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) => {
          if (!row.updatedOn) return '—';
          return (
            `${formatDisplayDate(row.updatedOn) || ''} ${formatDisplayTime(row.updatedOn) || ''}`.trim() ||
            '—'
          );
        },
      },
    ],
    [ctx.canShowMobile],
  );

  const getRowSx = useCallback(
    (row: DepositRow) => {
      const status = String(row.status || '').toLowerCase();
      const isPending = status === 'pending' || status === 'processing';
      const isApproved = status === 'approved' || status === 'approved-clr' || status === 'success';
      const bg = depositRowBg(row.status, ctx.isLightMode ? 'light' : 'dark');
      const text = ctx.isLightMode ? '#1a1a1f' : '#e8e8ea';
      const border = ctx.isLightMode
        ? 'rgba(0, 0, 0, 0.12) !important'
        : isApproved
          ? 'rgba(255, 159, 10, 0.40) !important'
          : 'rgba(255, 255, 255, 0.10) !important';
      const pendingTighten = isPending
        ? {
            '& td': {
              py: '2px !important',
              lineHeight: 1.05,
            },
          }
        : undefined;
      if (!bg && !pendingTighten) return undefined;
      if (!bg) return pendingTighten;
      return {
        bgcolor: `${bg} !important`,
        '& td': {
          bgcolor: `${bg} !important`,
          color: `${text} !important`,
          borderColor: border,
          ...(isPending ? { py: '2px !important', lineHeight: 1.05 } : null),
        },
        // Sticky cells set their own !important fill — keep status tint while frozen.
        '& td[data-sticky-left="true"]': {
          bgcolor: `${bg} !important`,
          backgroundColor: `${bg} !important`,
        },
        '& .MuiTypography-root': { color: 'inherit !important' },
        '& .MuiIconButton-root': { color: text },
      };
    },
    [ctx.isLightMode],
  );
  return { columns, scannerColumns, getRowSx };
}
