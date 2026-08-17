import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { asList, asPaged, display, useReportQuery } from '@/screens/panel/shared';
import { INDIA_STATES } from '@/screens/panel/users/constants';
import {
  orangeBtnSx,
  chipSx,
  fieldSx,
  filterSelectSx,
  toolbarBoxSx,
  DEPOSIT_STATUSES,
  PAGE_SIZE_OPTIONS,
  type MidOption,
  asFundSummary,
  unpackPayload,
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
import { SettleDialog } from '@/screens/panel/deposit/SettleDialog';
import {
  canEditDeposit,
  canShowCheckAction,
  type ScannerRow,
} from '@/screens/panel/deposit/logic';

type RequestType = 'automatic' | 'scannerDeposit';

type ColumnFilters = {
  userName: string;
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

type QueryState = {
  startDate: string;
  endDate: string;
  allData: boolean;
  filters: ColumnFilters;
};

type SelectedOrder = { orderId: string; paymentGatewayName: string };

const secondaryBtnSx = {
  ...orangeBtnSx,
  bgcolor: 'transparent',
  color: '#ff9f0a',
  borderColor: 'rgba(255,159,10,0.65)',
  '&:hover': {
    bgcolor: 'rgba(255,159,10,0.08)',
    borderColor: '#ff9f0a',
  },
};

const statusChipSx = (color: string, background: string) => ({
  ...chipSx,
  color,
  bgcolor: background,
  border: '1px solid',
  borderColor: `${color}40`,
  '& .MuiChip-label': { px: 1.25 },
});

const EMPTY_FILTERS: ColumnFilters = {
  userName: '',
  userMobile: '',
  clientName: '',
  amount: '',
  status: '',
  userState: '',
  userCity: '',
  userBankName: '',
  accountNumber: '',
  aadhaarNumber: '',
  orderId: '',
  orderKeyID: '',
  userId: '',
  mid: '',
  upiId: '',
};

export function DepositPage() {
  const navigate = useNavigate();
  const isLightMode = useTheme().palette.mode === 'light';
  const admin = getStoredUser<{ _id?: string; name?: string }>();
  const canPencil = hasPermission('Deposit_Pensil');
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canShowMobile = hasPermission('show_mobile');
  const canStateWise = hasPermission('State_Wise_Deposit');
  const canUpdateMid = hasPermission('update_deposit_mid');
  const today = todayIST();

  const [page, setPage] = useState(1);
  /** Default 20 so one screen shows ~15–20 deposit rows. */
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: today,
    endDate: today,
    allData: false,
    filters: EMPTY_FILTERS,
  });
  const [requestType, setRequestType] = useState<RequestType>('automatic');
  const [mids, setMids] = useState<MidOption[]>([]);
  const [gateways, setGateways] = useState<string[]>([]);
  const [summary, setSummary] = useState<ReturnType<typeof asFundSummary>>({});
  const [scannerTotal, setScannerTotal] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<SelectedOrder[]>([]);
  const [midModalOpen, setMidModalOpen] = useState(false);
  const [midValue, setMidValue] = useState('');
  const [gatewayValue, setGatewayValue] = useState('');
  /** Collapsed by default so the deposit table gets more vertical space. */
  const [toolbarOpen, setToolbarOpen] = useState(false);
  /** Compact rows fit ~20-25 deposits on screen without scrolling. */
  const [compactRows, setCompactRows] = useState(true);
  const [midSaving, setMidSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editRow, setEditRow] = useState<DepositRow | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleRow, setSettleRow] = useState<DepositRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [checkingId, setCheckingId] = useState('');
  const [scannerRows, setScannerRows] = useState<ScannerRow[]>([]);
  const [scannerLoading, setScannerLoading] = useState(false);

  const isScanner = requestType === 'scannerDeposit';

  const buildPayload = useCallback(() => {
    const f = query.filters;
    const filter: Record<string, unknown> = {};
    if (f.status) filter.status = f.status;
    if (f.userName.trim()) filter.userName = f.userName.trim();
    if (f.userId.trim()) filter.userId = f.userId.trim();
    if (f.clientName) filter.clientName = f.clientName;
    if (f.amount.trim()) {
      const n = Number(f.amount.trim());
      filter.amount = Number.isFinite(n) ? n : f.amount.trim();
    }
    if (f.userState) filter.userState = f.userState;
    if (f.userCity.trim()) filter.userCity = f.userCity.trim();
    if (f.orderId.trim()) filter.orderId = f.orderId.trim();
    if (f.orderKeyID.trim()) filter.orderKeyID = f.orderKeyID.trim();
    if (f.userMobile.trim()) filter.userMobile = f.userMobile.trim();
    if (f.userBankName.trim()) filter.userBankName = f.userBankName.trim();
    if (f.accountNumber.trim()) filter.accountNumber = f.accountNumber.trim();
    if (f.aadhaarNumber.trim()) filter.aadhaarNumber = f.aadhaarNumber.trim();
    if (f.upiId.trim()) filter.upiId = f.upiId.trim();
    if (f.mid) filter.mid = f.mid;

    const payload: Record<string, unknown> = {
      type: 'deposit',
      itemsPerPage,
      pageNo: page,
      filter,
    };
    if (!query.allData) {
      if (query.startDate) payload.startDate = query.startDate;
      if (query.endDate) payload.endDate = query.endDate;
    }
    return payload;
  }, [query, page, itemsPerPage]);

  const { rows, total, totalPages, loading, load } = useReportQuery<DepositRow>({
    action: 'deposits.transactions',
    buildPayload,
    unpack: useCallback((res: { data?: unknown }) => asPaged<DepositRow>(res.data), []),
    autoDeps: isScanner ? [requestType] : [page, itemsPerPage, query],
    errorMessage: 'Failed to load deposits',
    cacheTtlMs: 0,
  });

  const loadMids = useCallback(async () => {
    const [midRes, gwRes] = await Promise.all([
      secureApi('deposits.mids', {}),
      secureApi('deposits.gateways', {}),
    ]);
    if (midRes.ok) {
      const body = unpackPayload(midRes.data);
      const list = Array.isArray(midRes.data)
        ? (midRes.data as MidOption[])
        : Array.isArray(body.items)
          ? (body.items as MidOption[])
          : asList<MidOption>(midRes.data);
      const cleaned = list.filter((m) => m && m.mid != null && m.mid !== '');
      setMids(cleaned);
      const fromMids = cleaned
        .map((m) => m.paymentGatewayName || m.name || '')
        .filter(Boolean);
      if (gwRes.ok) {
        const gwList = asList<{ name?: string; paymentGatewayName?: string }>(gwRes.data);
        const names = gwList
          .map((g) => g.name || g.paymentGatewayName || '')
          .filter(Boolean);
        setGateways(Array.from(new Set([...names, ...fromMids])));
      } else {
        setGateways(Array.from(new Set(fromMids)));
      }
      return;
    }
    if (gwRes.ok) {
      const gwList = asList<{ name?: string; paymentGatewayName?: string }>(gwRes.data);
      setGateways(
        gwList.map((g) => g.name || g.paymentGatewayName || '').filter(Boolean),
      );
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (!query.allData) {
        payload.startDate = query.startDate || todayIST();
        payload.endDate = query.endDate || todayIST();
      }
      const res = await secureApi('deposits.fundRequest', payload);
      if (res.ok) setSummary(asFundSummary(res.data));

      const scanRes = await secureApi('deposits.scannerData', {
        ...(payload.startDate ? { startDate: payload.startDate } : {}),
        ...(payload.endDate ? { endDate: payload.endDate } : {}),
      });
      if (scanRes.ok) {
        const body = unpackPayload(scanRes.data);
        const coinTotal = Array.isArray(body.CoinTotalDeposit)
          ? (body.CoinTotalDeposit[0] as { totalAmount?: number })
          : null;
        setScannerTotal(Number(coinTotal?.totalAmount ?? body.totalAmount ?? 0) || 0);
      }
    } finally {
      setSummaryLoading(false);
    }
  }, [query.allData, query.startDate, query.endDate]);

  useEffect(() => {
    void loadMids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const loadScannerRows = useCallback(async () => {
    if (!isScanner) return;
    setScannerLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (!query.allData) {
        if (query.startDate) payload.startDate = query.startDate;
        if (query.endDate) payload.endDate = query.endDate;
      } else {
        const t = todayIST();
        payload.startDate = t;
        payload.endDate = t;
      }
      if (query.filters.clientName) payload.clientName = query.filters.clientName;
      if (query.filters.mid) payload.mid = query.filters.mid;

      const res = await secureApi('deposits.scannerData', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load scanner data');
        setScannerRows([]);
        return;
      }
      const body = unpackPayload(res.data);
      const coinData =
        body.coinData && typeof body.coinData === 'object'
          ? (body.coinData as Record<string, unknown>)
          : body;
      const items = Array.isArray(coinData.items)
        ? (coinData.items as ScannerRow[])
        : asList<ScannerRow>(res.data);
      setScannerRows(items);
      const coinTotal = Array.isArray(body.CoinTotalDeposit)
        ? (body.CoinTotalDeposit[0] as { totalAmount?: number })
        : null;
      setScannerTotal(Number(coinTotal?.totalAmount ?? 0) || 0);
    } finally {
      setScannerLoading(false);
    }
  }, [isScanner, query]);

  useEffect(() => {
    if (isScanner) void loadScannerRows();
  }, [isScanner, loadScannerRows]);

  const commitQuery = useCallback(
    (opts?: { allData?: boolean; filters?: ColumnFilters }) => {
      const nextAllData = opts?.allData ?? false;
      setQuery({
        startDate: nextAllData ? '' : startDate,
        endDate: nextAllData ? '' : endDate,
        allData: nextAllData,
        filters: opts?.filters ?? draft,
      });
      setPage(1);
    },
    [startDate, endDate, draft],
  );

  const clearDates = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setQuery((prev) => ({ ...prev, startDate: '', endDate: '', allData: false }));
    setPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setDraft(EMPTY_FILTERS);
    setStartDate(today);
    setEndDate(today);
    setQuery({
      startDate: today,
      endDate: today,
      allData: false,
      filters: EMPTY_FILTERS,
    });
    setPage(1);
    setSelectedOrders([]);
  }, [today]);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const onDraftChange =
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraftField(key)(e.target.value);

  const downloadExcel = useCallback(() => {
    const source = isScanner ? scannerRows : rows;
    if (!source.length) {
      toast.warn('No data to export!');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(source);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Deposit Data');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deposit_data_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [isScanner, scannerRows, rows]);

  const toggleOrder = useCallback((row: DepositRow, checked: boolean) => {
    const orderId = row.orderId || '';
    if (!orderId) return;
    setSelectedOrders((prev) => {
      if (checked) {
        if (prev.some((o) => o.orderId === orderId)) return prev;
        return [
          ...prev,
          { orderId, paymentGatewayName: row.paymentGatewayName || '' },
        ];
      }
      return prev.filter((o) => o.orderId !== orderId);
    });
  }, []);

  const submitUpdateMid = useCallback(async () => {
    if (!selectedOrders.length) {
      toast.error('Select at least one deposit');
      return;
    }
    if (!midValue && !gatewayValue) {
      toast.error('Please select mid name or payment gateway name');
      return;
    }
    setMidSaving(true);
    try {
      const updates = selectedOrders.map((order) => ({
        orderId: order.orderId,
        ...(midValue ? { mid: midValue } : {}),
        ...(gatewayValue ? { paymentGatewayName: gatewayValue } : {}),
      }));
      const res = await secureApi('deposits.updatePaymentByOrderId', { updates });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update mid name');
        return;
      }
      toast.success(res.message || 'Mid name updated successfully');
      setMidModalOpen(false);
      setMidValue('');
      setGatewayValue('');
      setSelectedOrders([]);
      void load();
    } finally {
      setMidSaving(false);
    }
  }, [selectedOrders, midValue, gatewayValue, load]);

  const openEdit = useCallback((row: DepositRow) => {
    setSettleRow(row);
    setSettleOpen(true);
  }, []);

  const markChecked = useCallback(
    async (row: DepositRow, check: 'first' | 'second') => {
      const orderId = row.orderId;
      if (!orderId) {
        toast.error('Missing order id');
        return;
      }
      setCheckingId(`${orderId}-${check}`);
      try {
        const res = await secureApi('deposits.check', {
          transactionId: orderId,
          check,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?._id || '',
            status: check === 'first' ? 'true' : 'false',
          },
        });
        if (!res.ok) {
          toast.error(res.message || 'Check failed');
          return;
        }
        toast.success(res.message || 'Updated');
        void load();
      } finally {
        setCheckingId('');
      }
    },
    [admin, load],
  );

  const openRejectFromSettle = useCallback((row: DepositRow) => {
    setSettleOpen(false);
    setEditRow(row);
    setRejectReason('');
    setRejectOpen(true);
  }, []);

  const submitReject = useCallback(async () => {
    const orderId = editRow?.orderId;
    if (!orderId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Please enter reason');
      return;
    }
    setRejectSaving(true);
    try {
      const res = await secureApi('deposits.updateStatus', {
        transactionId: orderId,
        status: 'Rejected',
        reason,
        updatedBy: { _id: admin?._id || '', name: admin?.name || '' },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to reject');
        return;
      }
      toast.success('Amount Rejected Successfully!');
      setRejectOpen(false);
      setEditRow(null);
      void load();
      void loadSummary();
    } finally {
      setRejectSaving(false);
    }
  }, [admin, editRow, rejectReason, load, loadSummary]);

  const searchFilter = useCallback(
    (key: keyof ColumnFilters, placeholder: string) => (
      <TableSearchBar
        value={draft[key]}
        onChange={onDraftChange(key)}
        onSearch={() => commitQuery()}
        placeholder={placeholder}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, commitQuery],
  );

  const selectFilter = useCallback(
    (key: keyof ColumnFilters, options: { value: string; label: string }[]) => (
      <TextField
        select
        size="small"
        fullWidth
        value={draft[key]}
        onChange={(e) => {
          const value = e.target.value;
          setDraftField(key)(value);
          commitQuery({ filters: { ...draft, [key]: value } });
        }}
        sx={filterSelectSx}
      >
        {options.map((o) => (
          <MenuItem key={o.value || 'all'} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
    ),
    [draft, commitQuery, setDraftField],
  );

  const midOptions = useMemo(
    () => [
      { value: '', label: 'All' },
      ...mids.map((m) => ({
        value: String(m.mid ?? ''),
        label: `${m.paymentGatewayName || m.name || '—'}-${m.mid ?? ''}`,
      })),
    ],
    [mids],
  );

  const gatewayNameOptions = useMemo(() => {
    const fromMids = mids.map((m) => m.paymentGatewayName || m.name || '').filter(Boolean);
    return Array.from(new Set([...gateways, ...fromMids]));
  }, [gateways, mids]);

  const selectedSet = useMemo(
    () => new Set(selectedOrders.map((o) => o.orderId)),
    [selectedOrders],
  );

  const depositData = summary.depositData;
  const uniquePending = summary.uniquePendingDetail;
  const activeFilterCount = useMemo(
    () => Object.values(query.filters).filter((value) => value.trim()).length,
    [query.filters],
  );

  const columns = useMemo<CommonTableColumn<DepositRow>[]>(() => {
    const cols: CommonTableColumn<DepositRow>[] = [
      {
        id: 'index',
        label: 'Sr No',
        width: 58,
        stickyLeft: true,
        render: (row, index) => (
          <IndexCell
            index={index}
            page={page}
            itemsPerPage={itemsPerPage}
            row={row}
            selectable={canUpdateMid}
            selected={selectedSet.has(row.orderId || '')}
            onToggle={toggleOrder}
            compact={compactRows}
          />
        ),
      },
      {
        id: 'userName',
        label: 'User Name',
        width: 140,
        stickyLeft: true,
        filter: searchFilter('userName', 'User name'),
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              lineHeight: compactRows ? 1.3 : undefined,
              fontWeight: 600,
              cursor: row.userId ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 140,
            }}
            onClick={() => {
              if (!row.userId) return;
              navigate(
                `/users/report/${row.userId}/${encodeURIComponent(row.userName || '')}`,
              );
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
        cellSx: { whiteSpace: 'normal', overflow: 'visible' },
        filter: selectFilter('mid', midOptions),
        render: (row) => <PaymentMethodCell row={row} compact={compactRows} />,
      },
      {
        id: 'mobile',
        label: 'Mobile No',
        width: 150,
        filter: searchFilter('userMobile', 'Mobile'),
        render: (row) => (
          <MobileCell
            row={row}
            canShowMobile={canShowMobile}
            canWhatsApp={canWhatsApp}
            compact={compactRows}
          />
        ),
      },
      {
        id: 'clientName',
        label: 'App Name',
        width: 90,
        filter: selectFilter('clientName', [
          { value: '', label: 'All' },
          ...CLIENT_NAMES.map((n) => ({ value: n, label: appCodeForName(n) })),
        ]),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'amount',
        label: 'Amount',
        width: 90,
        filter: searchFilter('amount', 'Amount'),
        render: (row) => formatAmount(row.amount ?? 0),
      },
      {
        id: 'txnDetails',
        label: 'Txn Details',
        width: 120,
        filter: selectFilter(
          'status',
          DEPOSIT_STATUSES.map((s) => ({ value: s, label: s || 'All' })),
        ),
        render: (row) => (
          <TxnDetailsCell
            row={row}
            canEdit={canEditDeposit(row, canPencil)}
            onEdit={openEdit}
            compact={compactRows}
          />
        ),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        width: 110,
        render: (row) => <LastActivityCell row={row} compact={compactRows} />,
      },
      {
        id: 'checkBy',
        label: 'Check By',
        width: 110,
        render: (row) =>
          canShowCheckAction(row, canPencil) ? (
            <PersonCell
              person={row.checkBy}
              canCheck={!row.checkBy}
              checking={checkingId === `${row.orderId}-first`}
              onCheck={() => void markChecked(row, 'first')}
              compact={compactRows}
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
          canShowCheckAction(row, canPencil) ? (
            <PersonCell
              person={row.crossCheckBy}
              canCheck={!row.crossCheckBy}
              checking={checkingId === `${row.orderId}-second`}
              onCheck={() => void markChecked(row, 'second')}
              compact={compactRows}
            />
          ) : (
            '—'
          ),
      },
      {
        id: 'userState',
        label: 'User State',
        width: 120,
        filter: selectFilter('userState', [
          { value: '', label: 'All' },
          ...INDIA_STATES.map((s) => ({ value: s, label: s })),
        ]),
        render: (row) => display(row.userState || row.state),
      },
      {
        id: 'userCity',
        label: 'User City',
        width: 110,
        filter: searchFilter('userCity', 'City'),
        render: (row) => display(row.userCity || row.city),
      },
      {
        id: 'bank',
        label: 'User Bank Name',
        width: 140,
        filter: searchFilter('userBankName', 'Bank'),
        cellSx: { whiteSpace: 'normal', maxWidth: 140 },
        render: (row) => display(row.userBankName),
      },
      {
        id: 'secondaryName',
        label: 'Secondary User Name',
        width: 200,
        render: (row) => (
          <SecondaryNameCell row={row} onSaved={() => void load()} compact={compactRows} />
        ),
      },
      {
        id: 'account',
        label: 'Account Number',
        width: 130,
        filter: searchFilter('accountNumber', 'Account no'),
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
        filter: searchFilter('aadhaarNumber', 'Aadhar'),
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'orderId',
        label: 'Transaction Id',
        width: 140,
        filter: searchFilter('orderId', 'Transaction id'),
        render: (row) => display(row.orderId),
      },
      {
        id: 'orderKeyID',
        label: 'Client Txnid',
        width: 120,
        filter: searchFilter('orderKeyID', 'Client txn id'),
        render: (row) => display(row.orderKeyID),
      },
      {
        id: 'userId',
        label: 'DP Id',
        width: 110,
        filter: searchFilter('userId', 'DP id'),
        render: (row) => display(row.userId),
      },
      {
        id: 'upiId',
        label: 'UPI ID',
        width: 110,
        filter: searchFilter('upiId', 'UPI ID'),
        render: (row) => display(row.upiId),
      },
      {
        id: 'userUpiId',
        label: 'User UPI ID',
        width: 200,
        cellSx: { whiteSpace: 'normal' },
        render: (row) => <UserUpiCell row={row} compact={compactRows} />,
      },
      {
        id: 'updatedBy',
        label: 'Update By Name',
        width: 120,
        render: (row) =>
          display(
            typeof row.updatedBy === 'object' ? row.updatedBy?.name : row.updatedBy,
          ),
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
    page,
    itemsPerPage,
    compactRows,
    canUpdateMid,
    canShowMobile,
    canWhatsApp,
    canPencil,
    checkingId,
    selectedSet,
    toggleOrder,
    searchFilter,
    selectFilter,
    midOptions,
    openEdit,
    markChecked,
    load,
    navigate,
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
          canShowMobile
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
          display(
            typeof row.updatedBy === 'object' ? row.updatedBy?.name : row.updatedBy,
          ),
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
          return `${formatDisplayDate(row.updatedOn) || ''} ${formatDisplayTime(row.updatedOn) || ''}`.trim() || '—';
        },
      },
    ],
    [canShowMobile],
  );

  const getRowSx = useCallback(
    (row: DepositRow) => {
      const status = String(row.status || '').toLowerCase();
      const isPending = status === 'pending' || status === 'processing';
      const bg = depositRowBg(row.status, isLightMode ? 'light' : 'dark');
      const text = isLightMode ? '#1a1a1f' : '#e8e8ea';
      const border = isLightMode
        ? 'rgba(0, 0, 0, 0.12) !important'
        : 'rgba(52, 199, 120, 0.22) !important';
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
    [isLightMode],
  );

  /**
   * Page chrome (title + toolbar header + pagination) is fixed height, so the
   * table takes whatever is left of the viewport.
   */
  const tableMaxHeight = toolbarOpen
    ? 'calc(100vh - 250px)'
    : compactRows
      ? 'calc(100vh - 132px)'
      : 'calc(100vh - 140px)';

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: 1.5,
        py: compactRows ? 0.75 : 1.25,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        gap={1}
        mb={compactRows ? 0.75 : 1.5}
      >
        <Typography variant={compactRows ? 'h6' : 'h5'} fontWeight={700}>
          Deposits
        </Typography>
        <Stack direction="row" alignItems="center" gap={1}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={requestType}
            onChange={(_event, value: RequestType | null) => {
              if (value) setRequestType(value);
            }}
            aria-label="Deposit data source"
            sx={{
              height: 36,
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.5,
                fontWeight: 700,
                textTransform: 'none',
              },
              '& .Mui-selected': {
                bgcolor: 'rgba(255,159,10,0.18) !important',
                color: '#ff9f0a !important',
              },
            }}
          >
            <ToggleButton value="automatic">Automatic</ToggleButton>
            <ToggleButton value="scannerDeposit">Scanner</ToggleButton>
          </ToggleButtonGroup>
          <Button
            startIcon={
              loading || scannerLoading || summaryLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            disabled={loading || scannerLoading || summaryLoading}
            onClick={() => {
              if (isScanner) void loadScannerRows();
              else void load();
              void loadSummary();
            }}
            sx={{ ...orangeBtnSx, height: 36 }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          ...toolbarBoxSx,
          p: 0,
          mb: compactRows ? 0.75 : 1.5,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{
            px: 1.5,
            py: 0.75,
            cursor: 'pointer',
            userSelect: 'none',
            borderBottom: toolbarOpen ? '1px solid' : 'none',
            borderColor: 'divider',
            '&:hover': { bgcolor: 'action.hover' },
          }}
          onClick={() => setToolbarOpen((v) => !v)}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ minWidth: 0 }}
          >
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              Filters & Actions
            </Typography>
            {activeFilterCount > 0 ? (
              <Chip
                size="small"
                label={`${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`}
                color="primary"
                variant="outlined"
              />
            ) : null}
            {query.allData ? (
              <Chip size="small" label="All data" color="info" variant="outlined" />
            ) : null}
            {selectedOrders.length > 0 ? (
              <Chip
                size="small"
                label={`${selectedOrders.length} selected`}
                color="success"
                variant="outlined"
              />
            ) : null}
            {!toolbarOpen ? (
              <>
                <Chip size="small" label={`Total deposits: ${total}`} sx={chipSx} />
                <Chip
                  size="small"
                  label={`Unique pending (${uniquePending?.pendingCount ?? 0}): ${formatAmount(uniquePending?.pendingAmount ?? 0)}`}
                  sx={chipSx}
                />
                <Chip
                  size="small"
                  label={`Rejected (${depositData?.depositRejectedCount ?? 0}): ${formatAmount(depositData?.depositRejectedTotal ?? 0)}`}
                  sx={chipSx}
                />
                {isScanner ? (
                  <Chip
                    size="small"
                    label={`Scanner: ${formatAmount(scannerTotal)}`}
                    sx={chipSx}
                  />
                ) : null}
              </>
            ) : null}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => {
                e.stopPropagation();
                setCompactRows((v) => !v);
              }}
              sx={{
                py: 0,
                fontSize: 11,
                textTransform: 'none',
                fontWeight: 700,
                color: '#b06f10',
                borderColor: '#f1a144',
                bgcolor: 'rgba(241,161,68,0.10)',
                '&:hover': {
                  borderColor: '#e09030',
                  bgcolor: 'rgba(241,161,68,0.2)',
                },
              }}
            >
              {compactRows ? 'Compact rows' : 'Comfortable rows'}
            </Button>
            <IconButton
              size="small"
              aria-label={toolbarOpen ? 'Collapse filters' : 'Expand filters'}
              sx={{ color: 'text.secondary' }}
              onClick={(e) => {
                e.stopPropagation();
                setToolbarOpen((v) => !v);
              }}
            >
              {toolbarOpen ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
          </Stack>
        </Stack>

        <Collapse in={toolbarOpen} timeout="auto" unmountOnExit={false}>
          <Box sx={{ p: 1.5, pt: 1.25 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(3, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                  lg: 'repeat(6, minmax(0, 1fr))',
                },
                gap: 1.25,
                alignItems: 'center',
              }}
            >
              <TextField
                size="small"
                type="date"
                label="From Date"
                InputLabelProps={{ shrink: true }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                sx={fieldSx}
              />
              <TextField
                size="small"
                type="date"
                label="To Date"
                InputLabelProps={{ shrink: true }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                sx={fieldSx}
              />
              <TextField
                select
                size="small"
                label="Items Per Page"
                value={String(itemsPerPage)}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value) || 20);
                  setPage(1);
                }}
                sx={fieldSx}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>

              <Button
                variant="contained"
                disabled={loading || scannerLoading}
                onClick={() => {
                  if (isScanner) void loadScannerRows();
                  else commitQuery();
                }}
                sx={orangeBtnSx}
              >
                Apply
              </Button>
              <Button
                variant="outlined"
                disabled={loading || scannerLoading}
                onClick={() => {
                  commitQuery({ allData: true });
                  if (isScanner) void loadScannerRows();
                }}
                sx={secondaryBtnSx}
              >
                All Data
              </Button>
              <Button
                variant="outlined"
                disabled={loading}
                onClick={clearDates}
                sx={secondaryBtnSx}
              >
                Clear Dates
              </Button>

              <Button
                variant="outlined"
                disabled={loading}
                onClick={clearAllFilters}
                sx={secondaryBtnSx}
              >
                Clear All Filters
              </Button>
            </Box>

            {/* Separate from equal-width grid — nowrap labels were overflowing into neighbors */}
            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              spacing={2}
              alignItems="center"
              sx={{ mt: 1.25 }}
            >
              <Chip size="small" label={`Total deposits: ${total}`} sx={chipSx} />
              <Chip
                size="small"
                label={`Approved (${depositData?.depositApprovedCount ?? 0}): ${formatAmount(depositData?.depositApprovedTotal ?? 0)}`}
                sx={statusChipSx('#2e7d32', 'rgba(46,125,50,0.12)')}
              />
              <Chip
                size="small"
                label={`Pending (${depositData?.depositPendingCount ?? 0}): ${formatAmount(depositData?.depositPendingTotal ?? 0)}`}
                sx={statusChipSx('#ed8b00', 'rgba(255,159,10,0.13)')}
              />
              <Chip
                size="small"
                label={`Unique pending (${uniquePending?.pendingCount ?? 0}): ${formatAmount(uniquePending?.pendingAmount ?? 0)}`}
                sx={statusChipSx('#9c6b00', 'rgba(255,193,7,0.13)')}
              />
              <Chip
                size="small"
                label={`Rejected (${depositData?.depositRejectedCount ?? 0}): ${formatAmount(depositData?.depositRejectedTotal ?? 0)}`}
                sx={statusChipSx('#d32f2f', 'rgba(211,47,47,0.11)')}
              />
              <Chip
                size="small"
                label={`Scanner: ${formatAmount(scannerTotal)}${summaryLoading ? ' …' : ''}`}
                sx={statusChipSx('#0288d1', 'rgba(2,136,209,0.11)')}
              />
            </Stack>

            <Stack
              direction="row"
              flexWrap="wrap"
              useFlexGap
              spacing={1.25}
              alignItems="center"
              sx={{ mt: 1.25 }}
            >
              <Button
                variant="outlined"
                onClick={() => navigate('/unique_deposit_pending')}
                sx={secondaryBtnSx}
              >
                Unique Pending Deposit
              </Button>
              {canStateWise ? (
                <Button
                  variant="outlined"
                  onClick={() => navigate('/state-wise-deposit')}
                  sx={secondaryBtnSx}
                >
                  State Wise Deposit
                </Button>
              ) : null}
              <Button
                variant="outlined"
                disabled={loading}
                onClick={downloadExcel}
                sx={secondaryBtnSx}
              >
                Download Data
              </Button>
              {canUpdateMid ? (
                <Button
                  variant="contained"
                  disabled={!selectedOrders.length}
                  onClick={() => setMidModalOpen(true)}
                  sx={orangeBtnSx}
                >
                  Update MID Name ({selectedOrders.length})
                </Button>
              ) : null}
            </Stack>
          </Box>
        </Collapse>
      </Box>

      {isScanner ? (
        <CommonTable
          columns={scannerColumns}
          rows={scannerRows}
          getRowKey={(row, index) => row._id || row.userId || index}
          loading={scannerLoading}
          emptyMessage="No scanner data found"
          stickyHeader
          dense
          compact={compactRows}
          virtualize={false}
          minWidth={1600}
          maxHeight={tableMaxHeight}
        />
      ) : (
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, index) => row._id || row.orderId || index}
          loading={loading}
          emptyMessage="No deposits found"
          stickyHeader
          dense
          compact={compactRows}
          virtualize={false}
          minWidth={2800}
          maxHeight={tableMaxHeight}
          getRowSx={getRowSx}
        />
      )}

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mt={compactRows ? 1 : 2}
      >
        <Typography variant="body2" color="text.secondary">
          Total: {isScanner ? scannerRows.length : total}
        </Typography>
        {!isScanner ? (
          <Pagination
            count={Math.max(1, totalPages)}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
            size={compactRows ? 'small' : 'medium'}
            disabled={loading}
          />
        ) : null}
      </Stack>

      <SettleDialog
        open={settleOpen}
        row={settleRow}
        mids={mids}
        onClose={() => {
          setSettleOpen(false);
          setSettleRow(null);
        }}
        onDone={() => {
          void load();
          void loadSummary();
        }}
        onReject={openRejectFromSettle}
      />

      <Dialog
        open={rejectOpen}
        onClose={() => !rejectSaving && setRejectOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Reject Deposit</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Order: {editRow?.orderId || '—'} · Amount: {formatAmount(editRow?.amount ?? 0)}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Reject reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setRejectOpen(false)} disabled={rejectSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={rejectSaving}
            onClick={() => void submitReject()}
          >
            {rejectSaving ? <CircularProgress size={16} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={midModalOpen}
        onClose={() => !midSaving && setMidModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Update Mid Name</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Selected deposits: <strong>{selectedOrders.length}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            Note: Select the value which you want to change.
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            label="Select Mid Name"
            value={midValue}
            onChange={(e) => setMidValue(e.target.value)}
            sx={{ mb: 2 }}
          >
            <MenuItem value="">—</MenuItem>
            {mids.map((m) => (
              <MenuItem key={String(m.mid)} value={String(m.mid)}>
                {m.mid}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            size="small"
            label="Select Payment Gateway Name"
            value={gatewayValue}
            onChange={(e) => setGatewayValue(e.target.value)}
          >
            <MenuItem value="">—</MenuItem>
            {gatewayNameOptions.map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMidModalOpen(false)} disabled={midSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={midSaving}
            onClick={() => void submitUpdateMid()}
            sx={orangeBtnSx}
          >
            {midSaving ? <CircularProgress size={16} /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
