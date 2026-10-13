import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  flattenActiveBotUsersPayload,
  formatAutomationBotLabel,
  type ActiveBotSummaryItem,
  type ActiveBotUserRow,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { formatDisplayDate, getStoredUser, todayIST } from '@/utils/dates';
import { maskMobile } from '@/screens/panel/shared';
import { RESP_SHOW_MOBILE, type CallerRow } from './constants';
import type { StoredCallerUser } from './utils';

type NavState = {
  activeBotUsers?: ActiveBotUserRow[];
  activeBotUsersCount?: number;
  botSummary?: ActiveBotSummaryItem[];
  startDate?: string;
  endDate?: string;
};

function formatBalance(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function firstBotId(row: ActiveBotUserRow): string {
  const ids = row.botIds;
  if (Array.isArray(ids) && ids.length > 0) return String(ids[0] ?? '-');
  if (ids != null && ids !== '') return String(ids);
  return '-';
}

export function ActiveBotUsersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state || {}) as NavState;
  const user = getStoredUser<StoredCallerUser>();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE, user);
  const hadNavUsers = Array.isArray(nav.activeBotUsers) && nav.activeBotUsers.length > 0;

  const [startDate, setStartDate] = useState(() => nav.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => nav.endDate || todayIST());
  const [rows, setRows] = useState<ActiveBotUserRow[]>(() => nav.activeBotUsers || []);
  const [total, setTotal] = useState(() =>
    Number(nav.activeBotUsersCount ?? nav.activeBotUsers?.length ?? 0),
  );
  const [botSummary, setBotSummary] = useState<ActiveBotSummaryItem[]>(() => nav.botSummary || []);
  const [botFilter, setBotFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const loadGenRef = useRef(0);
  const skippedInitialFetch = useRef(hadNavUsers);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const res = await secureApi('caller.activeUsersFromCallsByAutomationBot', {
        startDate,
        endDate,
      });
      if (gen !== loadGenRef.current) return;
      if (!res.ok) {
        toast.error(res.message || 'Failed to load bot users');
        return;
      }
      const flat = flattenActiveBotUsersPayload(res.data);
      setRows(flat.users);
      setTotal(flat.total);
      setBotSummary(flat.summary);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  // Nav state already has users from Caller Responsibility — skip duplicate fetch.
  // Otherwise fetch once on mount; later loads only via Apply.
  useEffect(() => {
    if (skippedInitialFetch.current) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRows = useMemo(() => {
    if (!botFilter) return rows;
    return rows.filter((r) => String(r.botType || '') === botFilter);
  }, [rows, botFilter]);

  const columns = useMemo<CommonTableColumn<ActiveBotUserRow>[]>(() => {
    const cols: CommonTableColumn<ActiveBotUserRow>[] = [
      { id: 'sr', label: 'SR.No', width: 64, render: (_r, i) => i + 1 },
      {
        id: 'name',
        label: 'Name',
        render: (r) => {
          const name = String(r.name || r.userName || '-');
          const id = String(r._id || r.userId || '');
          if (!id) return name;
          return (
            <Box
              component="span"
              sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
              onClick={() => navigate(`/users/report/${id}/${encodeURIComponent(name)}`)}
            >
              {name}
            </Box>
          );
        },
      },
      {
        id: 'dp',
        label: 'DP ID',
        render: (r) => <CopyText value={String(r._id || r.userId || '')} />,
      },
      {
        id: 'botType',
        label: 'Bot',
        render: (r) => formatAutomationBotLabel(String(r.botType || firstBotId(r))),
      },
      {
        id: 'bot',
        label: 'Bot ID',
        render: (r) => firstBotId(r),
      },
      {
        id: 'app',
        label: 'App Name',
        render: (r) => String(r.clientName || r.appName || '-'),
      },
      {
        id: 'mobile',
        label: 'Mobile No',
        render: (r) => {
          const mob = String(r.mobile || r.userMobile || '');
          if (!mob) return '—';
          if (!canShowMobile) return maskMobile(mob, false);
          return <CopyText value={mob} />;
        },
      },
      {
        id: 'balance',
        label: 'Balance',
        render: (r) => formatBalance(r.balance),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (r) => {
          const raw = r.activeUser ?? r.lastActivity ?? r.updatedOn ?? r.updatedAt;
          return raw ? formatDisplayDate(String(raw)) : '-';
        },
      },
      {
        id: 'city',
        label: 'City',
        render: (r) => String(r.city || '-'),
      },
      {
        id: 'state',
        label: 'State',
        render: (r) => String(r.state || '-'),
      },
    ];
    return cols;
  }, [canShowMobile, navigate]);

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h6" fontWeight={800} sx={{ mr: 1 }}>
            Active Bot Users
          </Typography>
          <Chip size="small" label={`Total: ${total}`} sx={{ fontWeight: 700 }} />
          {botSummary.map((b) => (
            <Chip
              key={b.bot}
              size="small"
              label={`${formatAutomationBotLabel(b.bot)}: ${b.count}`}
              onClick={() => setBotFilter((prev) => (prev === b.bot ? '' : b.bot))}
              color={botFilter === b.bot ? 'primary' : 'default'}
              variant={botFilter === b.bot ? 'filled' : 'outlined'}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap mt={1.5}>
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 170 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 170 }}
          />
          <TextField
            select
            label="Bot filter"
            size="small"
            value={botFilter}
            onChange={(e) => setBotFilter(e.target.value)}
            sx={{ width: 180 }}
          >
            <MenuItem value="">All bots</MenuItem>
            {botSummary.map((b) => (
              <MenuItem key={b.bot} value={b.bot}>
                {formatAutomationBotLabel(b.bot)}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={loading} onClick={() => void load()} sx={{ fontWeight: 700 }}>
            Apply
          </Button>
          {loading ? <CircularProgress size={22} /> : null}
        </Stack>
      </Paper>

      <TablePanel>
        <CommonTable
          columns={columns as CommonTableColumn<CallerRow>[]}
          rows={filteredRows as CallerRow[]}
          getRowKey={(r, i) => String(r._id || r.userId || i)}
          loading={loading}
          emptyMessage="No active bot users"
        />
      </TablePanel>
    </Box>
  );
}
