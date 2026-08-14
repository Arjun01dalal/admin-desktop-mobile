import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TableSearchBar } from '@/components/TableSearchBar';
import { createTableFiltersContext } from '@/components/createTableFiltersContext';
import { getStoredUser, formatAmount } from '@/utils/dates';
import {
  DEFAULT_ITEMS_PER_PAGE,
  ITEMS_PER_PAGE_OPTIONS,
} from '@/utils/pagination';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { useSecureQuery } from './useSecureQuery';
import { toNumber } from './format';
import { toDisplayText } from './ops/jyotishMapping';
import { useRevealCodes } from '@/context/useRevealCodes';

type PLRow = {
  _id: string;
  name?: string;
  mobile?: number | string;
  balance?: number;
  deposite?: number;
  betAmount?: number;
  totalProfit?: number;
  withdrawl?: number;
  bonus?: number;
};

type PLResponse = {
  count?: number;
  data?: PLRow[];
  payload?: { count?: number; data?: PLRow[] };
};

type DraftFilters = {
  searchId: string;
  searchName: string;
  searchMobile: string;
};

type ProfitLossFiltersValue = {
  draft: DraftFilters;
  setDraft: (key: keyof DraftFilters, value: string) => void;
  onSearch: () => void;
};

const { Provider: ProfitLossFiltersProvider, useFilters: useProfitLossFilters } =
  createTableFiltersContext<ProfitLossFiltersValue>('ProfitLossFilters');

const PAGE_SIZES = ITEMS_PER_PAGE_OPTIONS.filter((s) =>
  ['10', '25', '50', '75', '100'].includes(s),
);

function fmt(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return String(formatAmount(n));
}

function UserIdFilter() {
  const { draft, setDraft, onSearch } = useProfitLossFilters();
  return (
    <TableSearchBar
      value={draft.searchId}
      placeholder="Search by user id"
      width={130}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft('searchId', e.target.value)}
      onSearch={onSearch}
    />
  );
}

function UserNameFilter() {
  const { draft, setDraft, onSearch } = useProfitLossFilters();
  return (
    <TableSearchBar
      value={draft.searchName}
      placeholder="Search by name"
      width={130}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft('searchName', e.target.value)}
      onSearch={onSearch}
    />
  );
}

function MobileFilter() {
  const { draft, setDraft, onSearch } = useProfitLossFilters();
  return (
    <TableSearchBar
      value={draft.searchMobile}
      placeholder="Search by mobile"
      width={130}
      onChange={(e: ChangeEvent<HTMLInputElement>) =>
        setDraft('searchMobile', e.target.value)
      }
      onSearch={onSearch}
    />
  );
}

/** Profit & Loss — CommonTable + TableSearchBar + MUI Pagination (same as other panel pages). */
export function ProfitLossPage() {
  const admin = getStoredUser<{ Responsibilities?: string[] }>();
  const canShowMobile =
    !Array.isArray(admin?.Responsibilities) ||
    admin.Responsibilities.length === 0 ||
    admin.Responsibilities.includes(RESP_SHOW_MOBILE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [draft, setDraftState] = useState<DraftFilters>({
    searchId: '',
    searchName: '',
    searchMobile: '',
  });
  const [filter, setFilter] = useState<Record<string, string>>({});

  const payload = useMemo(
    () => ({ pageSize, pageNumber: page, filter }),
    [pageSize, page, filter],
  );

  const { data, loading, error, refetch } = useSecureQuery<PLResponse>(
    'profitLoss.list',
    payload,
  );

  const body = data?.payload ?? data;
  const rows: PLRow[] = Array.isArray(body?.data) ? body!.data! : [];
  const deferredRows = useDeferredValue(rows);
  const count = toNumber(body?.count) ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize) || 1);

  const setDraft = useCallback((key: keyof DraftFilters, value: string) => {
    setDraftState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFilter = useCallback(() => {
    const next: Record<string, string> = {};
    if (draft.searchId.trim()) next._id = draft.searchId.trim();
    if (draft.searchName.trim()) next.name = draft.searchName.trim();
    if (draft.searchMobile.trim()) next.mobile = draft.searchMobile.trim();
    setPage(1);
    setFilter(next);
  }, [draft]);

  const filtersValue = useMemo<ProfitLossFiltersValue>(
    () => ({ draft, setDraft, onSearch: applyFilter }),
    [draft, setDraft, applyFilter],
  );

  const { active: revealActive } = useRevealCodes();

  const columns = useMemo<CommonTableColumn<PLRow>[]>(
    () => [
      {
        id: 'sr',
        label: '#',
        width: 56,
        filter: null,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'userId',
        label: (
          <>
            User
            <br />
            ID
          </>
        ),
        filter: <UserIdFilter />,
        render: (row) => (row._id ? <CopyText value={row._id} /> : '—'),
      },
      {
        id: 'name',
        label: (
          <>
            User
            <br />
            Name
          </>
        ),
        filter: <UserNameFilter />,
        render: (row) => row.name || '—',
      },
      {
        id: 'mobile',
        label: (
          <>
            Mobile
            <br />
            No
          </>
        ),
        filter: <MobileFilter />,
        render: (row) => (canShowMobile ? (row.mobile ?? '—') : '**********'),
      },
      {
        id: 'startBalance',
        label: (
          <>
            Start
            <br />
            Balance
          </>
        ),
        render: (row) => fmt(row.balance),
      },
      {
        id: 'deposite',
        label: toDisplayText('Deposit'),
        render: (row) => fmt(row.deposite),
      },
      {
        id: 'betAmount',
        label: toDisplayText('Panja'),
        render: (row) => fmt(row.betAmount),
      },
      {
        id: 'winAmount',
        label: toDisplayText('Jaya'),
        render: (row) => fmt(row.totalProfit),
      },
      {
        id: 'withdraw',
        label: toDisplayText('Refund'),
        render: (row) => fmt(row.withdrawl),
      },
      {
        id: 'bonus',
        label: toDisplayText('Bonus'),
        render: (row) => fmt(row.bonus ?? 0),
      },
      {
        id: 'endBalance',
        label: (
          <>
            End
            <br />
            Balance
          </>
        ),
        render: (row) => fmt(row.balance),
      },
    ],
    [page, pageSize, canShowMobile, revealActive],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={2}
        mb={2}
        sx={{ width: '100%' }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Profit & Loss
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Per-user balances, Panja, deposits and refunds.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ width: 140, flexShrink: 0 }}
          >
            {PAGE_SIZES.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />
            }
            onClick={() => void refetch()}
            disabled={loading}
            sx={{ flexShrink: 0 }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ProfitLossFiltersProvider value={filtersValue}>
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(row, i) => row._id || i}
          loading={loading}
          emptyMessage="No records found"
          stickyHeader
          dense
          maxHeight="calc(100vh - 235px)"
        />
      </ProfitLossFiltersProvider>

      <Stack alignItems="center" mt={2} spacing={1}>
        <Pagination
          count={totalPages}
          page={page}
          color="primary"
          onChange={(_e, nextPage) => setPage(nextPage)}
          disabled={loading}
        />
        <Typography variant="caption" color="text.secondary">
          {count > 0
            ? `${count.toLocaleString()} records · page ${page} of ${totalPages.toLocaleString()}`
            : 'No records'}
        </Typography>
      </Stack>
    </Box>
  );
}
