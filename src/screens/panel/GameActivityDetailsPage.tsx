import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount } from '@/utils/dates';
import { ACTION_BTN_SX } from './gameActivity/constants';
import { providerLabel, type ActivityRow } from './gameActivity/utils';

type GameRow = Record<string, unknown>;

type DetailsState = {
  data?: ActivityRow;
  isQtech?: boolean;
};

function gameName(game: GameRow): string {
  return String(game.Name || game.name || game.gameId || '-');
}

export function GameActivityDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;
  const provider = state.data;
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
    [],
  );

  if (!provider) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Game Activity Details
        </Typography>
        <Paper sx={{ p: 2, bgcolor: '#1a1a1f' }}>
          <Typography color="text.secondary" mb={2}>
            No provider selected. Open a provider from Games Activity.
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/game-activity')}
            sx={ACTION_BTN_SX}
          >
            Back
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          {providerLabel(provider)} — Games
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/game-activity')}
          sx={ACTION_BTN_SX}
        >
          Back
        </Button>
      </Stack>

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
