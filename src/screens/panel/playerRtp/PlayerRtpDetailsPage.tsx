import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ReportPage, DataTable, type DataColumn, display } from '../shared';
import { formatAmount } from '@/utils/dates';

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
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;
  const rows = useMemo(() => state.gameData || [], [state.gameData]);

  const columns = useMemo<DataColumn<GameRtp>[]>(
    () => [
      { id: 'index', label: '#', render: (_row, index) => index + 1 },
      { id: 'gameId', label: 'Game Id', render: (row) => display(row.gameId) },
      { id: 'totalAmount', label: 'Total Amount', render: (row) => formatAmount(row.totalAmount ?? 0) },
      { id: 'totalBets', label: 'Total Bets', render: (row) => display(row.totalBets ?? 0) },
      { id: 'totalWins', label: 'Total Wins', render: (row) => display(row.totalWins ?? 0) },
      { id: 'winAmount', label: 'Wins Amount', render: (row) => formatAmount(row.winAmount ?? 0) },
      { id: 'winPercentage', label: 'Win Percentage', render: (row) => display(row.winPercentage ?? 0) },
    ],
    [],
  );

  return (
    <ReportPage title="Players RTP Details">
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => `${row.gameId || 'game'}-${index}`}
        emptyMessage="No game data available"
        minWidth={900}
      />
    </ReportPage>
  );
}
