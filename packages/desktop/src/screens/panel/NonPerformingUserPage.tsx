import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import {
  useReportQuery,
  asPaged,
  display,
  maskMobile,
} from './shared';

type NonPerformingUserRow = {
  _id: string;
  name?: string;
  clientName?: string;
  email?: string;
  mobile?: string;
  balance?: number;
  totalAmount?: number;
  state?: string;
  city?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  createdOn?: string;
  updatedOn?: string;
};

type Filters = {
  name: string;
  dpId: string;
  mobile: string;
  balance: string;
  state: string;
  city: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  dpId: '',
  mobile: '',
  balance: '',
  state: '',
  city: '',
};

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const headerFieldSx = {
  width: 180,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.4,
  '&:hover': { bgcolor: '#e08c00' },
};

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

function roundAmount(value: unknown): number {
  return Math.floor(Number(value) || 0);
}

/** Non Performing User list — ops.nonPerformingUser. */
export function NonPerformingUserPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const canShowMobile = hasPermission('show_mobile');

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigate(
        `/users/report/${userId}/${encodeURIComponent(userName || '')}`,
      );
    },
    [navigate],
  );

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.dpId.trim()) filter._id = applied.dpId.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    if (applied.balance.trim() && !Number.isNaN(Number(applied.balance))) {
      filter.balance = Number(applied.balance);
    }
    if (applied.state.trim()) filter.state = applied.state.trim();
    if (applied.city.trim()) filter.city = applied.city.trim();
    if (clientName) filter.clientName = clientName;
    return filter;
  }, [applied, clientName]);

  const { rows, totalPages, total, loading, error, load } =
    useReportQuery<NonPerformingUserRow>({
      action: 'ops.nonPerformingUser',
      buildPayload: () => ({
        pageNo: page,
        itemPerPage: itemsPerPage,
        ...(appliedStart && appliedEnd
          ? { startDate: appliedStart, endDate: appliedEnd }
          : {}),
        filter: buildFilter(),
      }),
      unpack: (res) => asPaged<NonPerformingUserRow>(res.data),
      autoDeps: [page, itemsPerPage, applied, clientName, appliedStart, appliedEnd],
      errorMessage: 'Failed to load non performing users',
    });

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  const applyDates = useCallback(() => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPage(1);
  }, [startDate, endDate]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const columns = useMemo<CommonTableColumn<NonPerformingUserRow>[]>(
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
        filter: (
          <ColumnSearch
            value={draft.name}
            onChange={setDraftField('name')}
            onSearch={search}
            placeholder="Search name"
          />
        ),
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              cursor: row._id ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 160,
            }}
            onClick={() => openUserReport(row._id, row.name)}
          >
            {display(row.name)}
          </Typography>
        ),
      },
      {
        id: 'dpId',
        label: 'Dp ID',
        filter: (
          <ColumnSearch
            value={draft.dpId}
            onChange={setDraftField('dpId')}
            onSearch={search}
            placeholder="Search Dp Id"
          />
        ),
        render: (row) => display(row._id),
      },
      {
        id: 'appName',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <ColumnSearch
            value={draft.mobile}
            onChange={setDraftField('mobile')}
            onSearch={search}
            placeholder="Search mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'balance',
        label: 'Balance',
        filter: (
          <ColumnSearch
            value={draft.balance}
            onChange={setDraftField('balance')}
            onSearch={search}
            placeholder="Search balance"
          />
        ),
        render: (row) => roundAmount(row.balance),
      },
      {
        id: 'deposit',
        label: 'Deposit Amount',
        render: (row) => roundAmount(row.totalAmount),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <ColumnSearch
            value={draft.state}
            onChange={setDraftField('state')}
            onSearch={search}
            placeholder="Search state"
          />
        ),
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        filter: (
          <ColumnSearch
            value={draft.city}
            onChange={setDraftField('city')}
            onSearch={search}
            placeholder="Search city"
          />
        ),
        render: (row) => display(row.city),
      },
      {
        id: 'appVersion',
        label: 'Current / Updated App Version',
        render: (row) =>
          `${display(row.currentAppVersion)} / ${display(row.updatedAppVersion)}`,
      },
      {
        id: 'created',
        label: 'Created',
        render: (row) =>
          row.createdOn
            ? `${formatDisplayDate(row.createdOn)} ${formatDisplayTime(row.createdOn)}`
            : '—',
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) =>
          row.updatedOn
            ? `${formatDisplayDate(row.updatedOn)} ${formatDisplayTime(row.updatedOn)}`
            : '—',
      },
    ],
    [page, itemsPerPage, draft, search, canShowMobile, setDraftField, openUserReport],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          Non Performing User
        </Typography>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          sx={{
            borderColor: 'rgba(255,255,255,0.2)',
            color: '#e8e8ea',
            textTransform: 'none',
            '&:hover': {
              borderColor: '#ff9f0a',
              bgcolor: 'rgba(255,159,10,0.08)',
            },
          }}
        >
          Refresh
        </Button>
      </Stack>

      {error ? (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      ) : null}

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', overflowX: 'auto' }}>
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="nowrap"
          useFlexGap
          sx={{ minWidth: 'max-content' }}
        >
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={headerFieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={headerFieldSx}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, width: 140 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="App Code"
            size="small"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setPage(1);
            }}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ ...headerFieldSx, width: 140 }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyDates}
            disabled={loading}
            sx={{ ...orangeBtnSx, height: 40, px: 2.5, flexShrink: 0 }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
          </Button>
          <Typography
            variant="body2"
            fontWeight={700}
            color="text.secondary"
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Total: {total}
          </Typography>
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No non performing users found"
        stickyHeader
        dense
        minWidth={1500}
        maxHeight="calc(100vh - 360px)"
      />

      <Stack alignItems="center" mt={2}>
        <Pagination
          count={Math.max(1, totalPages)}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
          disabled={loading}
        />
      </Stack>
    </Box>
  );
}
