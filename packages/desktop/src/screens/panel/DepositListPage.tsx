import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import {
  formatDisplayDate,
  formatDisplayTime,
  getStoredUser,
} from '@/utils/dates';
import {
  DEFAULT_ITEMS_PER_PAGE,
  ITEMS_PER_PAGE_OPTIONS,
} from '@/utils/pagination';
import { display, displayRaw } from '@/screens/panel/shared';

type MidTotal = { mid?: string; amount?: number; count?: number };

type DepositListRow = {
  name?: string;
  userId?: string;
  mobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
  activeUser?: string;
  approvedDepositAmount?: number;
  approvedWithdrawalAmount?: number;
  approvedDepositCount?: number;
  approvedWithdrawalCount?: number;
  approvedDepositAmountByMid?: MidTotal[];
  approvedWithdrawalAmountByMid?: MidTotal[];
};

type ColumnFilters = {
  name: string;
  userId: string;
  mobile: string;
  city: string;
  state: string;
  clientName: string;
  lastActivity: string;
};

type QueryState = {
  startDate: string;
  endDate: string;
  mid: string;
  filters: ColumnFilters;
};

const EMPTY_FILTERS: ColumnFilters = {
  name: '',
  userId: '',
  mobile: '',
  city: '',
  state: '',
  clientName: '',
  lastActivity: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  '&:hover': { bgcolor: '#e08c00' },
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

function withdrawalPct(deposit?: number, withdrawal?: number): string {
  if (!deposit) return '0';
  return ((Number(withdrawal || 0) / Number(deposit)) * 100).toFixed(2);
}

function midStorageKey(): string {
  return 'depositList.midName';
}

export function DepositListPage() {
  const navigate = useNavigate();
  const canShowMobile = hasPermission(Permissions.show_mobile);
  const user = getStoredUser<{ Responsibilities?: string[] }>();

  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DepositListRow[]>([]);
  const [totals, setTotals] = useState<Record<string, unknown> | null>(null);
  const [midOptions, setMidOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState<ColumnFilters>(EMPTY_FILTERS);
  const [query, setQuery] = useState<QueryState>({
    startDate: '',
    endDate: '',
    mid: localStorage.getItem(midStorageKey()) ?? '',
    filters: EMPTY_FILTERS,
  });

  const loadMids = useCallback(async () => {
    const res = await secureApi('depositList.report', {
      itemsPerPage: 1,
      pageNo: 1,
      filter: {
        name: '',
        mobile: '',
        city: '',
        state: '',
        userId: '',
        clientName: '',
      },
    });
    if (!res.ok) return;
    const payload = unpackPayload(res.data);
    const midWise = Array.isArray(payload.midWiseTotals)
      ? (payload.midWiseTotals as MidTotal[])
      : [];
    setMidOptions(
      midWise.map((m) => String(m.mid || '')).filter(Boolean),
    );
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        itemsPerPage,
        pageNo: page,
        filter: {
          name: query.filters.name,
          mobile: query.filters.mobile,
          city: query.filters.city,
          state: query.filters.state,
          userId: query.filters.userId,
          clientName: query.filters.clientName,
          mid: query.mid,
        },
      };
      if (query.startDate && query.endDate) {
        body.startDate = query.startDate;
        body.endDate = query.endDate;
      }
      const res = await secureApi('depositList.report', body);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load deposit list');
        setRows([]);
        return;
      }
      const payload = unpackPayload(res.data);
      const items = Array.isArray(payload.items)
        ? (payload.items as DepositListRow[])
        : [];
      const sorted = items.slice().sort((a, b) => {
        const dateA = a?.activeUser || '';
        const dateB = b?.activeUser || '';
        return dateB.localeCompare(dateA);
      });
      setRows(sorted);
      setTotalPages(Number(payload.totalPages || 1) || 1);
      setTotals(
        payload.totals && typeof payload.totals === 'object'
          ? (payload.totals as Record<string, unknown>)
          : null,
      );
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, page, query]);

  useEffect(() => {
    void loadMids();
  }, [loadMids]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const commitQuery = useCallback(
    (patch?: Partial<QueryState>) => {
      setPage(1);
      setQuery((prev) => ({
        ...prev,
        ...patch,
        filters: patch?.filters ?? draft,
      }));
    },
    [draft],
  );

  const onDraftChange =
    (key: keyof ColumnFilters) => (e: ChangeEvent<HTMLInputElement>) => {
      setDraft((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const clearDates = () => {
    localStorage.removeItem(midStorageKey());
    setQuery((prev) => ({
      ...prev,
      startDate: '',
      endDate: '',
      mid: '',
    }));
    setPage(1);
  };

  const openMidBreakdown = (data?: MidTotal[]) => {
    if (!data?.length) return;
    navigate('/depositList/user-wise', { state: { data } });
  };

  const columns = useMemo<CommonTableColumn<DepositListRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        filter: (
          <TableSearchBar
            value={draft.name}
            onChange={onDraftChange('name')}
            onSearch={() => commitQuery()}
            placeholder="Search by Name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'userId',
        label: 'User Id',
        filter: (
          <TableSearchBar
            value={draft.userId}
            onChange={onDraftChange('userId')}
            onSearch={() => commitQuery()}
            placeholder="Search by DP Id"
          />
        ),
        render: (row) => display(row.userId),
      },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <TableSearchBar
            value={draft.mobile}
            onChange={onDraftChange('mobile')}
            onSearch={() => commitQuery()}
            placeholder="Search by Mobile"
          />
        ),
        render: (row) =>
          canShowMobile || user?.Responsibilities?.includes(Permissions.show_mobile)
            ? display(row.mobile)
            : '**********',
      },
      {
        id: 'city',
        label: 'City',
        filter: (
          <TableSearchBar
            value={draft.city}
            onChange={onDraftChange('city')}
            onSearch={() => commitQuery()}
            placeholder="Search by City"
          />
        ),
        render: (row) => display(row.city),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <TableSearchBar
            value={draft.state}
            onChange={onDraftChange('state')}
            onSearch={() => commitQuery()}
            placeholder="Search by State"
          />
        ),
        render: (row) => display(row.state),
      },
      {
        id: 'clientName',
        label: 'Client Name',
        filter: (
          <TableSearchBar
            value={draft.clientName}
            onChange={onDraftChange('clientName')}
            onSearch={() => commitQuery()}
            placeholder="Search by App Name"
          />
        ),
        render: (row) => displayRaw(row.clientName),
      },
      {
        id: 'lastActivity',
        label: (
          <>
            Last Activity
            <br />
            date
          </>
        ),
        filter: (
          <TableSearchBar
            value={draft.lastActivity}
            onChange={onDraftChange('lastActivity')}
            onSearch={() => commitQuery()}
            placeholder="Search by Last Activity"
          />
        ),
        render: (row) => {
          if (!row.activeUser) return '-';
          return `${formatDisplayDate(row.activeUser)}- ${formatDisplayTime(row.activeUser)}`;
        },
      },
      {
        id: 'ratio',
        label: 'Ratio',
        render: (row) =>
          withdrawalPct(row.approvedDepositAmount, row.approvedWithdrawalAmount),
      },
      {
        id: 'dwRatio',
        label: (
          <>
            Deposit
            <br />
            Withdrawal Ratio
          </>
        ),
        render: (row) =>
          Number(row.approvedDepositAmount || 0) -
          Number(row.approvedWithdrawalAmount || 0),
      },
      {
        id: 'depositDetails',
        label: (
          <>
            Deposit
            <br />
            Details
          </>
        ),
        render: (row) => (
          <Box
            onClick={() => openMidBreakdown(row.approvedDepositAmountByMid)}
            sx={{
              cursor: row.approvedDepositAmountByMid?.length
                ? 'pointer'
                : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
            }}
          >
            <span>Approved Amt:- {row.approvedDepositAmount ?? 0}</span>
            <span>Count:- {row.approvedDepositCount ?? 0}</span>
          </Box>
        ),
      },
      {
        id: 'withdrawalDetails',
        label: (
          <>
            Withdrawal
            <br />
            Details
          </>
        ),
        render: (row) => (
          <Box
            onClick={() => openMidBreakdown(row.approvedWithdrawalAmountByMid)}
            sx={{
              cursor: row.approvedWithdrawalAmountByMid?.length
                ? 'pointer'
                : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
            }}
          >
            <span>Withdrawal Amt:- {row.approvedWithdrawalAmount ?? 0}</span>
            <span>Count:-{row.approvedWithdrawalCount ?? 0}</span>
          </Box>
        ),
      },
    ],
    [
      page,
      itemsPerPage,
      draft,
      commitQuery,
      canShowMobile,
      user,
    ],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Deposit List
      </Typography>

      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1.5}
        alignItems="center"
        mb={2}
        sx={{ '& > *': { flexShrink: 0 } }}
      >
        <TextField
          fullWidth={false}
          size="small"
          type="date"
          label="From Date"
          InputLabelProps={{ shrink: true }}
          value={query.startDate}
          onChange={(e) =>
            setQuery((prev) => ({ ...prev, startDate: e.target.value }))
          }
          sx={{ width: 160 }}
        />
        <TextField
          fullWidth={false}
          size="small"
          type="date"
          label="To Date"
          InputLabelProps={{ shrink: true }}
          value={query.endDate}
          onChange={(e) =>
            setQuery((prev) => ({ ...prev, endDate: e.target.value }))
          }
          sx={{ width: 160 }}
        />
        <Button onClick={clearDates} sx={orangeBtnSx}>
          Clear
        </Button>
        <Typography fontWeight={700} whiteSpace="nowrap">
          Deposit Amt:- {String(totals?.totalDepositAmount ?? 0)}
        </Typography>
        <Typography fontWeight={700} whiteSpace="nowrap">
          Withdrawal Amt:- {String(totals?.totalWithdrawalAmount ?? 0)}
        </Typography>
        <TextField
          fullWidth={false}
          select
          size="small"
          label="Select Mid"
          value={query.mid}
          onChange={(e) => {
            const mid = e.target.value;
            localStorage.setItem(midStorageKey(), mid);
            setPage(1);
            setQuery((prev) => ({ ...prev, mid }));
          }}
          sx={{ width: 140, ...filterSelectSx }}
        >
          <MenuItem value="">All</MenuItem>
          {midOptions.map((mid) => (
            <MenuItem key={mid} value={mid}>
              {mid}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth={false}
          select
          size="small"
          label="Items Per Page"
          value={String(itemsPerPage)}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setPage(1);
          }}
          sx={{ width: 130, ...filterSelectSx }}
        >
          {ITEMS_PER_PAGE_OPTIONS.map((n) => (
            <MenuItem key={n} value={String(n)}>
              {n}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Typography fontWeight={600} mb={1}>
        Details List
      </Typography>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row, i) => String(row.userId || i)}
        loading={loading}
        emptyMessage="No data"
        minWidth={1200}
      />

      {totalPages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination
            count={totalPages}
            page={page}
            color="secondary"
            onChange={(_e, next) => setPage(next)}
          />
        </Stack>
      )}
    </Box>
  );
}
