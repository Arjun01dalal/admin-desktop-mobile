import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import {
  useReportQuery,
  display,
  maskMobile,
} from './shared';

type TodaysActiveRow = {
  _id: string;
  name?: string;
  clientName?: string;
  played?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  mobile?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  balance?: number;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  activeUser?: string;
  createdOn?: string;
};

type Filters = {
  name: string;
  dpId: string;
  mobile: string;
  accountNumber: string;
  aadhaarNumber: string;
  email: string;
  city: string;
  state: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  dpId: '',
  mobile: '',
  accountNumber: '',
  aadhaarNumber: '',
  email: '',
  city: '',
  state: '',
};

const PLAY_IN_OPTIONS = [
  { value: 'E', label: 'E' },
  { value: 'C', label: 'C' },
  { value: 'S', label: 'S' },
];

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

function ColumnSelect({
  value,
  onChange,
  options,
  placeholder = 'All',
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <TextField
      select
      size="small"
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      SelectProps={{ displayEmpty: true }}
      sx={filterFieldSx}
    >
      <MenuItem value="">
        <em>{placeholder}</em>
      </MenuItem>
      {options.map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Todays Active users — ops.activeCustomers. */
export function TodaysActivePage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [playedIn, setPlayedIn] = useState('');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});

  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigate(
        `/users/report/${userId}/${encodeURIComponent(userName || '')}`,
      );
    },
    [navigate],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await secureApi<{ clientName?: string; version?: string }[]>(
        'users.appVersions',
        {},
      );
      if (cancelled || !res.ok) return;
      const list = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, string> = {};
      for (const item of list) {
        if (item?.clientName) map[item.clientName] = String(item.version ?? '');
      }
      setAppVersions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.dpId.trim()) filter._id = applied.dpId.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    if (applied.accountNumber.trim()) filter.accountNumber = applied.accountNumber.trim();
    if (applied.aadhaarNumber.trim()) filter.aadhaarNumber = applied.aadhaarNumber.trim();
    if (applied.email.trim()) filter.email = applied.email.trim();
    if (applied.city.trim()) filter.city = applied.city.trim();
    if (applied.state.trim()) filter.state = applied.state.trim();
    if (clientName) filter.clientName = clientName;
    if (playedIn) filter.played = playedIn;
    return filter;
  }, [applied, clientName, playedIn]);

  const { rows, totalPages, total, loading, error, load } =
    useReportQuery<TodaysActiveRow>({
      action: 'ops.activeCustomers',
      buildPayload: () => ({
        itemsPerPage,
        pageNo: page,
        ...(startDate && endDate ? { startDate, endDate } : {}),
        filter: buildFilter(),
      }),
      unpack: (res) => {
        const raw = res.data as
          | { user?: TodaysActiveRow[]; totalPages?: number; count?: number }
          | undefined;
        return {
          rows: Array.isArray(raw?.user) ? raw.user : [],
          totalPages: Math.max(1, Number(raw?.totalPages ?? 1) || 1),
          total: Number(raw?.count ?? 0) || 0,
        };
      },
      autoDeps: [page, itemsPerPage, applied, clientName, playedIn],
      errorMessage: 'Failed to load todays active users',
    });

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  const applyDates = useCallback(() => {
    setPage(1);
    void load();
  }, [load]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const columns = useMemo(() => {
    const cols: CommonTableColumn<TodaysActiveRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
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
        label: 'Dp Id',
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
    ];

    if (!hideContact) {
      cols.push({
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
      });
    }

    cols.push(
      {
        id: 'appName',
        label: 'App Code',
        filter: (
          <ColumnSelect
            value={clientName}
            onChange={(value) => {
              setClientName(value);
              setPage(1);
            }}
            options={CLIENT_NAMES.map((name) => ({
              value: name,
              label: appCodeForName(name),
            }))}
          />
        ),
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'playIn',
        label: 'In',
        filter: (
          <ColumnSelect
            value={playedIn}
            onChange={(value) => {
              setPlayedIn(value);
              setPage(1);
            }}
            options={PLAY_IN_OPTIONS}
          />
        ),
        render: (row) => display(row.played),
      },
      {
        id: 'account',
        label: 'Account',
        filter: (
          <ColumnSearch
            value={draft.accountNumber}
            onChange={setDraftField('accountNumber')}
            onSearch={search}
            placeholder="Search account"
          />
        ),
        render: (row) => display(row.accountNumber),
      },
      {
        id: 'aadhar',
        label: 'Aadhar',
        filter: (
          <ColumnSearch
            value={draft.aadhaarNumber}
            onChange={setDraftField('aadhaarNumber')}
            onSearch={search}
            placeholder="Search aadhar"
          />
        ),
        render: (row) => display(row.aadhaarNumber),
      },
    );

    if (!hideContact) {
      cols.push({
        id: 'email',
        label: 'Email',
        filter: (
          <ColumnSearch
            value={draft.email}
            onChange={setDraftField('email')}
            onSearch={search}
            placeholder="Search email"
          />
        ),
        render: (row) => (canShowMobile ? display(row.email) : '**********'),
      });
    }

    cols.push(
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
      { id: 'device', label: 'Device', render: (row) => display(row.deviceType) },
      { id: 'balance', label: 'Balance', render: (row) => Math.floor(Number(row.balance) || 0) },
      {
        id: 'playerAppVersion',
        label: 'User App Version',
        render: (row) => display(row.currentAppVersion),
      },
      {
        id: 'appVersion',
        label: 'App Version',
        render: (row) => display(appVersions[row.clientName || '']),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) =>
          row.activeUser
            ? `${formatDisplayDate(row.activeUser)} | ${formatDisplayTime(row.activeUser)}`
            : '—',
      },
      {
        id: 'date',
        label: 'Date',
        render: (row) => (row.createdOn ? formatDisplayDate(row.createdOn) : '—'),
      },
      {
        id: 'time',
        label: 'Time',
        render: (row) => (row.createdOn ? formatDisplayTime(row.createdOn) : '—'),
      },
    );

    return cols;
  }, [
    page,
    itemsPerPage,
    draft,
    search,
    canShowMobile,
    hideContact,
    clientName,
    playedIn,
    appVersions,
    setDraftField,
    openUserReport,
  ]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>
          Todays Active
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
        emptyMessage="No active users found"
        stickyHeader
        dense
        minWidth={1800}
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
