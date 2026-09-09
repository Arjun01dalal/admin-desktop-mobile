import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { secureApi } from '@/api/secureClient';
import { canShowMyCoinHistory, getSessionUser, hasPermission } from '@/auth/permissions';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { todayIST } from '@/utils/dates';
import { asList, unpackPayload } from '@astro/shared/api';
import { toast } from 'react-toastify';

type HistoryRow = {
  _id?: string;
  userName?: string;
  userMobile?: string;
  clientName?: string;
  state?: string;
  city?: string;
  openingSubadminBalance?: string | number;
  balance?: string | number;
  closingSubadminBalance?: string | number;
  reason?: string;
  remark?: string;
  tag?: string;
  createdOn?: string;
};

type SummaryRow = {
  name?: string;
  totalBalance?: string | number;
  count?: string | number;
};

function payloadList<T>(data: unknown): T[] {
  const unpacked = unpackPayload(data);
  return asList<T>(unpacked ?? data);
}

/**
 * Laxmi ShowCoinHistory — gated by User.data.showCoins.
 * Loads history + cumulative in parallel; coin limit refresh is separate.
 */
export function ShowMyCoinHistoryPage() {
  const user = useMemo(() => getSessionUser(), []);
  const allowed = canShowMyCoinHistory(user);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [coinLimit, setCoinLimit] = useState<string | number>('—');
  const [loading, setLoading] = useState(false);
  const [limitLoading, setLimitLoading] = useState(false);
  const deferredRows = useDeferredValue(rows);

  const loadLimit = useCallback(async () => {
    const id = user?._id;
    if (!id) return;
    setLimitLoading(true);
    try {
      const res = await secureApi<unknown>('subadmin.getSubadmin', { _id: id });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load coin limit');
        return;
      }
      const payload = unpackPayload(res.data) as { coinLimit?: string | number } | null;
      const raw = payload && typeof payload === 'object' ? payload : (res.data as { coinLimit?: string | number });
      setCoinLimit(raw?.coinLimit ?? '—');
    } finally {
      setLimitLoading(false);
    }
  }, [user?._id]);

  const load = useCallback(async () => {
    const id = user?._id;
    if (!id) {
      toast.error('User session missing');
      return;
    }
    setLoading(true);
    const body = {
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
      _id: id,
    };
    try {
      const [historyRes, cumulativeRes] = await Promise.all([
        secureApi<unknown>('coin.getSubadminCoinHistory', body),
        secureApi<unknown>('coin.getSubadminCoinHistoryCumulative', body),
      ]);

      if (!historyRes.ok) {
        toast.error(historyRes.message || 'Failed to load coin history');
        setRows([]);
      } else {
        setRows(payloadList<HistoryRow>(historyRes.data));
      }

      if (cumulativeRes.ok) {
        const list = payloadList<SummaryRow>(cumulativeRes.data);
        setSummary(list[0] || null);
      } else {
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user?._id, startDate, endDate]);

  useEffect(() => {
    if (!allowed) return;
    void load();
    void loadLimit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial mount like Laxmi

  const columns = useMemo<CommonTableColumn<HistoryRow>[]>(
    () => [
      {
        id: 'idx',
        label: 'User Id',
        render: (_row, index) => (typeof index === 'number' ? index + 1 : '—'),
      },
      { id: 'userName', label: 'User Name', render: (r) => r.userName || '—' },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (r) => (canShowMobile ? r.userMobile || '—' : '**********'),
      },
      { id: 'app', label: 'App', render: (r) => r.clientName || '—' },
      { id: 'state', label: 'State', render: (r) => r.state || '—' },
      { id: 'city', label: 'City', render: (r) => r.city || '—' },
      {
        id: 'opening',
        label: 'Opening Subadmin Balance',
        render: (r) => String(r.openingSubadminBalance ?? '—'),
      },
      { id: 'amount', label: 'Amount', render: (r) => String(r.balance ?? '—') },
      {
        id: 'closing',
        label: 'Closing Subadmin Balance',
        render: (r) => String(r.closingSubadminBalance ?? '—'),
      },
      { id: 'reason', label: 'Reason', render: (r) => r.reason || '—' },
      { id: 'remark', label: 'Remark', render: (r) => r.remark || '—' },
      { id: 'tag', label: 'Tag', render: (r) => r.tag || '—' },
      { id: 'createdOn', label: 'Created On', render: (r) => r.createdOn || '—' },
    ],
    [canShowMobile],
  );

  if (!allowed) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          You do not have access to Show My Coin History (`showCoins` required).
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6" fontWeight={700}>
        Show My Coin History
      </Typography>

      <CollapsibleFilterPanel title="Filters">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={() => void load()} disabled={loading}>
            Apply
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        flexWrap="wrap"
      >
        <Typography variant="subtitle2" fontWeight={700}>
          Subadmin Coin Limit
        </Typography>
        <Typography variant="body2">
          Coin Limit: <strong>{coinLimit}</strong>
        </Typography>
        <IconButton size="small" onClick={() => void loadLimit()} disabled={limitLoading} aria-label="Refresh coin limit">
          {limitLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </Stack>

      {summary ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          <Typography variant="subtitle2" fontWeight={700} sx={{ width: '100%' }}>
            Coin Summary
          </Typography>
          <Typography variant="body2">
            Name: <strong>{summary.name || '—'}</strong>
          </Typography>
          <Typography variant="body2">
            Amount: <strong>{summary.totalBalance ?? '—'}</strong>
          </Typography>
          <Typography variant="body2">
            Count: <strong>{summary.count ?? '—'}</strong>
          </Typography>
        </Stack>
      ) : null}

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={deferredRows}
          getRowKey={(r, i) => r._id || String(i)}
          loading={loading}
          emptyMessage="No coin history for this date range"
        />
      </TablePanel>
    </Stack>
  );
}
