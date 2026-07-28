import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { getStoredUser, todayIST } from '@/utils/dates';
import type { CallerRow } from './constants';
import type { StoredCallerUser } from './utils';

type NavState = {
  empCode?: string;
  deposit?: number;
  activePlayersECS?: Record<string, unknown>;
};

type DetailRow = CallerRow & { status?: string };

function daysAgoISO(days: number): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000 - days * 86400000);
  return d.toISOString().split('T')[0];
}

export function CallerDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = (location.state || {}) as NavState;
  const empCode = String(nav.empCode || '');
  const user = getStoredUser<StoredCallerUser>();

  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [tab, setTab] = useState('Today');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [counts, setCounts] = useState({
    Today: 0,
    Active: 0,
    Warning: 0,
    Inactive: 0,
  });

  const load = useCallback(async () => {
    if (!empCode) return;
    setLoading(true);
    try {
      const [todayRes, warnRes, aiRes] = await Promise.all([
        secureApi<{ user?: CallerRow[]; count?: number }>('caller.callerActiveToday', {
          empCode,
          filter: {},
          startDate,
          endDate,
        }),
        secureApi<{ items?: CallerRow[]; total?: number }>('caller.nonPerforming', {
          empCode,
          _id: user?._id,
          pageNo: 1,
          itemsPerPage: 1000,
        }),
        secureApi<{ active?: CallerRow[]; inactive?: CallerRow[] }>(
          'caller.callerActiveInactive',
          {
            empCode,
            startDate: daysAgoISO(4),
            endDate: daysAgoISO(1),
            filter: {},
          },
        ),
      ]);

      const todayUsers = Array.isArray(todayRes.data?.user)
        ? todayRes.data!.user!
        : Array.isArray((todayRes.data as CallerRow)?.users)
          ? ((todayRes.data as CallerRow).users as CallerRow[])
          : [];
      const warning = Array.isArray(warnRes.data?.items) ? warnRes.data!.items! : [];
      const active = Array.isArray(aiRes.data?.active) ? aiRes.data!.active! : [];
      const inactive = Array.isArray(aiRes.data?.inactive)
        ? aiRes.data!.inactive!
        : [];

      const combined: DetailRow[] = [
        ...todayUsers.map((u) => ({ ...u, status: 'Today' })),
        ...active.map((u) => ({ ...u, status: 'Active' })),
        ...warning.map((u) => ({ ...u, status: 'Warning' })),
        ...inactive.map((u) => ({ ...u, status: 'Inactive' })),
      ];
      setRows(combined);
      setCounts({
        Today: Number(todayRes.data?.count ?? todayUsers.length),
        Active: active.length,
        Warning: Number(warnRes.data?.total ?? warning.length),
        Inactive: inactive.length,
      });

      if (!todayRes.ok && !warnRes.ok && !aiRes.ok) {
        toast.error('Failed to load caller details');
      }
    } finally {
      setLoading(false);
    }
  }, [empCode, startDate, endDate, user?._id]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => rows.filter((r) => r.status === tab),
    [rows, tab],
  );

  const columns = useMemo<CommonTableColumn<DetailRow>[]>(
    () => [
      { id: '#', label: '#', width: 48, render: (_r, i) => i + 1 },
      {
        id: 'name',
        label: 'Name',
        render: (r) => String(r.name || r.userName || '-'),
      },
      {
        id: 'dp',
        label: 'DP ID',
        render: (r) => <CopyText value={String(r._id || r.userId || '')} />,
      },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) => String(r.mobile || r.userMobile || '-'),
      },
      {
        id: 'app',
        label: 'App',
        render: (r) => String(r.clientName || r.appName || '-'),
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
    ],
    [],
  );

  if (!empCode) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Caller Details
        </Typography>
        <Paper sx={{ p: 2, bgcolor: '#1a1a1f' }}>
          <Typography mb={2} color="text.secondary">
            No caller selected.
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/caller-responsibility')}
          >
            Back
          </Button>
        </Paper>
      </Box>
    );
  }

  const ecs = nav.activePlayersECS || {};

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/caller-responsibility')}
          sx={{ flexShrink: 0 }}
        >
          Back
        </Button>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Caller Details — {empCode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Deposit: {nav.deposit != null ? Math.round(Number(nav.deposit)) : '-'}
            {' · '}
            E:{String(ecs.E ?? '-')} C:{String(ecs.C ?? '-')} S:{String(ecs.S ?? '-')}
          </Typography>
        </Box>
      </Stack>

      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: { xs: '100%', sm: 170 } }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: { xs: '100%', sm: 170 } }}
          />
          <Button variant="contained" onClick={() => void load()} disabled={loading}>
            Apply
          </Button>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      <Tabs
        value={tab}
        onChange={(_e, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 2 }}
      >
        {(['Today', 'Active', 'Warning', 'Inactive'] as const).map((t) => (
          <Tab key={t} value={t} label={`${t} (${counts[t]})`} />
        ))}
      </Tabs>

      <CommonTable
        columns={columns}
        rows={filtered}
        getRowKey={(r, i) => String(r._id || r.userId || i)}
        loading={loading}
        emptyMessage="No users in this tab"
        minWidth={800}
      />
    </Box>
  );
}
