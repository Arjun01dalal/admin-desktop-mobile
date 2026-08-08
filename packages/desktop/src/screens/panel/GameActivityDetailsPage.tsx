import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount } from '@/utils/dates';
import { providerLabel, type ActivityRow } from './gameActivity/utils';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type GameRow = Record<string, unknown>;

type DetailsState = {
  data?: ActivityRow;
  isQtech?: boolean;
};

function gameName(game: GameRow): string {
  return String(game.Name || game.name || game.gameId || '-');
}

export function GameActivityDetailsPage() {
  useRevealCodes();
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;
  const provider = state.data;
  const isQtech = Boolean(state.isQtech);
  const games = useMemo(
    () => (Array.isArray(provider?.games) ? (provider!.games as GameRow[]) : []),
    [provider],
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
        render: (row) => gameName(row),
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
    [isQtech],
  );

  if (!provider) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          {toDisplayText('Game Activity Details')}
        </Typography>
        <Paper sx={{ p: 2, bgcolor: '#1a1a1f' }}>
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

      <CommonTable
        columns={columns}
        rows={games}
        getRowKey={(row, i) => String(row.gameId || row.Name || i)}
        emptyMessage="No games for this provider"
        minWidth={900}
      />
    </Box>
  );
}
