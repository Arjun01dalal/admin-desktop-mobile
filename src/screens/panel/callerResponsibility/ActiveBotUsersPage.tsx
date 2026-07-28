import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatDisplayDate, todayIST } from '@/utils/dates';
import type { CallerRow } from './constants';

type NavState = {
  activeBotUsers?: CallerRow[];
  startDate?: string;
  endDate?: string;
};

export function ActiveBotUsersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const nav = (location.state || {}) as NavState;

  const [startDate, setStartDate] = useState(() => nav.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => nav.endDate || todayIST());
  const [rows, setRows] = useState<CallerRow[]>(() => nav.activeBotUsers || []);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<{ users?: CallerRow[]; total?: number }>(
        'caller.activeUsersFromCalls',
        { startDate, endDate },
      );
      if (!res.ok) {
        toast.error(res.message || 'Failed to load bot users');
        return;
      }
      setRows(res.data?.users || []);
      setTotal(Number(res.data?.total ?? res.data?.users?.length ?? 0));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo<CommonTableColumn<CallerRow>[]>(
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
        render: (r) => (
          <CopyText value={String(r.mobile || r.userMobile || '')} />
        ),
      },
      {
        id: 'app',
        label: 'App',
        render: (r) => String(r.clientName || r.appName || '-'),
      },
      {
        id: 'created',
        label: 'Created',
        render: (r) => formatDisplayDate(r.createdAt),
      },
    ],
    [],
  );

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
        <Typography variant="h5" fontWeight={700}>
          Active Bot Users ({total || rows.length})
        </Typography>
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

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(r, i) => String(r._id || r.userId || i)}
        loading={loading}
        emptyMessage="No bot users"
        minWidth={800}
      />
    </Box>
  );
}
