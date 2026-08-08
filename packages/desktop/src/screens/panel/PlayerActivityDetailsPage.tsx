import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Paper, Typography } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount } from '@/utils/dates';
import {
  getMetric,
  providerLabel,
  userIdOf,
  type ActivityRow,
} from './activity/utils';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type DetailRow = {
  id: string;
  kind: 'provider' | 'game' | 'total';
  label: string;
  betAmount: number | string;
  winAmount: number | string;
  commission: number | string;
  rtp: number | string;
  rollbackCount: number | string;
  totalRollbackAmount: number | string;
};

type DetailsState = {
  data?: ActivityRow;
  isQtech?: boolean;
};

function buildDetailRows(data: ActivityRow, isQtech: boolean): DetailRow[] {
  const rows: DetailRow[] = [];
  const providers = Array.isArray(data.providers)
    ? (data.providers as ActivityRow[])
    : [];

  providers.forEach((provider, i) => {
    const pTotals = (provider.totals || {}) as ActivityRow;
    rows.push({
      id: `p-${i}`,
      kind: 'provider',
      label: providerLabel(provider),
      betAmount: formatAmount(
        provider.totalBetAmount ?? pTotals.betAmount,
      ),
      winAmount: formatAmount(
        provider.totalWinAmount ?? pTotals.winAmount,
      ),
      commission: formatAmount(
        provider.commissionAmount ?? pTotals.commissionAmount,
      ),
      rtp: formatAmount(provider.rtp ?? pTotals.rtp),
      rollbackCount: formatAmount(
        provider.rollbackCount ?? pTotals.rollbackCount ?? 0,
      ),
      totalRollbackAmount: formatAmount(
        provider.totalRollbackAmount ??
          pTotals.totalRollbackAmount ??
          pTotals.rollbackAmount ??
          0,
      ),
    });

    const games = Array.isArray(provider.games)
      ? (provider.games as ActivityRow[])
      : [];
    games.forEach((game, j) => {
      rows.push({
        id: `p-${i}-g-${j}`,
        kind: 'game',
        label: `└ ${String(game.gameId || game.Name || game.name || '-')}`,
        betAmount: formatAmount(game.totalBetAmount ?? game.betAmount),
        winAmount: formatAmount(game.totalWinAmount ?? game.winAmount),
        commission: formatAmount(game.commissionAmount),
        rtp: formatAmount(game.rtp),
        rollbackCount: formatAmount(
          game.rollbackCount ??
            provider.rollbackCount ??
            pTotals.rollbackCount ??
            0,
        ),
        totalRollbackAmount: formatAmount(
          game.totalRollbackAmount ??
            provider.totalRollbackAmount ??
            pTotals.totalRollbackAmount ??
            pTotals.rollbackAmount ??
            0,
        ),
      });
    });
  });

  if (!isQtech && data.totals) {
    const totals = data.totals as ActivityRow;
    rows.push({
      id: 'total',
      kind: 'total',
      label: 'Total',
      betAmount: formatAmount(totals.betAmount ?? getMetric(data, 'betAmount')),
      winAmount: formatAmount(totals.winAmount ?? getMetric(data, 'winAmount')),
      commission: formatAmount(
        totals.commissionAmount ?? getMetric(data, 'commissionAmount'),
      ),
      rtp: formatAmount(totals.rtp ?? getMetric(data, 'rtp')),
      rollbackCount: formatAmount(totals.rollbackCount ?? 0),
      totalRollbackAmount: formatAmount(
        totals.totalRollbackAmount ?? totals.rollbackAmount ?? 0,
      ),
    });
  }

  return rows;
}

export function PlayerActivityDetailsPage() {
  useRevealCodes();
  const location = useLocation();
  const state = (location.state || {}) as DetailsState;
  const player = state.data;
  const isQtech = Boolean(state.isQtech);

  const rows = useMemo(
    () => (player ? buildDetailRows(player, isQtech) : []),
    [player, isQtech],
  );

  const columns = useMemo<CommonTableColumn<DetailRow>[]>(
    () => [
      {
        id: 'label',
        label: 'Provider / Game',
        render: (row) => (
          <Box
            component="span"
            sx={{
              fontWeight: row.kind !== 'game' ? 700 : 400,
              pl: row.kind === 'game' ? 1 : 0,
            }}
          >
            {row.label}
          </Box>
        ),
      },
      {
        id: 'betAmount',
        label: 'Bet Amount',
        render: (row) => row.betAmount,
      },
      {
        id: 'winAmount',
        label: 'Win Amount',
        render: (row) => row.winAmount,
      },
      {
        id: 'commission',
        label: 'Commission',
        render: (row) => row.commission,
      },
      {
        id: 'rtp',
        label: 'RTP',
        render: (row) => row.rtp,
      },
      {
        id: 'rollbackCount',
        label: 'Rollback Count',
        render: (row) => row.rollbackCount,
      },
      {
        id: 'totalRollbackAmount',
        label: 'Rollback Amount',
        render: (row) => row.totalRollbackAmount,
      },
    ],
    [],
  );

  if (!player) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          {toDisplayText('Player Activity Details')}
        </Typography>
        <Paper sx={{ p: 2, bgcolor: '#1a1a1f' }}>
          <Typography color="text.secondary">
            No player selected. Open a UserId from {toDisplayText('Player Activity')}.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const id = userIdOf(player);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={2}>
        {id || 'Player'} — Providers
      </Typography>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyMessage="No providers for this player"
        minWidth={900}
      />
    </Box>
  );
}
