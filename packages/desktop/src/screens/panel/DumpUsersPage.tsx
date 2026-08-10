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
import UndoIcon from '@mui/icons-material/Undo';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getRoleId, hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { appCodeForName } from '@/constants/clientNames';
import { formatAmount, formatDisplayDate } from '@/utils/dates';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { asPaged, display, maskMobile, useReportQuery } from '@/screens/panel/shared';
import { roleFlags } from '@/screens/panel/callerResponsibility/utils';

type DumpUserRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  balance?: number | string;
  empCode?: string;
  totalDeposit?: number | string;
  city?: string;
  state?: string;
  email?: string;
  dumpReason?: {
    reason?: string;
    name?: string;
    Date?: string;
  };
  [key: string]: unknown;
};

type Filters = { name: string; dpId: string; mobile: string };
const EMPTY_FILTERS: Filters = { name: '', dpId: '', mobile: '' };

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  fontSize: 11,
  lineHeight: 1.2,
  px: 1,
  py: 0.25,
  minWidth: 0,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
  '& .MuiButton-startIcon': { mr: 0.5, '& > *:nth-of-type(1)': { fontSize: 14 } },
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

export function DumpUsersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [undumpingId, setUndumpingId] = useState('');

  const canShowMobile = hasPermission('show_mobile');
  const canOpenUserReport = hasPermission('wallet_history');
  const { isCaller } = roleFlags(getRoleId() || undefined);

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = { dump: true };
    if (appliedFilters.name.trim()) filter.name = appliedFilters.name.trim();
    if (appliedFilters.mobile.trim()) filter.mobile = appliedFilters.mobile.trim();
    if (appliedFilters.dpId.trim()) filter._id = appliedFilters.dpId.trim();
    return { itemsPerPage, pageNo: page, filter };
  }, [page, itemsPerPage, appliedFilters]);

  const unpack = useCallback((res: { data?: unknown }) => asPaged<DumpUserRow>(res.data), []);

  const { rows, total, totalPages, loading, load } = useReportQuery<DumpUserRow>({
    action: 'users.getAll',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage, appliedFilters],
    errorMessage: 'Failed to load dump users',
  });

  const search = useCallback(() => {
    setAppliedFilters(draftFilters);
    setPage(1);
  }, [draftFilters]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) =>
      setDraftFilters((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleUndump = useCallback(
    async (row: DumpUserRow) => {
      setUndumpingId(row._id);
      try {
        const res = await secureApi('ops.dumpUsersUpdate', { _id: row._id, dump: false });
        if (!res.ok) {
          toast.error(res.message || 'Failed to un-dump user');
          return;
        }
        toast.success('User un-dumped');
        void load();
      } finally {
        setUndumpingId('');
      }
    },
    [load],
  );

  const columns = useMemo<CommonTableColumn<DumpUserRow>[]>(() => {
    const cols: CommonTableColumn<DumpUserRow>[] = [
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
            value={draftFilters.name}
            onChange={setDraftField('name')}
            onSearch={search}
            placeholder="Search name"
          />
        ),
        render: (row) => (
          <Stack spacing={0.75} alignItems="center">
            {canOpenUserReport && row._id && row.name ? (
              <Typography
                component="button"
                type="button"
                onClick={() =>
                  navigate(
                    `/users/report/${encodeURIComponent(String(row._id))}/${encodeURIComponent(String(row.name))}`,
                  )
                }
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  color: '#4fc3f7',
                  fontSize: 12,
                  fontWeight: 600,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {display(row.name)}
              </Typography>
            ) : (
              <Typography variant="body2">{display(row.name)}</Typography>
            )}
            <Button
              size="small"
              variant="contained"
              startIcon={<UndoIcon sx={{ fontSize: 14 }} />}
              disabled={undumpingId === row._id}
              onClick={() => void handleUndump(row)}
              sx={orangeBtnSx}
            >
              {undumpingId === row._id ? '…' : 'Un-Dump'}
            </Button>
          </Stack>
        ),
      },
      {
        id: 'dpId',
        label: 'Dp Id',
        filter: (
          <ColumnSearch
            value={draftFilters.dpId}
            onChange={setDraftField('dpId')}
            onSearch={search}
            placeholder="Search dp id"
          />
        ),
        render: (row) => row._id || '—',
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <ColumnSearch
            value={draftFilters.mobile}
            onChange={setDraftField('mobile')}
            onSearch={search}
            placeholder="Search mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'appCode',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => formatAmount(row.balance),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        render: (row) => display(row.empCode),
      },
      {
        id: 'totalDeposit',
        label: 'Total Deposit',
        render: (row) => formatAmount(row.totalDeposit),
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => display(row.city),
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => display(row.state),
      },
      {
        id: 'email',
        label: 'Email',
        render: (row) => display(row.email),
      },
    ];

    if (!isCaller) {
      cols.push({
        id: 'dumpReason',
        label: 'Dump Reason',
        render: (row) => display(row.dumpReason?.reason),
      });
    }

    cols.push({
      id: 'updatedBy',
      label: 'Update By',
      render: (row) => (
        <Stack spacing={0.25} alignItems="center">
          <Typography variant="body2">{display(row.dumpReason?.name)}</Typography>
          {row.dumpReason?.Date ? (
            <Typography variant="caption" color="text.secondary">
              {formatDisplayDate(row.dumpReason.Date)}
            </Typography>
          ) : null}
        </Stack>
      ),
    });

    return cols;
  }, [
    page,
    itemsPerPage,
    draftFilters,
    search,
    setDraftField,
    canShowMobile,
    canOpenUserReport,
    navigate,
    isCaller,
    undumpingId,
    handleUndump,
  ]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1.5}
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          Dump Users
        </Typography>
        <Button
          variant="outlined"
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
          }
          onClick={() => void load()}
          disabled={loading}
          sx={{
            borderColor: 'rgba(255,255,255,0.28)',
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

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={search}
            disabled={loading}
            sx={{ ...orangeBtnSx, flexShrink: 0 }}
          >
            Search
          </Button>
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No dump users found"
        stickyHeader
        dense
        minWidth={1400}
        maxHeight="calc(100vh - 300px)"
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
          disabled={loading}
        />
      </Stack>
    </Box>
  );
}
