import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { todayIST } from '@/utils/dates';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import {
  QTECH_USER_STATS_PROVIDER,
  buildUserStatsByGamePayload,
  extractUserStatsList,
  formatGameDisplay,
  formatGameUserStatNumber,
  gameUserStatBet,
  gameUserStatBetCount,
  gameUserStatGgr,
  gameUserStatRtp,
  gameUserStatUserId,
  gameUserStatUserName,
  gameUserStatWin,
  gameUserStatWinCount,
  nextGameUserStatsSort,
  sortArrowFor,
  sortGameUserStats,
  summarizeGameUserStats,
  type GameUserStatRow,
  type GameUserStatsSortConfig,
  type GameUserStatsSortKey,
} from '@astro/shared/gameUserStats';

type LocationState = {
  gameId?: string;
  gameName?: string;
  startDate?: string;
  endDate?: string;
};

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%', bgcolor: 'background.paper' }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} sx={{ color, mt: 0.5 }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function GameUserStatsPage() {
  useRevealCodes();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;

  const gameId = String(state.gameId || '').trim();
  const gameDisplay = formatGameDisplay(state.gameName || gameId);

  const [startDate, setStartDate] = useState(() => state.startDate || todayIST());
  const [endDate, setEndDate] = useState(() => state.endDate || todayIST());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<GameUserStatRow[]>([]);
  const [sort, setSort] = useState<GameUserStatsSortConfig>({
    key: 'ggr',
    direction: 'asc',
  });

  const load = useCallback(async () => {
    if (!gameId) {
      toast.error('Game ID missing');
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const payload = buildUserStatsByGamePayload(gameId, startDate, endDate);
      const res = await secureApi('game.userStatsByGame', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to load user stats');
        setRows([]);
        return;
      }
      setRows(extractUserStatsList(res.data));
    } finally {
      setLoading(false);
    }
  }, [gameId, startDate, endDate]);

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => sortGameUserStats(rows, sort), [rows, sort]);
  const summary = useMemo(() => summarizeGameUserStats(rows), [rows]);

  const toggleSort = useCallback((key: GameUserStatsSortKey) => {
    setSort((prev) => nextGameUserStatsSort(prev, key));
  }, []);

  const copyUserId = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('User ID copied');
    } catch {
      toast.error('Copy failed');
    }
  }, []);

  const openUserReport = useCallback(
    (item: GameUserStatRow) => {
      const userId = gameUserStatUserId(item);
      if (userId === '—') return;
      const userName = gameUserStatUserName(item);
      navigate(`/users/report/${encodeURIComponent(userId)}/${encodeURIComponent(userName)}`);
    },
    [navigate],
  );

  const columns = useMemo<CommonTableColumn<GameUserStatRow>[]>(() => {
    const sortable = (
      key: GameUserStatsSortKey,
      label: string,
    ): Pick<CommonTableColumn<GameUserStatRow>, 'label' | 'sortable' | 'onHeaderClick'> => ({
      label: `${label} ${sortArrowFor(sort, key)}`,
      sortable: true,
      onHeaderClick: () => toggleSort(key),
    });

    return [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_row, index) => index + 1,
      },
      {
        id: 'userId',
        label: 'User ID',
        render: (row) => {
          const userId = gameUserStatUserId(row);
          return (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ maxWidth: 220 }}>
              <Box
                component="span"
                title={userId}
                onClick={() => openUserReport(row)}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: 'primary.main',
                  textDecoration: 'underline',
                  cursor: userId === '—' ? 'default' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {userId}
              </Box>
              {userId !== '—' ? (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyUserId(userId);
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'betAmount',
        ...sortable('betAmount', 'Bet Amount'),
        align: 'right',
        render: (row) => formatGameUserStatNumber(gameUserStatBet(row)),
      },
      {
        id: 'betCount',
        ...sortable('betCount', 'Bet Count'),
        align: 'right',
        render: (row) => formatGameUserStatNumber(gameUserStatBetCount(row), 0),
      },
      {
        id: 'winAmount',
        ...sortable('winAmount', 'Win Amount'),
        align: 'right',
        render: (row) => formatGameUserStatNumber(gameUserStatWin(row)),
      },
      {
        id: 'winCount',
        ...sortable('winCount', 'Win Count'),
        align: 'right',
        render: (row) => formatGameUserStatNumber(gameUserStatWinCount(row), 0),
      },
      {
        id: 'rtp',
        ...sortable('rtp', 'RTP'),
        align: 'right',
        render: (row) => formatGameUserStatNumber(gameUserStatRtp(row)),
      },
      {
        id: 'ggr',
        ...sortable('ggr', 'GGR'),
        align: 'right',
        render: (row) => {
          const ggr = gameUserStatGgr(row);
          return (
            <Box component="span" sx={{ color: ggr < 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
              {formatGameUserStatNumber(ggr)}
            </Box>
          );
        },
      },
    ];
  }, [sort, toggleSort, openUserReport, copyUserId]);

  if (!gameId) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          {toDisplayText('Game User Stats')}
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Typography color="text.secondary">
            No game selected. Open a game from {toDisplayText('Game Activity Details')}.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={1.5}
          mb={2}
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {gameDisplay.label || toDisplayText('Game User Stats')}
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} mt={1}>
              <Chip size="small" label={`Game ID: ${gameId}`} />
              <Chip size="small" color="primary" label={`Provider: ${QTECH_USER_STATS_PROVIDER}`} />
              <Chip size="small" label={`Users: ${rows.length}`} />
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} alignItems="flex-end">
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 170 }}
          />
          <Button
            variant="contained"
            onClick={() => void load()}
            disabled={loading}
            sx={{ fontWeight: 700, textTransform: 'uppercase' }}
          >
            {loading ? 'Loading…' : 'Apply'}
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr))',
          },
          gap: 1.5,
          mb: 2,
        }}
      >
        <MetricCard
          label="Total Bet"
          value={formatGameUserStatNumber(summary.bet)}
          color="#1d4ed8"
        />
        <MetricCard
          label="Total Win"
          value={formatGameUserStatNumber(summary.win)}
          color="#b45309"
        />
        <MetricCard
          label="Total GGR"
          value={formatGameUserStatNumber(summary.ggr)}
          color={summary.ggr < 0 ? '#dc2626' : '#16a34a'}
        />
        <MetricCard label="Users" value={String(rows.length)} color="#0f766e" />
      </Box>

      {loading && rows.length === 0 ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : (
        <TablePanel>
          <CommonTable
            columns={columns}
            rows={sorted}
            getRowKey={(row, i) => `${gameUserStatUserId(row)}-${i}`}
            loading={loading}
            emptyMessage="No data found"
            minWidth={900}
            maxHeight="100%"
          />
        </TablePanel>
      )}
    </Box>
  );
}
