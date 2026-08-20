import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  todayIST,
} from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { SheetDownloadOtpModal } from '@/components/SheetDownloadOtpModal';
import { saveWorkbook } from '@/utils/downloadSheet';
import { asList, asPaged, display, useReportQuery } from '@/screens/panel/shared';
import { INDIA_STATES } from '@/screens/panel/users/constants';

type RequestType = 'automaticDeposit' | 'scannerDeposit';

type DepositRow = {
  _id: string;
  userId?: string;
  userName?: string;
  clientName?: string;
  amount?: number | string;
  userState?: string;
  userCity?: string;
  userBankName?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  orderId?: string;
  paymentGatewayName?: string;
  mid?: string | number;
  createdOn?: string;
  status?: string;
  kyc?: boolean;
  reason?: string;
};

type ColumnFilters = {
  userName: string;
  userId: string;
  clientName: string;
  amount: string;
  userState: string;
  userCity: string;
  orderId: string;
  gatewayId: string;
};

type QueryState = {
  startDate: string;
  endDate: string;
  allData: boolean;
  filters: ColumnFilters;
};

type GatewayOption = {
  _id: string;
  name?: string;
  mid?: string | number;
};

type ScannerRow = {
  _id: string;
  userId?: string;
  userName?: string;
  clientName?: string;
  balance?: number | string;
  state?: string;
  city?: string;
  updatedBy?: { name?: string } | string;
  reason?: string;
  mid?: string | number;
  remakr?: string;
  remark?: string;
  utr?: string;
  createdOn?: string;
  updatedOn?: string;
};

const EMPTY_FILTERS: ColumnFilters = {
  userName: '',
  userId: '',
  clientName: '',
  amount: '',
  userState: '',
  userCity: '',
  orderId: '',
  gatewayId: '',
};

const PAGE_SIZE_OPTIONS = [
  ...ITEMS_PER_PAGE_OPTIONS,
  '1000',
  '5000',
  '10000',
  '20000',
] as const;

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  flexShrink: 0,
  minWidth: 'fit-content',
  whiteSpace: 'nowrap' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const fieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

const filterSelectSx = {
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 12 },
};

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

export function DepositApprovedReportPage() {
  const navigate = useNavigate();
  const today = todayIST();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: today,
    endDate: today,
    allData: false,
    filters: EMPTY_FILTERS,
  });
  const [approvedSum, setApprovedSum] = useState(0);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [sumLoading, setSumLoading] = useState(false);
  const [gateways, setGateways] = useState<GatewayOption[]>([]);
  const [requestType, setRequestType] = useState<RequestType>('automaticDeposit');
  const [scannerRows, setScannerRows] = useState<ScannerRow[]>([]);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerClientName, setScannerClientName] = useState('');

  const isScanner = requestType === 'scannerDeposit';

  const selectedGateway = useMemo(
    () => gateways.find((g) => g._id === (query.filters.gatewayId || draft.gatewayId)) || null,
    [gateways, query.filters.gatewayId, draft.gatewayId],
  );

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = { status: 'Approved' };
    const f = query.filters;
    if (f.userName.trim()) filter.userName = f.userName.trim();
    if (f.userId.trim()) filter.userId = f.userId.trim();
    if (f.clientName) filter.clientName = f.clientName;
    if (f.amount.trim()) filter.amount = f.amount.trim();
    if (f.userState) filter.userState = f.userState;
    if (f.userCity.trim()) filter.userCity = f.userCity.trim();
    if (f.orderId.trim()) filter.orderId = f.orderId.trim();

    const gateway = gateways.find((g) => g._id === f.gatewayId);
    if (gateway) {
      if (gateway.name) filter.paymentGatewayName = gateway.name;
      if (gateway.mid != null && gateway.mid !== '') filter.mid = gateway.mid;
    }

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
  }, [query, page, itemsPerPage, gateways]);

  const unpack = useCallback((res: { data?: unknown }) => asPaged<DepositRow>(res.data), []);

  const { rows, total, totalPages, loading, load } = useReportQuery<DepositRow>({
    action: 'depositApproved.transactions',
    buildPayload,
    unpack,
    autoDeps: isScanner ? [requestType] : [page, itemsPerPage, query],
    errorMessage: 'Failed to load deposit approved report',
    cacheTtlMs: 0,
  });

  const loadGateways = useCallback(async () => {
    const res = await secureApi('depositApproved.gatewayNames', {});
    if (!res.ok) return;
    const body = unpackPayload(res.data);
    const list = Array.isArray(res.data)
      ? (res.data as GatewayOption[])
      : Array.isArray(body.items)
        ? (body.items as GatewayOption[])
        : asList<GatewayOption>(res.data);
    setGateways(
      list
        .filter((g) => g && g._id)
        .map((g) => ({
          _id: String(g._id),
          name: g.name,
          mid: g.mid,
        })),
    );
  }, []);

  const loadScannerData = useCallback(async () => {
    if (!isScanner) return;
    setScannerLoading(true);
    try {
      const gateway =
        gateways.find((g) => g._id === query.filters.gatewayId) || selectedGateway;
      const payload: Record<string, unknown> = {};
      if (gateway?.name) payload.paymentGatewayName = gateway.name;
      if (gateway?.mid != null && gateway.mid !== '') payload.mid = gateway.mid;
      if (query.allData) {
        const today = todayIST();
        payload.startDate = today;
        payload.endDate = today;
      } else {
        if (query.startDate) payload.startDate = query.startDate;
        if (query.endDate) payload.endDate = query.endDate;
      }
      if (scannerClientName) payload.clientName = scannerClientName;

      const res = await secureApi('depositApproved.scannerData', payload);
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
      setScannerRows(items.filter((r) => r && (r._id || r.userId)));
    } finally {
      setScannerLoading(false);
    }
  }, [
    isScanner,
    gateways,
    query.filters.gatewayId,
    query.allData,
    query.startDate,
    query.endDate,
    selectedGateway,
    scannerClientName,
  ]);

  const loadApprovedSum = useCallback(async () => {
    const gateway =
      gateways.find((g) => g._id === query.filters.gatewayId) || selectedGateway;
    const mid = gateway?.mid;
    if (mid == null || mid === '') {
      setApprovedSum(0);
      return;
    }

    setSumLoading(true);
    try {
      const start = query.allData
        ? todayIST()
        : query.startDate || todayIST();
      const end = query.allData ? todayIST() : query.endDate || todayIST();
      const payload: Record<string, unknown> = {
        depositType: requestType,
        mid,
        startDate: start,
        endDate: end,
      };
      const res = await secureApi('depositApproved.approvedSum', payload);
      if (!res.ok) {
        console.error(res.message || 'Failed to load approved sum');
        setApprovedSum(0);
        return;
      }
      const body = unpackPayload(res.data);
      setApprovedSum(Number(body.totalAmt ?? body.total ?? 0) || 0);
    } finally {
      setSumLoading(false);
    }
  }, [
    gateways,
    query.allData,
    query.startDate,
    query.endDate,
    query.filters.gatewayId,
    selectedGateway,
    requestType,
  ]);

  useEffect(() => {
    void loadGateways();
  }, [loadGateways]);

  useEffect(() => {
    void loadApprovedSum();
  }, [loadApprovedSum]);

  useEffect(() => {
    if (isScanner) void loadScannerData();
  }, [isScanner, loadScannerData]);

  const downloadExcel = useCallback(() => {
    const source = isScanner ? scannerRows : rows;
    return saveWorkbook(source as Record<string, unknown>[], {
      sheetName: 'Deposit Data',
      filename: `deposit_data_${Date.now()}.xlsx`,
    });
  }, [isScanner, scannerRows, rows]);

  const refreshAll = useCallback(() => {
    if (isScanner) void loadScannerData();
    else void load();
    void loadApprovedSum();
  }, [isScanner, loadScannerData, load, loadApprovedSum]);
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
    setQuery((prev) => ({
      ...prev,
      startDate: '',
      endDate: '',
      allData: false,
    }));
    setPage(1);
  }, []);

  const setDraftField = useCallback(
    (key: keyof ColumnFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const onDraftChange =
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) =>
      setDraftField(key)(e.target.value);

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigate(
        `/users/report/${userId}/${encodeURIComponent(userName || '')}`,
      );
    },
    [navigate],
  );

  const requestTypeSelect = (
    <TextField
      select
      size="small"
      fullWidth
      value={requestType}
      onChange={(e) => {
        setRequestType(e.target.value as RequestType);
        setPage(1);
      }}
      sx={filterSelectSx}
    >
      <MenuItem value="automaticDeposit">Automatic</MenuItem>
      <MenuItem value="scannerDeposit">Scanner data</MenuItem>
    </TextField>
  );

  const gatewaySelect = (
    <TextField
      select
      size="small"
      fullWidth
      value={draft.gatewayId}
      onChange={(e) => {
        const id = e.target.value;
        setDraftField('gatewayId')(id);
        commitQuery({ filters: { ...draft, gatewayId: id } });
      }}
      sx={filterSelectSx}
    >
      <MenuItem value="">All</MenuItem>
      {gateways.map((g) => (
        <MenuItem key={g._id} value={g._id}>
          {g.name || '—'}-{g.mid ?? ''}
        </MenuItem>
      ))}
    </TextField>
  );

  const depositColumns = useMemo<CommonTableColumn<DepositRow>[]>(
    () => [
      {
        id: 'index',
        label: 'Type',
        width: 140,
        filter: requestTypeSelect,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'userName',
        label: 'User Name',
        filter: (
          <TableSearchBar
            value={draft.userName}
            onChange={onDraftChange('userName')}
            onSearch={() => commitQuery()}
            placeholder="User name"
          />
        ),
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              cursor: row.userId ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 160,
            }}
            onClick={() => openUserReport(row.userId, row.userName)}
          >
            {display(row.userName)}
          </Typography>
        ),
      },
      {
        id: 'userId',
        label: 'DP Id',
        filter: (
          <TableSearchBar
            value={draft.userId}
            onChange={onDraftChange('userId')}
            onSearch={() => commitQuery()}
            placeholder="DP id"
          />
        ),
        render: (row) => display(row.userId),
      },
      {
        id: 'clientName',
        label: 'App Code',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={draft.clientName}
            onChange={(e) => {
              setDraftField('clientName')(e.target.value);
              commitQuery({
                filters: { ...draft, clientName: e.target.value },
              });
            }}
            sx={filterSelectSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'amount',
        label: 'Amount',
        filter: (
          <TableSearchBar
            value={draft.amount}
            onChange={onDraftChange('amount')}
            onSearch={() => commitQuery()}
            placeholder="Amount"
          />
        ),
        render: (row) => formatAmount(row.amount ?? 0),
      },
      {
        id: 'userState',
        label: 'State',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={draft.userState}
            onChange={(e) => {
              setDraftField('userState')(e.target.value);
              commitQuery({
                filters: { ...draft, userState: e.target.value },
              });
            }}
            sx={filterSelectSx}
          >
            <MenuItem value="">All</MenuItem>
            {INDIA_STATES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (row) => display(row.userState),
      },
      {
        id: 'userCity',
        label: 'City',
        filter: (
          <TableSearchBar
            value={draft.userCity}
            onChange={onDraftChange('userCity')}
            onSearch={() => commitQuery()}
            placeholder="City"
          />
        ),
        render: (row) => display(row.userCity),
      },
      {
        id: 'bank',
        label: 'Bank',
        render: (row) => display(row.userBankName),
      },
      {
        id: 'account',
        label: 'Account #',
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'aadhaar',
        label: 'Aadhaar',
        render: (row) => display(row.aadhaarNumber),
      },
      {
        id: 'orderId',
        label: 'Transaction Id',
        filter: (
          <TableSearchBar
            value={draft.orderId}
            onChange={onDraftChange('orderId')}
            onSearch={() => commitQuery()}
            placeholder="Order id"
          />
        ),
        render: (row) => display(row.orderId),
      },
      {
        id: 'paymentMethod',
        label: 'Payment Method',
        filter: gatewaySelect,
        render: (row) => {
          const gw = display(row.paymentGatewayName, '');
          const mid = row.mid != null && row.mid !== '' ? String(row.mid) : '';
          if (!gw && !mid) return '—';
          return mid ? `${gw} - ${mid}` : gw;
        },
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
        id: 'status',
        label: 'Status',
        render: (row) => display(row.status),
      },
      {
        id: 'kyc',
        label: 'Kyc',
        render: (row) => (row.kyc === false ? 'Kyc not done' : ''),
      },
      {
        id: 'reason',
        label: 'Rejected Reason',
        render: (row) => display(row.reason),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, itemsPerPage, draft, commitQuery, setDraftField, gateways, requestType, openUserReport],
  );

  const scannerColumns = useMemo<CommonTableColumn<ScannerRow>[]>(
    () => [
      {
        id: 'index',
        label: 'Type',
        width: 140,
        filter: requestTypeSelect,
        render: (_row, index) => index + 1,
      },
      {
        id: 'userName',
        label: 'User Name',
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              cursor: row.userId ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 160,
            }}
            onClick={() => openUserReport(row.userId, row.userName)}
          >
            {display(row.userName)}
          </Typography>
        ),
      },
      {
        id: 'clientName',
        label: 'App Code',
        filter: (
          <TextField
            select
            size="small"
            fullWidth
            value={scannerClientName}
            onChange={(e) => setScannerClientName(e.target.value)}
            sx={filterSelectSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
        ),
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
        id: 'mid',
        label: 'Mid',
        filter: gatewaySelect,
        render: (row) => display(row.mid),
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
          const d = formatDisplayDate(row.updatedOn);
          const t = formatDisplayTime(row.updatedOn);
          return d && t ? `${d} | ${t}` : d || t || '—';
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestType, scannerClientName, draft.gatewayId, gateways, openUserReport],
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        px: 1.5,
        py: 1.25,
        boxSizing: 'border-box',
      }}
    >
      <CollapsibleFilterPanel
        title="Deposit Approved Report"
        summary={`${startDate} → ${endDate}`}
        sx={{ flexShrink: 0 }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              sm: 'repeat(3, minmax(0, 1fr))',
              md: 'repeat(4, minmax(0, 1fr))',
              lg: 'repeat(5, minmax(0, 1fr))',
            },
            gap: 1.25,
            alignItems: 'center',
            width: '100%',
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
            label="Items / Page"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value) || DEFAULT_ITEMS_PER_PAGE);
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
          <TextField
            select
            size="small"
            label="Payment Type"
            value={requestType}
            onChange={(e) => {
              setRequestType(e.target.value as RequestType);
              setPage(1);
            }}
            sx={fieldSx}
          >
            <MenuItem value="automaticDeposit">Automatic</MenuItem>
            <MenuItem value="scannerDeposit">Scanner data</MenuItem>
          </TextField>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ gridColumn: { xs: '1 / -1', lg: 'span 2' } }}
          >
            <Button
              variant="contained"
              disabled={loading || scannerLoading}
              onClick={() => {
                if (isScanner) void loadScannerData();
                else commitQuery();
              }}
              sx={orangeBtnSx}
            >
              Apply
            </Button>
            <Button
              variant="contained"
              disabled={loading || scannerLoading}
              onClick={clearDates}
              sx={orangeBtnSx}
            >
              Clear
            </Button>
            <Button
              variant="contained"
              startIcon={
                loading || scannerLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              disabled={loading || scannerLoading}
              onClick={refreshAll}
              sx={orangeBtnSx}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              disabled={loading || scannerLoading}
              onClick={() => setDownloadOpen(true)}
              sx={orangeBtnSx}
            >
              Download ExcelData
            </Button>
          </Stack>
        </Box>
      </CollapsibleFilterPanel>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        mb={1.5}
        sx={{ flexShrink: 0 }}
      >
        <Chip
          label={
            selectedGateway?.mid
              ? `Total Approved Sum: ${formatAmount(approvedSum)}`
              : 'Total Approved Sum: select gateway'
          }
          sx={{ bgcolor: 'rgba(255,159,10,0.15)', color: '#ff9f0a', fontWeight: 700 }}
        />
        {sumLoading ? <CircularProgress size={18} sx={{ color: '#ff9f0a' }} /> : null}
      </Stack>

      <TablePanel
        footer={
          <>
            <Typography variant="body2" color="text.secondary">
              Total: {isScanner ? scannerRows.length : total}
            </Typography>
            {!isScanner ? (
              <Pagination
                count={Math.max(1, totalPages)}
                page={page}
                onChange={(_e, p) => setPage(p)}
                color="primary"
                disabled={loading}
              />
            ) : null}
          </>
        }
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
            minWidth={1800}
            maxHeight="100%"
          />
        ) : (
          <CommonTable
            columns={depositColumns}
            rows={rows}
            getRowKey={(row, index) => row._id || row.orderId || index}
            loading={loading}
            emptyMessage="No approved deposits found"
            stickyHeader
            dense
            minWidth={2200}
            maxHeight="100%"
          />
        )}
      </TablePanel>
      <SheetDownloadOtpModal
        open={downloadOpen}
        filter={{
          mid:
            selectedGateway?.mid != null && selectedGateway.mid !== ''
              ? String(selectedGateway.mid)
              : 'All',
          type: isScanner ? 'Scanner Deposit Approved Report' : 'Deposit Approved Report',
        }}
        onClose={() => setDownloadOpen(false)}
        onVerified={downloadExcel}
      />
    </Box>
  );
}
