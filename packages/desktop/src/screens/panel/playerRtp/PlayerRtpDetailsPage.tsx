import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { formatAmount } from '@/utils/dates';
import { display } from '../shared';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type GameRtp = {
  gameId?: string;
  totalAmount?: number;
  totalBets?: number;
  totalWins?: number;
  winAmount?: number;
  winPercentage?: number;
};

type DetailsState = {
  gameData?: GameRtp[];
};

/** Per-game RTP breakdown for a single Qtech user — reads router state from PlayerRtpPage. */
export function PlayerRtpDetailsPage() {
  useRevealCodes();
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;
  const rows = useMemo(() => state.gameData || [], [state.gameData]);

  const columns = useMemo<CommonTableColumn<GameRtp>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'gameId',
        label: 'Game Id',
        render: (row) => display(row.gameId),
      },
      {
        id: 'totalAmount',
        label: 'Total Amount',
        render: (row) => formatAmount(row.totalAmount ?? 0),
      },
      {
        id: 'totalBets',
        label: 'Total Bets',
        render: (row) => display(row.totalBets ?? 0),
      },
      {
        id: 'totalWins',
        label: 'Total Wins',
        render: (row) => display(row.totalWins ?? 0),
      },
      {
        id: 'winAmount',
        label: 'Wins Amount',
        render: (row) => formatAmount(row.winAmount ?? 0),
      },
      {
        id: 'winPercentage',
        label: 'Win Percentage',
        render: (row) => display(row.winPercentage ?? 0),
      },
    ],
    [],
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {toDisplayText('Players RTP Details')}
      </Typography>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, index) => `${row.gameId || 'game'}-${index}`}
          emptyMessage="No game data available"
          stickyHeader
          dense
          minWidth={900}
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
