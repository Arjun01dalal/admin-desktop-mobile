import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';
import { todayIST } from '@/utils/dates';
import { floorNum, toNum } from '@/screens/panel/dashboards/ops/mergeMetrics';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type LocationState = {
  startDate?: string;
  endDate?: string;
};

type GameRow = {
  gameId?: string;
  totalBetAmount?: number;
  totalBets?: number;
  totalWinningAmount?: number;
  totalWinningBets?: number;
  totalCommission?: number;
  totalUsers?: number;
  ggr?: number;
  rtp?: number;
  [key: string]: unknown;
};

type Summary = {
  totalBetAmount?: number;
  totalWinningAmount?: number;
  profit?: number;
  ggr?: number;
};

type BetConstructResponse = {
  byGame?: GameRow[];
  summary?: Summary;
};

/**
 * BetConstruct game-wise GGR — laxminarayan `/betConstructGamesList`
 * (opened from dashboard card, not the `/betConstruct-lists` games CRUD page).
 */
export function BetConstructGamesListPage() {
  const location = useLocation();
  const nav = (location.state || {}) as LocationState;

  const [startDate, setStartDate] = useState(() => nav.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => nav.endDate || todayIST());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<GameRow[]>([]);
  const [summary, setSummary] = useState<Summary>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi<BetConstructResponse>('dashboard.betConstructGameWiseGgr', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load BetConstruct GGR');
        setRows([]);
        setSummary({});
        return;
      }
      const byGame = res.data?.byGame ?? [];
      const sum = res.data?.summary ?? {};
      setRows(byGame);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<GameRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_r, i) => i + 1,
      },
      { id: 'gameId', label: 'Game Id', render: (r) => display(r.gameId) },
      {
        id: 'bet',
        label: 'Total Bet Amount',
        render: (r) => floorNum(r.totalBetAmount),
      },
      {
        id: 'bets',
        label: 'No of Bets',
        render: (r) => floorNum(r.totalBets),
      },
      {
        id: 'win',
        label: 'Total Winning Amount',
        render: (r) => floorNum(r.totalWinningAmount),
      },
      {
        id: 'wins',
        label: 'No of Wins',
        render: (r) => floorNum(r.totalWinningBets),
      },
      {
        id: 'commission',
        label: 'Total Commission',
        render: (r) => floorNum(r.totalCommission),
      },
      {
        id: 'users',
        label: 'Total Users',
        render: (r) => floorNum(r.totalUsers),
      },
      {
        id: 'ggr',
        label: 'GGR',
        render: (r) => (
          <Typography
            component="span"
            fontWeight={700}
            color={toNum(r.ggr) < 0 ? 'error.main' : 'success.main'}
          >
            {floorNum(r.ggr)}
          </Typography>
        ),
      },
      { id: 'rtp', label: 'RTP', render: (r) => floorNum(r.rtp) },
    ],
    [],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Budha Details
      </Typography>

      <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="From Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ width: 160 }}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            fullWidth={false}
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            color="warning"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            disabled={loading}
            onClick={() => void load()}
          >
            Apply
          </Button>
        </Stack>

        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap mt={2}>
          <Typography variant="body2" fontWeight={700}>
            {toDisplayText('Total Bet Amount')} : {floorNum(summary.totalBetAmount)}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {toDisplayText('Total Win Amount')} : {floorNum(summary.totalWinningAmount)}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {toDisplayText('Total Profit')} : {floorNum(summary.profit)}
          </Typography>
          <Typography variant="body2" fontWeight={700}>
            {toDisplayText('Total GGR')} : {floorNum(summary.ggr)}
          </Typography>
        </Stack>
      </Paper>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No BetConstruct game data"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
