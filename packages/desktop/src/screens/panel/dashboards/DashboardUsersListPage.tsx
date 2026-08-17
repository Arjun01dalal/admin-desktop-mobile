import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { asPaged, display, maskMobile } from '@/screens/panel/shared';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { formatAmount, todayIST } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';

type Mode = 'balance' | 'bonus' | 'registered';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  email?: string;
  balance?: number;
  bonusBalance?: number;
  clientName?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  createdOn?: string;
  [key: string]: unknown;
};

const META: Record<
  Mode,
  { title: string; action: SecureAction; decreasing?: boolean }
> = {
  balance: {
    title: 'Total Users Balance',
    action: 'users.getAllBalance',
    decreasing: true,
  },
  bonus: {
    title: 'Total Users Bonus Balance',
    action: 'users.getAllBonus',
  },
  registered: {
    title: 'Total Registered Users App Today',
    action: 'users.registeredUser',
  },
};

type Props = { mode: Mode };

/**
 * Shared list for dashboard KPI deep-links (balance / bonus / registered app today).
 */
export function DashboardUsersListPage({ mode }: Props) {
  const meta = META[mode];
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBalance, setTotalBalance] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
        itemsPerPage: pageSize,
        pageNo: page,
        filter: {},
      };
      if (meta.decreasing) payload.decreasing = true;
      if (appClientName) {
        (payload.filter as Record<string, unknown>).clientName = appClientName;
      }

      const res = await secureApi(meta.action, payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load users');
        setRows([]);
        return;
      }

      const paged = asPaged<UserRow>(res.data);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages || 1));

      const envelope =
        res.data && typeof res.data === 'object'
          ? (res.data as Record<string, unknown>)
          : {};
      const total =
        Number(
          envelope.totalBalance ??
            envelope.totalBonusBalance ??
            envelope.total ??
            0,
        ) || 0;
      setTotalBalance(total);
    } finally {
      setLoading(false);
    }
  }, [appClientName, endDate, meta.action, meta.decreasing, page, pageSize, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<UserRow>[]>(() => {
    const cols: CommonTableColumn<UserRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_r, i) => (page - 1) * pageSize + i + 1,
      },
      { id: 'name', label: 'Name', render: (r) => display(r.name) },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) => maskMobile(r.mobile, canShowMobile),
      },
      {
        id: 'app',
        label: 'App',
        render: (r) => appCodeForName(r.clientName),
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (r) => formatAmount(r.balance ?? 0),
      },
    ];
    if (mode === 'bonus') {
      cols.push({
        id: 'bonus',
        label: 'Bonus Balance',
        render: (r) => formatAmount(r.bonusBalance ?? 0),
      });
    }
    cols.push(
      { id: 'city', label: 'City', render: (r) => display(r.city) },
      { id: 'state', label: 'State', render: (r) => display(r.state) },
    );
    return cols;
  }, [canShowMobile, mode, page, pageSize]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel
        title={toDisplayText(meta.title)}
        summary={`${startDate} → ${endDate}`}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            type="date"
            label="From"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            sx={{ width: 160 }}
          />
          <TextField
            type="date"
            label="To"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            sx={{ width: 160 }}
          />
          <TextField
            select
            label="App"
            size="small"
            fullWidth={false}
            value={appClientName}
            onChange={(e) => {
              setAppClientName(e.target.value);
              setPage(1);
            }}
            sx={{ width: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Per page"
            size="small"
            fullWidth={false}
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ width: 120 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={String(n)}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            color="warning"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </Button>
          {totalBalance > 0 && (
            <Typography variant="body2" fontWeight={700}>
              Total: ₹{formatAmount(totalBalance)}
            </Typography>
          )}
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel
        footer={
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
          />
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No users"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}

export function BalanceUsersPage() {
  return <DashboardUsersListPage mode="balance" />;
}

export function BonusBalanceUsersPage() {
  return <DashboardUsersListPage mode="bonus" />;
}

export function RegisteredUsersAppPage() {
  return <DashboardUsersListPage mode="registered" />;
}
