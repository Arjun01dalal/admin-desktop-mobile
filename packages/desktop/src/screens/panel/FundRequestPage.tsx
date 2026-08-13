import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { asPaged, display, maskMobile } from '@/screens/panel/shared';
import { CallingBtn } from '@/screens/panel/users/CallingBtn';
import type { UserRow } from '@/screens/panel/users/utils';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import {
  orangeBtnSx,
  fieldSx,
  toolbarBoxSx,
  kpiCardSx,
  DEPOSIT_STATUSES,
  WITHDRAWAL_STATUSES,
  PAGE_SIZE_OPTIONS,
  asFundSummary,
  asFundCoinSummary,
  asBonusWalletSummary,
  bucketLabel,
  withdrawalBucket,
  unpackPayload,
  type FundSummaryBucket,
  type DepositFundSummary,
  type FundRequestCoinSummary,
  type BonusWalletSummary,
} from '@/screens/panel/transactions/shared';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';

type DrillType = 'deposit' | 'withdrawal';

type TxnRow = {
  _id?: string;
  userId?: string;
  dp_id?: string;
  userName?: string;
  userMobile?: string;
  mobile?: string;
  clientName?: string;
  amount?: number | string;
  status?: string;
  userState?: string;
  state?: string;
  userCity?: string;
  city?: string;
  orderId?: string;
  transactionId?: string;
  paymentGatewayName?: string;
  mid?: string | number;
  reason?: string;
  createdOn?: string;
  userBankName?: string;
  bankName?: string;
  accountNumber?: string;
  accountNo?: string;
  ifsc?: string;
  IfscCode?: string;
  withdrewalProviderName?: string;
};

type ColumnFilters = {
  status: string;
  userName: string;
  amount: string;
  clientName: string;
};

const EMPTY_FILTERS: ColumnFilters = { status: '', userName: '', amount: '', clientName: '' };

function dateField(label: string, value: string, onChange: (v: string) => void) {
  return (
    <TextField
      size="small"
      type="date"
      label={label}
      InputLabelProps={{ shrink: true }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ ...fieldSx, width: 180 }}
    />
  );
}

function pickBucket(
  primary: FundSummaryBucket | undefined,
  count?: number,
  totalAmount?: number,
): FundSummaryBucket {
  if (primary && (primary.count != null || primary.totalAmount != null)) return primary;
  return { count: count ?? 0, totalAmount: totalAmount ?? 0 };
}

type KpiTone = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray';

const TONE_COLOR: Record<KpiTone, string> = {
  green: '#66bb6a',
  blue: '#42a5f5',
  yellow: '#ffb74d',
  orange: '#ff9f0a',
  red: '#ef5350',
  gray: '#b0b0b8',
};

function KpiCard({
  label,
  bucket,
  active,
  onClick,
  tone = 'orange',
}: {
  label: string;
  bucket?: FundSummaryBucket;
  active?: boolean;
  onClick?: () => void;
  tone?: KpiTone;
}) {
  const color = TONE_COLOR[tone];
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      className={active ? 'active' : undefined}
      sx={{
        ...kpiCardSx,
        cursor: onClick ? 'pointer' : 'default',
        borderColor: active ? color : 'rgba(255,255,255,0.08)',
        '&:hover': onClick ? { borderColor: color } : undefined,
        '&.active': { borderColor: color },
      }}
    >
      <Typography variant="body2" fontWeight={800} sx={{ color }}>
        {bucketLabel(label, bucket)}
      </Typography>
    </Paper>
  );
}

/** Fund Request overview — KPI drill-down ported from laxminarayan FundRequest.tsx. */
export function FundRequestPage() {
  const navigate = useNavigate();
  const admin = getStoredUser<{ name?: string; _id?: string }>();

  const canViewDeposit =
    hasPermission(Permissions.View_Fund_Deposit) ||
    hasPermission(Permissions.View_Deposits) ||
    hasPermission(Permissions.Fund_Request);
  const canViewWithdrawal =
    hasPermission(Permissions.View_Withdrawals) || hasPermission(Permissions.Fund_Request);
  const canPencil = hasPermission(Permissions.Deposit_Pensil);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const canViewBonusWallet = hasPermission(Permissions.Bonus_Wallet_Fund_Request);
  const canStateWise = hasPermission(Permissions.State_Wise_Deposit);

  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allData, setAllData] = useState(false);
  const [summary, setSummary] = useState<DepositFundSummary>({});
  const [coinSummary, setCoinSummary] = useState<FundRequestCoinSummary>({});
  const [bonusSummary, setBonusSummary] = useState<BonusWalletSummary>({});
  const [holdWithdrawal, setHoldWithdrawal] = useState<FundSummaryBucket>({});
  const [depositWithdrawTotal, setDepositWithdrawTotal] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [drillType, setDrillType] = useState<DrillType | null>(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draftFilters, setDraftFilters] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ColumnFilters>(EMPTY_FILTERS);

  const [rows, setRows] = useState<TxnRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<TxnRow | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadSummary = useCallback(
    async (opts?: { allData?: boolean }) => {
      const useAll = opts?.allData ?? allData;
      setSummaryLoading(true);
      try {
        const datePayload = useAll
          ? {}
          : { startDate: startDate || todayIST(), endDate: endDate || todayIST() };
        const bonusPayload = useAll
          ? { allData: true }
          : {
              startDate: startDate || todayIST(),
              endDate: endDate || todayIST(),
              allData: false,
            };

        const [sumRes, coinRes, holdRes, bonusRes, dwRes] = await Promise.all([
          secureApi('fundRequests.summary', datePayload),
          secureApi('fundRequests.coin', datePayload),
          secureApi('fundRequests.withdrawalHold', datePayload),
          canViewBonusWallet
            ? secureApi('bonusWallet.fundRequestSummary', bonusPayload)
            : Promise.resolve({ ok: true as const, data: {} }),
          secureApi('fundRequests.depositWithdrawal', datePayload),
        ]);

        if (!sumRes.ok) {
          toast.error(sumRes.message || 'Failed to load fund request summary');
          setSummary({});
        } else {
          setSummary(asFundSummary(sumRes.data));
        }

        if (coinRes.ok) setCoinSummary(asFundCoinSummary(coinRes.data));
        else setCoinSummary({});

        if (holdRes.ok) {
          const body = unpackPayload(holdRes.data);
          setHoldWithdrawal({
            count: Number(body.count ?? body.totalCount ?? 0) || 0,
            totalAmount: Number(body.totalAmount ?? 0) || 0,
          });
        } else {
          setHoldWithdrawal({});
        }

        if (bonusRes.ok) setBonusSummary(asBonusWalletSummary(bonusRes.data));
        else setBonusSummary({});

        if (dwRes.ok) {
          const body = unpackPayload(dwRes.data);
          setDepositWithdrawTotal(Number(body.totalDeposit ?? 0) || 0);
        } else {
          setDepositWithdrawTotal(0);
        }

        setAllData(useAll);
      } finally {
        setSummaryLoading(false);
      }
    },
    [allData, startDate, endDate, canViewBonusWallet],
  );

  const loadTransactions = useCallback(async () => {
    if (!drillType) return;
    setTableLoading(true);
    try {
      const filter: Record<string, unknown> = {};
      if (appliedFilters.status) filter.status = appliedFilters.status;
      if (appliedFilters.userName.trim()) filter.userName = appliedFilters.userName.trim();
      if (appliedFilters.amount.trim()) filter.amount = appliedFilters.amount.trim();
      if (appliedFilters.clientName) filter.clientName = appliedFilters.clientName;

      const payload: Record<string, unknown> = {
        type: drillType,
        itemsPerPage,
        pageNo: page,
        filter,
      };
      if (!allData) {
        payload.startDate = startDate || todayIST();
        payload.endDate = endDate || todayIST();
      }

      const res = await secureApi('fundRequests.transactions', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load transactions');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<TxnRow>(res.data);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(paged.totalPages);
    } finally {
      setTableLoading(false);
    }
  }, [drillType, appliedFilters, itemsPerPage, page, allData, startDate, endDate]);

  useEffect(() => {
    void loadSummary({ allData: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (drillType) void loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillType, page, itemsPerPage, appliedFilters, allData]);

  const openDrill = useCallback((type: DrillType, status: string) => {
    const next = { ...EMPTY_FILTERS, status };
    setDrillType(type);
    setDraftFilters(next);
    setAppliedFilters(next);
    setPage(1);
  }, []);

  const applyDateFilter = useCallback(() => {
    void loadSummary({ allData: false });
    if (drillType) void loadTransactions();
  }, [loadSummary, drillType, loadTransactions]);

  const applyAllData = useCallback(() => {
    void loadSummary({ allData: true });
  }, [loadSummary]);

  const refreshAll = useCallback(() => {
    void loadSummary({ allData });
    if (drillType) void loadTransactions();
  }, [loadSummary, allData, drillType, loadTransactions]);

  const commitTableFilters = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
  }, [draftFilters]);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraftFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const downloadExcel = useCallback(() => {
    if (!drillType) {
      toast.warn('Open a summary card first (Deposit/Withdrawal), then Download Excel');
      return;
    }
    if (!rows.length) {
      toast.warn('No data to export!');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fund Requests');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fund_request_${drillType || 'data'}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, drillType]);

  const openEdit = useCallback((row: TxnRow) => {
    setEditRow(row);
    setEditStatus('');
    setEditRemark('');
    setEditOpen(true);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!editRow) return;
    const status = editStatus.trim();
    if (!status) {
      toast.error('Select a status');
      return;
    }
    setEditSaving(true);
    try {
      const res = await secureApi('deposits.updateStatus', {
        orderId: editRow.orderId,
        status,
        reason: editRemark.trim(),
        updatedBy: { name: admin?.name || '', _id: admin?._id || '' },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update status');
        return;
      }
      toast.success(res.message || 'Status updated');
      setEditOpen(false);
      setEditRow(null);
      void loadTransactions();
      void loadSummary();
    } finally {
      setEditSaving(false);
    }
  }, [editRow, editStatus, editRemark, admin, loadTransactions, loadSummary]);

  const toCallingItem = useCallback(
    (row: TxnRow): UserRow => ({
      _id: row._id || row.userId || '',
      name: row.userName,
      userName: row.userName,
      mobile: row.userMobile || row.mobile,
      userMobile: row.userMobile || row.mobile,
      clientName: row.clientName,
      state: row.userState || row.state,
      city: row.userCity || row.city,
    }),
    [],
  );

  const scannerCount = Number(
    summary.coinScannerData?.totalscannerDepositCount ??
      coinSummary.coinData?.totalscannerDepositCount ??
      0,
  );
  const depositApprovedCount =
    Number(summary.depositData?.depositApprovedCount ?? 0) + scannerCount;
  const depositApprovedAmount =
    depositWithdrawTotal ||
    Number(summary.depositData?.depositApprovedTotal ?? 0) ||
    0;

  const depositApproved = pickBucket(
    undefined,
    depositApprovedCount,
    depositApprovedAmount,
  );
  const depositPending = pickBucket(
    summary.depositePendingData,
    summary.depositData?.depositPendingCount,
    summary.depositData?.depositPendingTotal,
  );
  const uniquePending: FundSummaryBucket = {
    count: summary.uniquePendingDetail?.pendingCount ?? 0,
    totalAmount: summary.uniquePendingDetail?.pendingAmount ?? 0,
  };
  const appDeposit: FundSummaryBucket = {
    count: summary.appDeposit?.appuserDepositCount ?? 0,
    totalAmount: Math.round(Number(summary.appDeposit?.appUserDepositSum ?? 0)),
  };
  const newUserDeposit: FundSummaryBucket = {
    count: summary.depositUserDetail?.newUserDepositCount ?? 0,
    totalAmount: Math.round(Number(summary.depositUserDetail?.newUserDepositSum ?? 0)),
  };
  const oldUserDeposit: FundSummaryBucket = {
    count: summary.depositUserDetail?.oldUserDepositCount ?? 0,
    totalAmount: Math.round(Number(summary.depositUserDetail?.oldUserDepositSum ?? 0)),
  };
  const transferMainWallet: FundSummaryBucket = {
    count: bonusSummary.totalCountTransferToMainWallet ?? 0,
    totalAmount: Math.round(Number(bonusSummary.totalAmountTransferToMainWallet ?? 0)),
  };
  const totalBonusWallet: FundSummaryBucket = {
    count: bonusSummary.totalBonusWalletCount ?? 0,
    totalAmount: Math.round(Number(bonusSummary.totalBonusWallet ?? 0)),
  };

  const wApproved = withdrawalBucket(
    summary,
    'totalApprovedCount',
    'totalApprovedAmount',
    summary.totalApprovedWithdrawalData,
  );
  const wTodayApproved = withdrawalBucket(
    summary,
    'todaysTotalApprovedCount',
    'todaysTotalApprovedAmount',
  );
  const wOldApproved = withdrawalBucket(
    summary,
    'previousTotalApprovedCount',
    'previousTotalApprovedAmount',
  );
  const wPending = withdrawalBucket(
    summary,
    'totalPendingCount',
    'totalPendingAmount',
    summary.totalPendingWithdrawalData,
  );
  const wRejected = withdrawalBucket(
    summary,
    'totalRejectedCount',
    'totalRejectedAmount',
    summary.totalWithdrawalRejected,
  );
  const wReverse = withdrawalBucket(
    summary,
    'totalReversedCount',
    'totalReversedAmount',
    summary.totalReverseWithdrawalData,
  );
  const wCanceled = withdrawalBucket(
    summary,
    'totalCanceledCount',
    'totalCanceledAmount',
  );
  const wOnHold: FundSummaryBucket = {
    count: holdWithdrawal.count ?? summary.WithdrawalData?.totalOnholdCount ?? 0,
    totalAmount:
      holdWithdrawal.totalAmount ?? summary.WithdrawalData?.totalOnholdAmount ?? 0,
  };

  const casinoDeposit: FundSummaryBucket = {
    count: coinSummary.coinData?.totalcasinoCreditCount ?? 0,
    totalAmount: coinSummary.coinData?.totalcasinoCredit ?? 0,
  };
  const jetfairDeposit: FundSummaryBucket = {
    count: coinSummary.coinData?.totalexchangeCreditCount ?? 0,
    totalAmount: coinSummary.coinData?.totalexchangeCredit ?? 0,
  };

  const statusOptions = drillType === 'withdrawal' ? WITHDRAWAL_STATUSES : DEPOSIT_STATUSES;

  type KpiItem = {
    key: string;
    label: string;
    bucket: FundSummaryBucket;
    tone: KpiTone;
    onClick?: () => void;
    active?: boolean;
    show?: boolean;
  };

  const kpiItems: KpiItem[] = [
    {
      key: 'dep-approved',
      label: 'Deposit Approved Amt',
      bucket: depositApproved,
      tone: 'green',
      show: canViewDeposit,
      active: drillType === 'deposit' && appliedFilters.status === 'Approved',
      onClick: () => openDrill('deposit', 'Approved'),
    },
    {
      key: 'app-dep',
      label: 'App Deposit Approved Amt',
      bucket: appDeposit,
      tone: 'green',
      show: canViewDeposit,
    },
    {
      key: 'new-user',
      label: 'New User Deposit Approved Amt',
      bucket: newUserDeposit,
      tone: 'green',
      show: canViewDeposit,
    },
    {
      key: 'old-user',
      label: 'Old User Deposit Approved Amt',
      bucket: oldUserDeposit,
      tone: 'green',
      show: canViewDeposit,
    },
    {
      key: 'transfer-main',
      label: 'Amount Transfer to Main Wallet',
      bucket: transferMainWallet,
      tone: 'green',
      show: canViewBonusWallet,
      onClick: () => navigate('/fund-request-bonus-wallet'),
    },
    {
      key: 'w-hold',
      label: 'Withdrawal on Hold Amt',
      bucket: wOnHold,
      tone: 'blue',
      show: canViewWithdrawal,
      active: drillType === 'withdrawal' && appliedFilters.status === 'on hold',
      onClick: () => openDrill('withdrawal', 'on hold'),
    },
    {
      key: 'w-approved',
      label: 'Withdrawal Approved Amt',
      bucket: wApproved,
      tone: 'blue',
      show: canViewWithdrawal,
      active: drillType === 'withdrawal' && appliedFilters.status === 'Approved',
      onClick: () => openDrill('withdrawal', 'Approved'),
    },
    {
      key: 'w-today',
      label: "Todays Total Withdrawal Approved Amt",
      bucket: wTodayApproved,
      tone: 'blue',
      show: canViewWithdrawal,
      onClick: () => openDrill('withdrawal', 'Approved'),
    },
    {
      key: 'w-old',
      label: 'Old Total Withdrawal Approved Amt',
      bucket: wOldApproved,
      tone: 'blue',
      show: canViewWithdrawal,
      onClick: () => openDrill('withdrawal', 'Approved'),
    },
    {
      key: 'unique',
      label: 'Unique Deposit Pending Amt',
      bucket: uniquePending,
      tone: 'yellow',
      show: canViewDeposit,
      onClick: () => navigate('/unique_deposit_pending'),
    },
    {
      key: 'dep-pending',
      label: 'Total Deposit Pending Amt',
      bucket: depositPending,
      tone: 'yellow',
      show: canViewDeposit,
      active: drillType === 'deposit' && appliedFilters.status === 'Pending',
      onClick: () => openDrill('deposit', 'Pending'),
    },
    {
      key: 'w-pending',
      label: 'Withdrawal Pending Amt',
      bucket: wPending,
      tone: 'yellow',
      show: canViewWithdrawal,
      active: drillType === 'withdrawal' && appliedFilters.status === 'Pending',
      onClick: () => openDrill('withdrawal', 'Pending'),
    },
    {
      key: 'bonus',
      label: 'Total Bonus Wallet',
      bucket: totalBonusWallet,
      tone: 'orange',
      show: canViewBonusWallet,
      onClick: () => navigate('/fund-request-bonus-wallet'),
    },
    {
      key: 'w-reverse',
      label: 'Withdrawal Reverse Amt',
      bucket: wReverse,
      tone: 'orange',
      show: canViewWithdrawal,
      active: drillType === 'withdrawal' && appliedFilters.status === 'Reverse',
      onClick: () => openDrill('withdrawal', 'Reverse'),
    },
    {
      key: 'w-rejected',
      label: 'Withdrawal Rejected Amt',
      bucket: wRejected,
      tone: 'red',
      show: canViewWithdrawal,
      active: drillType === 'withdrawal' && appliedFilters.status === 'Rejected',
      onClick: () => openDrill('withdrawal', 'Rejected'),
    },
    {
      key: 'w-cancel',
      label: 'Withdrawal Cancelled Amt',
      bucket: wCanceled,
      tone: 'red',
      show: canViewWithdrawal,
      active: drillType === 'withdrawal' && appliedFilters.status === 'Cancel',
      onClick: () => openDrill('withdrawal', 'Cancel'),
    },
    {
      key: 'casino',
      label: 'Total Casino Deposit',
      bucket: casinoDeposit,
      tone: 'gray',
      show: canViewDeposit,
    },
    {
      key: 'jetfair',
      label: 'Total Jetfair Deposit',
      bucket: jetfairDeposit,
      tone: 'gray',
      show: canViewDeposit,
    },
  ];

  const gatewayMid = (r: TxnRow) => {
    const gw = display(r.paymentGatewayName, '');
    const mid = r.mid != null && r.mid !== '' ? String(r.mid) : '';
    if (!gw && !mid) return '—';
    return mid ? `${gw}-${mid}` : gw;
  };

  const depositColumns = useMemo<CommonTableColumn<TxnRow>[]>(
    () => [
      { id: 'index', label: '#', width: 50, render: (_r, i) => (page - 1) * itemsPerPage + i + 1 },
      { id: 'user', label: 'User', render: (r) => display(r.userName) },
      {
        id: 'mobile', label: 'Mobile', width: 170,
        render: (r) => (
          <CallingBtn item={toCallingItem(r)} campaignName="FUND REQUEST DEPOSIT" reasonList="Fund Request Deposit" />
        ),
      },
      { id: 'app', label: 'App', render: (r) => appCodeForName(r.clientName) },
      { id: 'amount', label: 'Amount', render: (r) => formatAmount(r.amount ?? 0) },
      {
        id: 'status', label: 'Status',
        render: (r) => {
          const pending = String(r.status || '').toLowerCase() === 'pending';
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Typography variant="body2" component="span">{display(r.status)}</Typography>
              {pending && canPencil ? (
                <IconButton size="small" color="warning" onClick={() => openEdit(r)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
          );
        },
      },
      { id: 'state', label: 'State', render: (r) => display(r.userState || r.state) },
      { id: 'city', label: 'City', render: (r) => display(r.userCity || r.city) },
      { id: 'txn', label: 'Txn Id', render: (r) => display(r.orderId || r.transactionId) },
      { id: 'gateway', label: 'Gateway-Mid', render: gatewayMid },
      { id: 'date', label: 'Date', render: (r) => formatDisplayDate(r.createdOn) || '—' },
      { id: 'time', label: 'Time', render: (r) => formatDisplayTime(r.createdOn) || '—' },
      { id: 'reason', label: 'Reason', render: (r) => display(r.reason) },
    ],
    [page, itemsPerPage, canPencil, openEdit, toCallingItem],
  );

  const withdrawalColumns = useMemo<CommonTableColumn<TxnRow>[]>(
    () => [
      { id: 'index', label: '#', width: 50, render: (_r, i) => (page - 1) * itemsPerPage + i + 1 },
      { id: 'user', label: 'User', render: (r) => display(r.userName) },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) => maskMobile(r.userMobile || r.mobile, canShowMobile),
      },
      { id: 'amount', label: 'Amount', render: (r) => formatAmount(r.amount ?? 0) },
      { id: 'status', label: 'Status', render: (r) => display(r.status) },
      { id: 'state', label: 'State', render: (r) => display(r.userState || r.state) },
      { id: 'city', label: 'City', render: (r) => display(r.userCity || r.city) },
      { id: 'bank', label: 'Bank', render: (r) => display(r.userBankName || r.bankName) },
      { id: 'txn', label: 'Txn Id', render: (r) => display(r.orderId || r.transactionId) },
      { id: 'dpId', label: 'DP Id', render: (r) => display(r.userId || r.dp_id) },
      { id: 'account', label: 'Account', render: (r) => display(r.accountNumber || r.accountNo) },
      { id: 'ifsc', label: 'IFSC', render: (r) => display(r.ifsc || r.IfscCode) },
      { id: 'date', label: 'Date', render: (r) => formatDisplayDate(r.createdOn) || '—' },
      { id: 'time', label: 'Time', render: (r) => formatDisplayTime(r.createdOn) || '—' },
      { id: 'provider', label: 'Provider', render: (r) => display(r.withdrewalProviderName) },
    ],
    [page, itemsPerPage, canShowMobile],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Typography variant="h5" fontWeight={700} mb={1.5}>
        Fund Request
      </Typography>

      <Box sx={toolbarBoxSx}>
        <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          {dateField('From Date', startDate, setStartDate)}
          {dateField('To Date', endDate, setEndDate)}
          <Button variant="contained" disabled={summaryLoading} onClick={applyDateFilter} sx={orangeBtnSx}>
            Apply
          </Button>
          <Button variant="contained" disabled={summaryLoading} onClick={applyAllData} sx={orangeBtnSx}>
            All Data
          </Button>
          <Button
            variant="contained"
            startIcon={
              summaryLoading || tableLoading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />
            }
            disabled={summaryLoading}
            onClick={refreshAll}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          {canStateWise ? (
            <Button
              variant="contained"
              onClick={() => navigate('/state-wise-deposit')}
              sx={orangeBtnSx}
            >
              {toDisplayText('State Wise Deposit')}
            </Button>
          ) : null}
          <Button variant="contained" disabled={tableLoading} onClick={downloadExcel} sx={orangeBtnSx}>
            Download Excel
          </Button>
        </Stack>
      </Box>

      {summaryLoading ? (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} sx={{ color: '#ff9f0a' }} />
        </Stack>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 1.5,
            mb: 2,
          }}
        >
          {kpiItems
            .filter((c) => c.show !== false)
            .map((c) => (
              <KpiCard
                key={c.key}
                label={c.label}
                bucket={c.bucket}
                tone={c.tone}
                active={c.active}
                onClick={c.onClick}
              />
            ))}
        </Box>
      )}

      {drillType ? (
        <Box>
          <Box sx={toolbarBoxSx}>
            <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
              <TextField
                select size="small" label="Status" value={draftFilters.status}
                onChange={(e) => setDraftField('status')(e.target.value)}
                sx={{ ...fieldSx, width: 150 }}
              >
                {statusOptions.map((s) => (
                  <MenuItem key={s} value={s}>{s || 'All'}</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small" label="User Name" value={draftFilters.userName}
                onChange={(e) => setDraftField('userName')(e.target.value)}
                sx={{ ...fieldSx, width: 160 }}
              />
              <TextField
                size="small" label="Amount" value={draftFilters.amount}
                onChange={(e) => setDraftField('amount')(e.target.value)}
                sx={{ ...fieldSx, width: 130 }}
              />
              {drillType === 'deposit' ? (
                <TextField
                  select size="small" label="App Code" value={draftFilters.clientName}
                  onChange={(e) => setDraftField('clientName')(e.target.value)}
                  sx={{ ...fieldSx, width: 150 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {CLIENT_NAMES.map((name) => (
                    <MenuItem key={name} value={name}>{appCodeForName(name)}</MenuItem>
                  ))}
                </TextField>
              ) : null}
              <TextField
                select size="small" label="Items / Page" value={String(itemsPerPage)}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value) || DEFAULT_ITEMS_PER_PAGE);
                  setPage(1);
                }}
                sx={{ ...fieldSx, width: 130 }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n}>{n}</MenuItem>
                ))}
              </TextField>
              <Button variant="contained" disabled={tableLoading} onClick={commitTableFilters} sx={orangeBtnSx}>
                Apply
              </Button>
              <Button variant="contained" disabled={tableLoading} onClick={downloadExcel} sx={orangeBtnSx}>
                Download Excel
              </Button>
            </Stack>
          </Box>

          <Typography variant="h6" fontWeight={700} mb={1.5}>
            {toDisplayText(drillType === 'deposit' ? 'Deposit' : 'Withdrawal')}{' '}
            Transactions
          </Typography>

          <CommonTable
            columns={drillType === 'deposit' ? depositColumns : withdrawalColumns}
            rows={rows}
            getRowKey={(row, index) => row._id || row.orderId || index}
            loading={tableLoading}
            emptyMessage="No transactions found"
            stickyHeader
            dense
            virtualize={false}
            minWidth={1800}
            maxHeight="calc(100vh - 340px)"
          />

          <Stack direction="row" alignItems="center" justifyContent="space-between" mt={2}>
            <Typography variant="body2" color="text.secondary">
              Total: {total}
            </Typography>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={tableLoading}
            />
          </Stack>
        </Box>
      ) : null}

      <Dialog
        open={editOpen}
        onClose={() => !editSaving && setEditOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Change Deposit Status</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} mt={1}>
            <TextField
              select fullWidth size="small" label="Status" value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              {DEPOSIT_STATUSES.filter(Boolean).map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth multiline minRows={2} size="small" label="Remark" value={editRemark}
              onChange={(e) => setEditRemark(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={editSaving} onClick={() => void submitEdit()} sx={orangeBtnSx}>
            {editSaving ? '…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
