/**
 * Game Activity — port of desktop GameActivityPage (simplified for mobile).
 * game.wcoStats / game.qtechStats with startDate/endDate. Route param `type`
 * ('Qtech' | 'Wco') preselects (and locks) the provider source.
 * Rows: Provider, Bet Count, Bet Amount, Win Amount, Profit (GGR), GGR.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';

type Row = Record<string, unknown>;

function totalsOf(item: Row): Row {
  return (item.totals || {}) as Row;
}
function getMetric(item: Row, key: string): number {
  const t = totalsOf(item);
  switch (key) {
    case 'betAmount':
      return Number(item.totalBetAmount ?? t.betAmount ?? 0);
    case 'betCount':
      return Number(item.betCount ?? t.betCount ?? 0);
    case 'winAmount':
      return Number(item.totalWinAmount ?? t.winAmount ?? 0);
    case 'ggr': {
      const hasFlat = item.totalBetAmount != null || item.totalWinAmount != null;
      if (hasFlat) return Number(item.totalBetAmount ?? 0) - Number(item.totalWinAmount ?? 0);
      return Number(t.betAmount ?? 0) - Number(t.winAmount ?? 0);
    }
    default:
      return 0;
  }
}
function providerLabel(item: Row): string {
  return String(item.provider || item.providerName || item.name || '-');
}
function normalizeList(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  if (payload && typeof payload === 'object') {
    const obj = payload as { items?: Row[]; payload?: Row[] };
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.payload)) return obj.payload;
  }
  return [];
}

export function GameActivityScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const startDate = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const endDate = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const lockedSource = typeof params.type === 'string' && params.type;

  const [isQtech, setIsQtech] = useState(params.type === 'Qtech');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const action = isQtech ? 'game.qtechStats' : 'game.wcoStats';
      const res = await secureApi(action, { startDate, endDate });
      if (!res.ok) {
        setError(res.message || 'Failed to load game activity');
        setRows([]);
        return;
      }
      setRows(normalizeList(res.data));
    } finally {
      setLoading(false);
    }
  }, [endDate, isQtech, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    return rows.reduce<{ bet: number; win: number; ggr: number }>(
      (acc, r) => {
        acc.bet += getMetric(r, 'betAmount');
        acc.win += getMetric(r, 'winAmount');
        acc.ggr += getMetric(r, 'ggr');
        return acc;
      },
      { bet: 0, win: 0, ggr: 0 },
    );
  }, [rows]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Games Activity</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate}
      </Text>

      {!lockedSource ? (
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.chip, !isQtech && styles.chipActive]}
            onPress={() => setIsQtech(false)}
          >
            <Text style={[styles.chipText, !isQtech && styles.chipTextActive]}>Wco</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, isQtech && styles.chipActive]}
            onPress={() => setIsQtech(true)}
          >
            <Text style={[styles.chipText, isQtech && styles.chipTextActive]}>Qtech</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.lockedLabel}>Provider: {isQtech ? 'Qtech' : 'Wco'}</Text>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cell, styles.cellProvider, styles.headText]}>Provider</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headText]}>Bet Cnt</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headText]}>Bet Amt</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headText]}>Win Amt</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headText]}>GGR</Text>
        </View>

        {loading && rows.length === 0 ? (
          <ActivityIndicator style={{ marginVertical: spacing(6) }} color={colors.primary} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>No data</Text>
        ) : (
          rows.map((r, i) => {
            const ggr = getMetric(r, 'ggr');
            return (
              <View key={String(r.providerId || providerLabel(r) || i)} style={styles.row}>
                <Text style={[styles.cell, styles.cellProvider]} numberOfLines={1}>
                  {providerLabel(r)}
                </Text>
                <Text style={[styles.cell, styles.cellNum]}>
                  {getMetric(r, 'betCount').toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.cell, styles.cellNum]}>
                  {floorNum(getMetric(r, 'betAmount')).toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.cell, styles.cellNum]}>
                  {floorNum(getMetric(r, 'winAmount')).toLocaleString('en-IN')}
                </Text>
                <Text style={[styles.cell, styles.cellNum, ggr < 0 ? styles.neg : styles.pos]}>
                  {floorNum(ggr).toLocaleString('en-IN')}
                </Text>
              </View>
            );
          })
        )}

        {rows.length > 0 ? (
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.cell, styles.cellProvider, styles.headText]}>Total</Text>
            <Text style={[styles.cell, styles.cellNum, styles.headText]}>—</Text>
            <Text style={[styles.cell, styles.cellNum, styles.headText]}>
              {floorNum(totals.bet).toLocaleString('en-IN')}
            </Text>
            <Text style={[styles.cell, styles.cellNum, styles.headText]}>
              {floorNum(totals.win).toLocaleString('en-IN')}
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellNum,
                styles.headText,
                totals.ggr < 0 ? styles.neg : styles.pos,
              ]}
            >
              {floorNum(totals.ggr).toLocaleString('en-IN')}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  toggleRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  chip: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  lockedLabel: { color: colors.primary, fontSize: 13, fontWeight: '700', marginTop: spacing(3) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
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
  totalRow: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.primary },
  headText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  cell: { color: colors.foreground, fontSize: 12, paddingHorizontal: spacing(1) },
  cellProvider: { flex: 1.6 },
  cellNum: { flex: 1, textAlign: 'right' },
  pos: { color: colors.success, fontWeight: '700' },
  neg: { color: colors.destructive, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
});
