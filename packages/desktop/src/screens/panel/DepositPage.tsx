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
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import {
  formatAmount,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { SheetDownloadOtpModal } from '@/components/SheetDownloadOtpModal';
import { saveWorkbook } from '@/utils/downloadSheet';
import { asList, asPaged, useReportQuery } from '@/screens/panel/shared';
import {
  orangeBtnSx,
  chipSx,
  fieldSx,
  filterSelectSx,
  toolbarBoxSx,
  PAGE_SIZE_OPTIONS,
  type MidOption,
  asFundSummary,
  unpackPayload,
} from '@/screens/panel/transactions/shared';
import {
  type DepositRow,
} from '@/screens/panel/deposit/DepositCells';
import { SettleDialog } from '@/screens/panel/deposit/SettleDialog';
import { DepositMidDialog, DepositRejectDialog } from '@/screens/panel/deposit/DepositActionDialogs';
import { useDepositColumns } from '@/screens/panel/deposit/useDepositColumns';
import { type ScannerRow } from '@/screens/panel/deposit/logic';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '@/utils/empCodeNameCache';

type RequestType = 'automatic' | 'scannerDeposit';

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
  empCode: '',
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
  const [downloadOpen, setDownloadOpen] = useState(false);
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
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  const isScanner = requestType === 'scannerDeposit';

  useEffect(() => {
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  const buildPayload = useCallback(() => {
    const f = query.filters;
    const filter: Record<string, unknown> = {};
    if (f.status) filter.status = f.status;
    if (f.userName.trim()) filter.userName = f.userName.trim();
    if (f.empCode.trim()) filter.empCode = f.empCode.trim();
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
      const fromMids = cleaned.map((m) => m.paymentGatewayName || m.name || '').filter(Boolean);
      if (gwRes.ok) {
        const gwList = asList<{ name?: string; paymentGatewayName?: string }>(gwRes.data);
        const names = gwList.map((g) => g.name || g.paymentGatewayName || '').filter(Boolean);
        setGateways(Array.from(new Set([...names, ...fromMids])));
      } else {
        setGateways(Array.from(new Set(fromMids)));
      }
      return;
    }
    if (gwRes.ok) {
      const gwList = asList<{ name?: string; paymentGatewayName?: string }>(gwRes.data);
      setGateways(gwList.map((g) => g.name || g.paymentGatewayName || '').filter(Boolean));
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

  const onDraftChange = (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraftField(key)(e.target.value);

  const downloadExcel = useCallback(() => {
    const source = isScanner ? scannerRows : rows;
    return saveWorkbook(source as Record<string, unknown>[], {
      sheetName: 'Deposit Data',
      filename: `deposit_data_${Date.now()}.xlsx`,
    });
  }, [isScanner, scannerRows, rows]);

  const toggleOrder = useCallback((row: DepositRow, checked: boolean) => {
    const orderId = row.orderId || '';
    if (!orderId) return;
    setSelectedOrders((prev) => {
      if (checked) {
        if (prev.some((o) => o.orderId === orderId)) return prev;
        return [...prev, { orderId, paymentGatewayName: row.paymentGatewayName || '' }];
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

  const { columns, scannerColumns, getRowSx } = useDepositColumns({
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
    empCodeNameMap,
    isLightMode,
  });

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: 1.5,
        py: compactRows ? 0.75 : 1,
      }}
    >
      <Box
        sx={{
          ...toolbarBoxSx,
          p: 0,
          mb: compactRows ? 0.75 : 1,
          flexShrink: 0,
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
              Deposits
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
                <Chip size="small" label={`Total User : ${total}`} sx={chipSx} />
                <Chip
                  size="small"
                  label={`Unique Pending Deposit (${uniquePending?.pendingCount ?? 0}) : ${uniquePending?.pendingAmount ?? 0}`}
                  sx={chipSx}
                />
                <Chip
                  size="small"
                  label={`Rejected (${depositData?.depositRejectedCount ?? 0}): ${formatAmount(depositData?.depositRejectedTotal ?? 0)}`}
                  sx={chipSx}
                />
                {isScanner ? (
                  <Chip size="small" label={`Scanner: ${formatAmount(scannerTotal)}`} sx={chipSx} />
                ) : null}
              </>
            ) : (
              <>
                <Chip size="small" label={`Total User : ${total}`} sx={chipSx} />
                <Chip
                  size="small"
                  label={`Unique Pending Deposit (${uniquePending?.pendingCount ?? 0}) : ${uniquePending?.pendingAmount ?? 0}`}
                  sx={chipSx}
                />
              </>
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={requestType}
              onChange={(_event, value: RequestType | null) => {
                if (value) setRequestType(value);
              }}
              aria-label="Deposit data source"
              onClick={(e) => e.stopPropagation()}
              sx={{
                height: 32,
                '& .MuiToggleButton-root': {
                  px: 1.25,
                  py: 0.25,
                  fontWeight: 700,
                  textTransform: 'none',
                  borderColor: 'divider',
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
              size="small"
              startIcon={
                loading || scannerLoading || summaryLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <RefreshIcon sx={{ fontSize: 16 }} />
                )
              }
              disabled={loading || scannerLoading || summaryLoading}
              onClick={(e) => {
                e.stopPropagation();
                if (isScanner) void loadScannerRows();
                else void load();
                void loadSummary();
              }}
              sx={{ ...orangeBtnSx, height: 32, py: 0 }}
            >
              Refresh
            </Button>
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

        <Collapse in={toolbarOpen} timeout="auto" unmountOnExit>
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
              <Chip size="small" label={`Total User : ${total}`} sx={chipSx} />
              <Chip
                size="small"
                label={`Approved (${depositData?.depositApprovedCount ?? 0}): ${formatAmount(depositData?.depositApprovedTotal ?? 0)}`}
                sx={statusChipSx('#ff9f0a', 'rgba(255,159,10,0.16)')}
              />
              <Chip
                size="small"
                label={`Unique Pending Deposit (${uniquePending?.pendingCount ?? 0}) : ${uniquePending?.pendingAmount ?? 0}`}
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
                onClick={() => setDownloadOpen(true)}
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

      <TablePanel
        footerSx={{ minHeight: 40, px: 1.25, py: 0.5, borderRadius: 1.5 }}
        footer={
          <>
            <Chip
              size="small"
              label={`Total: ${isScanner ? scannerRows.length : total}`}
              sx={{
                height: 24,
                fontWeight: 700,
                color: '#c77a18',
                bgcolor: 'rgba(255,159,10,0.12)',
              }}
            />
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
          </>
        }
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: isLightMode ? '0 4px 18px rgba(0,0,0,0.08)' : '0 4px 20px rgba(0,0,0,0.24)',
            // Slight column breathing room without widening the whole table much.
            '& .MuiTableCell-root': {
              px: compactRows ? '10px !important' : '14px !important',
            },
          }}
        >
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
              virtualize
              minWidth={1600}
              maxHeight="100%"
              hover
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
              virtualize
              minWidth={2800}
              maxHeight="100%"
              getRowSx={getRowSx}
              hover
            />
          )}
        </Box>
      </TablePanel>

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

      <DepositRejectDialog
        open={rejectOpen}
        saving={rejectSaving}
        row={editRow}
        reason={rejectReason}
        onReasonChange={setRejectReason}
        onClose={() => setRejectOpen(false)}
        onSubmit={() => void submitReject()}
      />

      <DepositMidDialog
        open={midModalOpen}
        saving={midSaving}
        selectedCount={selectedOrders.length}
        mids={mids}
        midValue={midValue}
        gatewayValue={gatewayValue}
        gatewayNameOptions={gatewayNameOptions}
        onMidChange={setMidValue}
        onGatewayChange={setGatewayValue}
        onClose={() => setMidModalOpen(false)}
        onSubmit={() => void submitUpdateMid()}
      />
      <SheetDownloadOtpModal
        open={downloadOpen}
        filter={{
          mid: query.filters.mid || midValue || 'All',
          type: isScanner ? 'Scanner Deposit' : 'Deposit',
        }}
        onClose={() => setDownloadOpen(false)}
        onVerified={downloadExcel}
      />
    </Box>
  );
}
