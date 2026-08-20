/**
 * BetConstruct game-wise GGR report opened from the dashboard card.
 * This is distinct from the BetConstruct games CRUD screen.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { floorNum, toNum } from '../../../dashboards/mergeMetrics';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ResponsiveTable } from '../../../dashboards/ui/ResponsiveTable';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type GameRow = {
  gameId?: string;
  totalBetAmount?: number;
  totalBets?: number;
  totalWinningAmount?: number;
  totalWinningBets?: number;
  totalCommission?: number;
  totalUsers?: number;
  ggr?: number;
  rtp?: number;
  [key: string]: unknown;
};

type Summary = {
  totalBetAmount?: number;
  totalWinningAmount?: number;
  profit?: number;
  ggr?: number;
};

const MAIN_KEYS = new Set(['gameId', 'bet', 'ggr', 'rtp']);

function fmt(value: unknown): string {
  return floorNum(value).toLocaleString('en-IN');
}

export function BetConstructGamesListScreen() {
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

  const columns = useMemo<DataTableColumn<GameRow>[]>(
    () => [
      { key: 'gameId', label: 'Game Id', width: 130, render: (r) => String(r.gameId || '—') },
      { key: 'bet', label: 'Bet Amount', width: 105, align: 'right', render: (r) => fmt(r.totalBetAmount) },
      { key: 'bets', label: 'No. of Bets', width: 90, align: 'right', render: (r) => fmt(r.totalBets) },
      { key: 'win', label: 'Win Amount', width: 105, align: 'right', render: (r) => fmt(r.totalWinningAmount) },
      { key: 'wins', label: 'No. of Wins', width: 90, align: 'right', render: (r) => fmt(r.totalWinningBets) },
      { key: 'commission', label: 'Commission', width: 100, align: 'right', render: (r) => fmt(r.totalCommission) },
      { key: 'users', label: 'Total Users', width: 90, align: 'right', render: (r) => fmt(r.totalUsers) },
      {
        key: 'ggr',
        label: 'GGR',
        width: 95,
        align: 'right',
        render: (r) => fmt(r.ggr),
        color: (r) => (toNum(r.ggr) < 0 ? colors.destructive : colors.success),
      },
      { key: 'rtp', label: 'RTP', width: 75, align: 'right', render: (r) => fmt(r.rtp) },
    ],
    [],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    const index = rows.indexOf(selected);
    return columns.map((column) => ({
      label: column.label,
      value: column.render(selected, index),
      color: column.color?.(selected),
    }));
  }, [columns, rows, selected]);

  const summaryItems = [
    { label: 'Total Bet Amount', value: summary.totalBetAmount },
    { label: 'Total Win Amount', value: summary.totalWinningAmount },
    { label: 'Total Profit', value: summary.profit },
    { label: 'Total GGR', value: summary.ggr },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{toDisplayText('BetConstruct Details')}</Text>
      <Text style={styles.sub}>{startDate} → {endDate}</Text>

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

      <View style={styles.summaryGrid}>
        {summaryItems.map((item) => (
          <View key={item.label} style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{toDisplayText(item.label)}</Text>
            <Text style={styles.summaryValue}>{fmt(item.value)}</Text>
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ResponsiveTable
        forceCards
        columns={columns.filter((column) => MAIN_KEYS.has(column.key))}
        rows={rows}
        keyFor={(row, index) => String(row.gameId || index)}
        loading={loading}
        emptyMessage="No BetConstruct game data"
        onRowPress={(row) => setSelected(row)}
        cardLayout="preview"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={String(selected?.gameId || 'Game Details')}
        fields={sheetFields}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  summaryCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  summaryLabel: { color: colors.muted, fontSize: 11 },
  summaryValue: { color: colors.foreground, fontSize: 15, fontWeight: '700', marginTop: spacing(1) },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
});
