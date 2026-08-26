import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { formatAmount, todayIST } from '@/utils/dates';
import { providerLabel, type ActivityRow } from './gameActivity/utils';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { resolveGameId, resolveGameName } from '@astro/shared/gameUserStats';

type GameRow = Record<string, unknown>;

type DetailsState = {
  data?: ActivityRow;
  isQtech?: boolean;
  startDate?: string;
  endDate?: string;
};

function gameName(game: GameRow): string {
  return String(game.Name || game.name || game.gameId || '-');
}

export function GameActivityDetailsPage() {
  useRevealCodes();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;
  const provider = state.data;
  const isQtech = Boolean(state.isQtech);
  const startDate = state.startDate || todayIST();
  const endDate = state.endDate || todayIST();
  const games = useMemo(
    () => (Array.isArray(provider?.games) ? (provider!.games as GameRow[]) : []),
    [provider],
  );

  const openUserStats = useCallback(
    (game: GameRow) => {
      if (!isQtech) return;
      const gameId = resolveGameId(game);
      if (!gameId) return;
      navigate('/game-activity/user-stats', {
        state: {
          gameId,
          gameName: resolveGameName(game),
          startDate,
          endDate,
        },
      });
    },
    [isQtech, navigate, startDate, endDate],
  );

  const columns = useMemo<CommonTableColumn<GameRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_row, index) => index,
      },
      {
        id: 'gameName',
        label: 'Game Name',
        render: (row) =>
          isQtech ? (
            <Box
              component="span"
              onClick={() => openUserStats(row)}
              sx={{
                color: 'primary.main',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {gameName(row)}
            </Box>
          ) : (
            gameName(row)
          ),
      },
      {
        id: 'betAmount',
        label: 'Bet Amount',
        render: (row) => formatAmount(row.totalBetAmount ?? row.betAmount),
      },
      {
        id: 'betCount',
        label: 'Bet Count',
        render: (row) => formatAmount(row.betCount),
      },
      {
        id: 'commissionAmount',
        label: 'Commission Amount',
        render: (row) => formatAmount(row.commissionAmount),
      },
      {
        id: 'commissionCount',
        label: 'Commission Count',
        render: (row) => formatAmount(row.commissionCount ?? 0),
      },
      {
        id: 'rtp',
        label: 'RTP',
        render: (row) => formatAmount(row.rtp),
      },
      {
        id: 'ggr',
        label: 'GGR',
        render: (row) => {
          const bet = Number(row.totalBetAmount ?? row.betAmount ?? 0);
          const win = Number(row.totalWinAmount ?? row.winAmount ?? 0);
          const ggr = bet - win;
          return (
            <Box
              component="span"
              sx={{ color: ggr < 0 ? '#e53935' : '#43a047', fontWeight: 600 }}
            >
              {formatAmount(ggr)}
            </Box>
          );
        },
      },
      ...(isQtech
        ? [
            {
              id: 'totalRate',
              label: 'Total Rate',
              render: (row: GameRow) => formatAmount(row.totalRate ?? 0),
            } satisfies CommonTableColumn<GameRow>,
          ]
        : []),
      {
        id: 'winAmount',
        label: 'Win Amount',
        render: (row) => formatAmount(row.totalWinAmount ?? row.winAmount),
      },
      {
        id: 'winCount',
        label: 'Win Count',
        render: (row) => formatAmount(row.winCount),
      },
    ],
    [isQtech, openUserStats],
  );

  if (!provider) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          {toDisplayText('Game Activity Details')}
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            No provider selected. Open a provider from {toDisplayText('Games Activity')}.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {providerLabel(provider)} — Games
      </Typography>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={games}
          getRowKey={(row, i) => String(row.gameId || row.Name || i)}
          emptyMessage="No games for this provider"
          minWidth={900}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
