/**
 * Player Activity Details — provider/game breakdown for one player.
 * Port of desktop PlayerActivityDetailsPage. Receives the player row
 * (JSON-encoded) and isQtech flag as route params from PlayerActivityScreen.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import {
  getMetric,
  providerLabel,
  userIdOf,
  type ActivityRow,
} from '../../../dashboards/activityUtils';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type DetailRow = {
  id: string;
  kind: 'provider' | 'game' | 'total';
  label: string;
  betAmount: string;
  winAmount: string;
  commission: string;
  rtp: string;
  rollbackCount: string;
  totalRollbackAmount: string;
};

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['label', 'betAmount', 'winAmount']);

function fmt(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '-';
  return floorNum(n).toLocaleString('en-IN');
}

/** Same provider → games → total flattening as desktop buildDetailRows. */
function buildDetailRows(data: ActivityRow, isQtech: boolean): DetailRow[] {
  const rows: DetailRow[] = [];
  const providers = Array.isArray(data.providers) ? (data.providers as ActivityRow[]) : [];

  providers.forEach((provider, i) => {
    const pTotals = (provider.totals || {}) as ActivityRow;
    rows.push({
      id: `p-${i}`,
      kind: 'provider',
      label: providerLabel(provider),
      betAmount: fmt(provider.totalBetAmount ?? pTotals.betAmount),
      winAmount: fmt(provider.totalWinAmount ?? pTotals.winAmount),
      commission: fmt(provider.commissionAmount ?? pTotals.commissionAmount),
      rtp: fmt(provider.rtp ?? pTotals.rtp),
      rollbackCount: fmt(provider.rollbackCount ?? pTotals.rollbackCount ?? 0),
      totalRollbackAmount: fmt(
        provider.totalRollbackAmount ?? pTotals.totalRollbackAmount ?? pTotals.rollbackAmount ?? 0,
      ),
    });

    const games = Array.isArray(provider.games) ? (provider.games as ActivityRow[]) : [];
    games.forEach((game, j) => {
      rows.push({
        id: `p-${i}-g-${j}`,
        kind: 'game',
        label: `└ ${String(game.gameId || game.Name || game.name || '-')}`,
        betAmount: fmt(game.totalBetAmount ?? game.betAmount),
        winAmount: fmt(game.totalWinAmount ?? game.winAmount),
        commission: fmt(game.commissionAmount),
        rtp: fmt(game.rtp),
        rollbackCount: fmt(
          game.rollbackCount ?? provider.rollbackCount ?? pTotals.rollbackCount ?? 0,
        ),
        totalRollbackAmount: fmt(
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
      betAmount: fmt(totals.betAmount ?? getMetric(data, 'betAmount')),
      winAmount: fmt(totals.winAmount ?? getMetric(data, 'winAmount')),
      commission: fmt(totals.commissionAmount ?? getMetric(data, 'commissionAmount')),
      rtp: fmt(totals.rtp ?? getMetric(data, 'rtp')),
      rollbackCount: fmt(totals.rollbackCount ?? 0),
      totalRollbackAmount: fmt(totals.totalRollbackAmount ?? totals.rollbackAmount ?? 0),
    });
  }

  return rows;
}

export function PlayerActivityDetailsScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const isQtech = Boolean(params.isQtech);
  const [selected, setSelected] = useState<DetailRow | null>(null);

  const player = useMemo<ActivityRow | null>(() => {
    if (typeof params.row !== 'string') return null;
    try {
      const parsed = JSON.parse(params.row);
      return parsed && typeof parsed === 'object' ? (parsed as ActivityRow) : null;
    } catch {
      return null;
    }
  }, [params.row]);

  const rows = useMemo(() => (player ? buildDetailRows(player, isQtech) : []), [player, isQtech]);

  const columns = useMemo<DataTableColumn<DetailRow>[]>(
    () => [
      {
        key: 'label',
        label: 'Provider / Game',
        width: 170,
        render: (r) => r.label,
        color: (r) => (r.kind === 'game' ? colors.muted : colors.foreground),
      },
      { key: 'betAmount', label: 'Bet Amount', width: 100, align: 'right', render: (r) => r.betAmount },
      { key: 'winAmount', label: 'Win Amount', width: 100, align: 'right', render: (r) => r.winAmount },
      { key: 'commission', label: 'Commission', width: 100, align: 'right', render: (r) => r.commission },
      { key: 'rtp', label: 'RTP', width: 70, align: 'right', render: (r) => r.rtp },
      { key: 'rollbackCount', label: 'Rollback Count', width: 100, align: 'right', render: (r) => r.rollbackCount },
      {
        key: 'totalRollbackAmount',
        label: 'Rollback Amount',
        width: 110,
        align: 'right',
        render: (r) => r.totalRollbackAmount,
      },
    ],
    [],
  );

  if (!player) {
    return (
      <View style={[styles.screen, styles.centerBox]}>
        <Text style={styles.empty}>No player selected. Open a UserId from Player Activity.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{userIdOf(player) || 'Player'} — Providers</Text>

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r) => r.id}
        emptyMessage="No providers for this player"
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? selected.label.replace('└ ', '') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected, 0),
              }))
            : []
        }
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  centerBox: { justifyContent: 'center', alignItems: 'center', padding: spacing(6) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
});
