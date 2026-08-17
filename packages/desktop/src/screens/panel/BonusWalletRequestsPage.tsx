import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { createTableFiltersContext } from '@/components/createTableFiltersContext';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
  todayIST,
} from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { asPaged, display, maskMobile, useReportQuery } from '@/screens/panel/shared';

type BonusRow = {
  _id: string;
  name?: string;
  mobile?: string;
  amount?: number | string;
  userId?: string;
  status?: string;
  updatedOn?: string;
  updatedBy?: { name?: string; _id?: string; date?: string };
};

type ColumnFilters = {
  name: string;
  transactionId: string;
  mobile: string;
};

type QueryState = {
  startDate: string;
  endDate: string;
  status: string;
  allData: boolean;
  filters: ColumnFilters;
};

type Summary = {
  approvedCount: number;
  walletBalance: number;
  pendingCount: number;
};

type BonusFiltersCtx = {
  draft: ColumnFilters;
  setDraftField: (key: keyof ColumnFilters) => (value: string) => void;
  commitQuery: () => void;
};

const { Provider: BonusFiltersProvider, useFilters: useBonusFilters } =
  createTableFiltersContext<BonusFiltersCtx>('BonusWalletFilters');

function BonusNameFilter() {
  const { draft, setDraftField, commitQuery } = useBonusFilters();
  return (
    <TableSearchBar
      value={draft.name}
      onChange={(e) => setDraftField('name')(e.target.value)}
      onSearch={() => commitQuery()}
      placeholder="User name"
    />
  );
}

function BonusTxnFilter() {
  const { draft, setDraftField, commitQuery } = useBonusFilters();
  return (
    <TableSearchBar
      value={draft.transactionId}
      onChange={(e) => setDraftField('transactionId')(e.target.value)}
      onSearch={() => commitQuery()}
      placeholder="Transaction id"
    />
  );
}

function BonusMobileFilter() {
  const { draft, setDraftField, commitQuery } = useBonusFilters();
  return (
    <TableSearchBar
      value={draft.mobile}
      onChange={(e) => setDraftField('mobile')(e.target.value)}
      onSearch={() => commitQuery()}
      placeholder="Mobile"
    />
  );
}

const EMPTY_FILTERS: ColumnFilters = {
  name: '',
  transactionId: '',
  mobile: '',
};

const STATUS_OPTIONS = ['', 'pending', 'approve', 'reject', 'remove'] as const;

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

const actionBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  fontSize: 11,
  lineHeight: 1.2,
  height: 28,
  px: 1.25,
  py: 0.25,
  minWidth: 0,
  flexShrink: 0,
  textTransform: 'uppercase' as const,
  whiteSpace: 'nowrap' as const,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#e08c00', boxShadow: 'none' },
  '&.Mui-disabled': {
    bgcolor: 'rgba(255,159,10,0.35)',
    color: 'rgba(26,18,0,0.45)',
  },
};

const fieldSx = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

export function BonusWalletRequestsPage() {
  const navigate = useNavigate();
  const admin = getStoredUser<{ _id?: string; name?: string }>();
  const canShowMobile = hasPermission('show_mobile');
  const today = todayIST();

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: today,
    endDate: today,
    status: '',
    allData: false,
    filters: EMPTY_FILTERS,
  });
  const [summary, setSummary] = useState<Summary>({
    approvedCount: 0,
    walletBalance: 0,
    pendingCount: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [actingId, setActingId] = useState('');

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.filters.name.trim()) filter.name = query.filters.name.trim();
    if (query.filters.mobile.trim()) filter.mobile = query.filters.mobile.trim();
    if (query.filters.transactionId.trim()) filter._id = query.filters.transactionId.trim();

    const payload: Record<string, unknown> = {
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

  const unpack = useCallback((res: { data?: unknown }) => asPaged<BonusRow>(res.data), []);

  const { rows, total, totalPages, loading, load } = useReportQuery<BonusRow>({
    action: 'bonusWallet.transferRequests',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage, query],
    errorMessage: 'Failed to load bonus wallet requests',
    cacheTtlMs: 30_000,
  });

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      let payload: Record<string, unknown>;
      if (query.allData) {
        payload = { allData: true };
      } else if (query.startDate && query.endDate) {
        payload = {
          startDate: query.startDate,
          endDate: query.endDate,
          allData: false,
        };
      } else {
        const d = todayIST();
        payload = { startDate: d, endDate: d, allData: false };
      }

      const res = await secureApi('bonusWallet.fundRequestSummary', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load summary');
        return;
      }
      const body = unpackPayload(res.data);
      setSummary({
        approvedCount: Number(body.totalCountTransferToMainWallet) || 0,
        walletBalance: Number(body.totalAmountTransferToMainWallet) || 0,
        pendingCount: Number(body.pendingCount) || 0,
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [query.allData, query.startDate, query.endDate]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const commitQuery = useCallback(
    (opts?: { allData?: boolean; filters?: ColumnFilters; clearDates?: boolean }) => {
      const nextAllData = opts?.allData ?? false;
      const nextStart = opts?.clearDates ? '' : startDate;
      const nextEnd = opts?.clearDates ? '' : endDate;
      setQuery({
        startDate: nextAllData ? '' : nextStart,
        endDate: nextAllData ? '' : nextEnd,
        status,
        allData: nextAllData,
        filters: opts?.filters ?? draft,
      });
      setPage(1);
    },
    [startDate, endDate, status, draft],
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

  const handleAction = useCallback(
    async (row: BonusRow, actionStatus: 'approve' | 'reject' | 'remove') => {
      if (!row._id || !row.userId) {
        toast.error('Missing request id');
        return;
      }
      setActingId(`${row._id}:${actionStatus}`);
      try {
        const res = await secureApi('bonusWallet.updateTransferRequest', {
          userId: row.userId,
          _id: row._id,
          amount: row.amount,
          status: actionStatus,
          updatedBy: {
            name: admin?.name || '',
            _id: admin?._id || '',
            status: actionStatus,
          },
        });
        if (!res.ok) {
          toast.error(res.message || `Failed to ${actionStatus}`);
          return;
        }
        toast.success(res.message || `Request ${actionStatus}d`);
        void load();
        void loadSummary();
      } finally {
        setActingId('');
      }
    },
    [admin, load, loadSummary],
  );

  const columns = useMemo<CommonTableColumn<BonusRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'User Name',
        filter: <BonusNameFilter />,
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              cursor: row.userId ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 160,
            }}
            onClick={() => {
              if (!row.userId) return;
              navigate(
                `/users/report/${row.userId}/${encodeURIComponent(row.name || '')}`,
              );
            }}
          >
            {display(row.name)}
          </Typography>
        ),
      },
      {
        id: 'transactionId',
        label: 'Transaction Id',
        filter: <BonusTxnFilter />,
        render: (row) => display(row._id),
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row) => formatAmount(row.amount ?? 0),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: <BonusMobileFilter />,
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => display(row.status),
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => formatDisplayDate(row.updatedOn) || '—',
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => formatDisplayTime(row.updatedOn) || '—',
      },
      {
        id: 'action',
        label: 'Action',
        width: 280,
        cellSx: { whiteSpace: 'nowrap' },
        render: (row) => {
          // Match laxminarayan: always show buttons; disable unless pending.
          const pending = String(row.status || '').trim().toLowerCase() === 'pending';
          return (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              justifyContent="center"
              flexWrap="nowrap"
            >
              {(['approve', 'reject', 'remove'] as const).map((actionStatus) => {
                const busy = actingId === `${row._id}:${actionStatus}`;
                return (
                  <Button
                    key={actionStatus}
                    size="small"
                    variant="contained"
                    disabled={!pending || Boolean(actingId)}
                    onClick={() => void handleAction(row, actionStatus)}
                    sx={actionBtnSx}
                  >
                    {busy ? '…' : actionStatus}
                  </Button>
                );
              })}
            </Stack>
          );
        },
      },
      {
        id: 'updatedBy',
        label: 'Updated By',
        render: (row) =>
          row.updatedBy?.name
            ? `${display(row.status)} by ${display(row.updatedBy.name)}`
            : '—',
      },
    ],
    [
      page,
      itemsPerPage,
      canShowMobile,
      actingId,
      handleAction,
      navigate,
    ],
  );

  const filtersCtx = useMemo<BonusFiltersCtx>(
    () => ({ draft, setDraftField, commitQuery: () => commitQuery() }),
    [draft, setDraftField, commitQuery],
  );

  return (
    <BonusFiltersProvider value={filtersCtx}>
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
        title="Bonus Wallet Requests"
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
              lg: 'repeat(6, minmax(0, 1fr))',
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
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={fieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
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
              disabled={loading}
              onClick={() => commitQuery()}
              sx={orangeBtnSx}
            >
              Apply
            </Button>
            <Button
              variant="contained"
              disabled={loading}
              onClick={() => commitQuery({ allData: true })}
              sx={orangeBtnSx}
            >
              All Data
            </Button>
            <Button
              variant="contained"
              disabled={loading}
              onClick={clearDates}
              sx={orangeBtnSx}
            >
              Clear
            </Button>
            <Button
              variant="contained"
              startIcon={
                loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />
              }
              disabled={loading}
              onClick={() => {
                void load();
                void loadSummary();
              }}
              sx={orangeBtnSx}
            >
              Refresh
            </Button>
          </Stack>
        </Box>
      </CollapsibleFilterPanel>

      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        mb={1.5}
        sx={{ flexShrink: 0 }}
      >
        <Chip
          label={`Approved: ${summary.approvedCount}`}
          sx={{ bgcolor: 'rgba(255,159,10,0.15)', color: '#ff9f0a', fontWeight: 700 }}
        />
        <Chip
          label={`Wallet Balance: ${formatAmount(summary.walletBalance)}`}
          sx={{ bgcolor: 'rgba(255,159,10,0.15)', color: '#ff9f0a', fontWeight: 700 }}
        />
        <Chip
          label={`Pending: ${summary.pendingCount}`}
          sx={{ bgcolor: 'rgba(255,159,10,0.15)', color: '#ff9f0a', fontWeight: 700 }}
        />
        {summaryLoading ? <CircularProgress size={18} sx={{ color: '#ff9f0a' }} /> : null}
      </Stack>

      <TablePanel
        footer={
          <>
            <Typography variant="body2" color="text.secondary">
              Total: {total}
            </Typography>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={loading}
            />
          </>
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, index) => row._id || index}
          loading={loading}
          emptyMessage="No bonus wallet requests found"
          stickyHeader
          dense
          minWidth={1400}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
    </BonusFiltersProvider>
  );
}
