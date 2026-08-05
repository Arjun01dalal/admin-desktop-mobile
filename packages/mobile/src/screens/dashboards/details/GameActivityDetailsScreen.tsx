/**
 * Game Activity Details — per-game breakdown for one provider.
 * Port of desktop GameActivityDetailsPage. Receives the provider row
 * (JSON-encoded) and isQtech flag as route params from GameActivityScreen.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { providerLabel, type ActivityRow } from '../../../dashboards/activityUtils';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type GameRow = Record<string, unknown>;

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'gameName', 'betAmount', 'winAmount']);

function gameName(game: GameRow): string {
  return String(game.Name || game.name || game.gameId || '-');
}

function fmt(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return floorNum(n).toLocaleString('en-IN');
}

export function GameActivityDetailsScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const isQtech = Boolean(params.isQtech);
  const [selected, setSelected] = useState<GameRow | null>(null);

  const provider = useMemo<ActivityRow | null>(() => {
    if (typeof params.row !== 'string') return null;
    try {
      const parsed = JSON.parse(params.row);
      return parsed && typeof parsed === 'object' ? (parsed as ActivityRow) : null;
    } catch {
      return null;
    }
  }, [params.row]);

  const games = useMemo<GameRow[]>(
    () => (Array.isArray(provider?.games) ? (provider!.games as GameRow[]) : []),
    [provider],
  );

  const columns = useMemo<DataTableColumn<GameRow>[]>(() => {
    const cols: DataTableColumn<GameRow>[] = [
      { key: 'idx', label: '#', width: 36, render: (_r, i) => String(i) },
      { key: 'gameName', label: 'Game Name', width: 160, render: (r) => gameName(r) },
      {
        key: 'betAmount',
        label: 'Bet Amount',
        width: 100,
        align: 'right',
        render: (r) => fmt(r.totalBetAmount ?? r.betAmount),
      },
      { key: 'betCount', label: 'Bet Count', width: 80, align: 'right', render: (r) => fmt(r.betCount) },
      {
        key: 'commissionAmount',
        label: 'Commission Amount',
        width: 120,
        align: 'right',
        render: (r) => fmt(r.commissionAmount),
      },
      {
        key: 'commissionCount',
        label: 'Commission Count',
        width: 110,
        align: 'right',
        render: (r) => fmt(r.commissionCount ?? 0),
      },
      { key: 'rtp', label: 'RTP', width: 70, align: 'right', render: (r) => String(r.rtp ?? '-') },
    ];
    if (isQtech) {
      cols.push({
        key: 'totalRate',
        label: 'Total Rate',
        width: 90,
        align: 'right',
        render: (r) => fmt(r.totalRate ?? 0),
      });
    }
    cols.push(
      {
        key: 'winAmount',
        label: 'Win Amount',
        width: 100,
        align: 'right',
        render: (r) => fmt(r.totalWinAmount ?? r.winAmount),
      },
      { key: 'winCount', label: 'Win Count', width: 80, align: 'right', render: (r) => fmt(r.winCount) },
    );
    return cols;
  }, [isQtech]);

  if (!provider) {
    return (
      <View style={[styles.screen, styles.centerBox]}>
        <Text style={styles.empty}>No provider selected. Open a provider from Games Activity.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{providerLabel(provider)} — Games</Text>

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={games}
        keyFor={(r, i) => String(r.gameId || r.Name || i)}
        emptyMessage="No games for this provider"
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? gameName(selected) : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(selected, 0),
                  color: c.color?.(selected),
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
