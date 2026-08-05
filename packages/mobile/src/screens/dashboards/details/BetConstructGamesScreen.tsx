/**
 * Bet Construct Details — port of desktop BetConstructGamesListPage.
 * dashboard.betConstructGameWiseGgr with startDate/endDate. Shows a totals
 * summary header plus game-wise rows (Game, Bet, Win, Profit/Commission, GGR).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum, toNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'gameId', 'totalBetAmount', 'ggr']);

type GameRow = {
  gameId?: string;
  totalBetAmount?: number;
  totalWinningAmount?: number;
  totalCommission?: number;
  ggr?: number;
  [key: string]: unknown;
};

type Summary = {
  totalBetAmount?: number;
  totalWinningAmount?: number;
  profit?: number;
  ggr?: number;
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function fmt(value: unknown): string {
  return floorNum(value).toLocaleString('en-IN');
}

/** Full desktop column set (BetConstructGamesListPage). */
const columns: DataTableColumn<GameRow>[] = [
  { key: 'idx', label: '#', width: 36, render: (_r, i) => String(i + 1) },
  { key: 'gameId', label: 'Game Id', width: 140, render: (r) => display(r.gameId) },
  { key: 'totalBetAmount', label: 'Total Bet Amount', width: 110, align: 'right', render: (r) => fmt(r.totalBetAmount) },
  { key: 'totalBets', label: 'No of Bets', width: 80, align: 'right', render: (r) => fmt(r.totalBets) },
  { key: 'totalWinningAmount', label: 'Total Winning Amount', width: 120, align: 'right', render: (r) => fmt(r.totalWinningAmount) },
  { key: 'totalWinningBets', label: 'No of Wins', width: 80, align: 'right', render: (r) => fmt(r.totalWinningBets) },
  { key: 'totalCommission', label: 'Total Commission', width: 110, align: 'right', render: (r) => fmt(r.totalCommission) },
  { key: 'totalUsers', label: 'Total Users', width: 85, align: 'right', render: (r) => fmt(r.totalUsers) },
  {
    key: 'ggr',
    label: 'GGR',
    width: 100,
    align: 'right',
    render: (r) => fmt(r.ggr),
    color: (r) => (toNum(r.ggr) < 0 ? colors.destructive : colors.success),
  },
  { key: 'rtp', label: 'RTP', width: 70, align: 'right', render: (r) => fmt(r.rtp) },
];

export function BetConstructGamesScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GameRow[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [selected, setSelected] = useState<GameRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi('dashboard.betConstructGameWiseGgr', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load BetConstruct GGR');
        setRows([]);
        setSummary({});
        return;
      }
      const payload =
        res.data && typeof res.data === 'object'
          ? (res.data as Record<string, unknown>)
          : {};
      setRows(Array.isArray(payload.byGame) ? (payload.byGame as GameRow[]) : []);
      setSummary(
        payload.summary && typeof payload.summary === 'object'
          ? (payload.summary as Summary)
          : {},
      );
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Bet Construct Details</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate}
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Bet Amount</Text>
          <Text style={styles.summaryValue}>
            {floorNum(summary.totalBetAmount).toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Win Amount</Text>
          <Text style={styles.summaryValue}>
            {floorNum(summary.totalWinningAmount).toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Profit</Text>
          <Text style={styles.summaryValue}>
            {floorNum(summary.profit).toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total GGR</Text>
          <Text
            style={[styles.summaryValue, toNum(summary.ggr) < 0 ? styles.neg : styles.pos]}
          >
            {floorNum(summary.ggr).toLocaleString('en-IN')}
          </Text>
        </View>
      </View>

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r.gameId ?? i)}
        loading={loading}
        emptyMessage="No BetConstruct game data"
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.gameId) : ''}
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
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  summaryCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing(1.5),
  },
  summaryLabel: { color: colors.muted, fontSize: 13 },
  summaryValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headRow: { borderBottomColor: colors.primary },
  headText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  cell: { color: colors.foreground, fontSize: 12, paddingHorizontal: spacing(1) },
  cellIndex: { width: 26 },
  cellGame: { flex: 1.4 },
  cellNum: { flex: 1, textAlign: 'right' },
  pos: { color: colors.success, fontWeight: '700' },
  neg: { color: colors.destructive, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
});
