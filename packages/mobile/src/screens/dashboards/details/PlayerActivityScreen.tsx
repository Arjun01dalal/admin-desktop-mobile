/**
 * Player Activity — port of desktop PlayerActivityPage.
 * player.wcoStats / player.qtechStats with startDate/endDate. Route param
 * `type` ('Qtech' | 'Wco') preselects (and locks) the provider source.
 * Main columns in the list; tap a row for every metric in the bottom sheet.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import {
  getMetric,
  nextSortConfig,
  normalizeActivityList,
  sortActivityRows,
  sortArrow,
  userIdOf,
  type ActivityRow,
  type SortConfig,
  type SortKey,
} from '../../../dashboards/activityUtils';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

function fmt(n: number): string {
  return floorNum(n).toLocaleString('en-IN');
}

/** Strip sort arrows from column labels for the detail sheet. */
function cleanLabel(label: string): string {
  return label.replace(/[⬍⬆⬇]/g, '').trim();
}

export function PlayerActivityScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const lockedSource = typeof params.type === 'string' && params.type;

  const [isQtech, setIsQtech] = useState(params.type === 'Qtech');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [sort, setSort] = useState<SortConfig | null>(null);
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const genRef = React.useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const action = isQtech ? 'player.qtechStats' : 'player.wcoStats';
      const res = await secureApi(action, { startDate, endDate });
      if (gen !== genRef.current) return; // stale response
      if (!res.ok) {
        setError(res.message || 'Failed to load player activity');
        setRows([]);
        return;
      }
      setRows(normalizeActivityList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [endDate, isQtech, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => sortActivityRows(rows, sort), [rows, sort]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => nextSortConfig(prev, key));
  }, []);

  const openUser = useCallback(
    (row: ActivityRow) => {
      navigation.navigate('/player-activity/details', {
        row: JSON.stringify(row),
        isQtech: isQtech ? '1' : '',
      });
    },
    [navigation, isQtech],
  );

  const columns = useMemo<DataTableColumn<ActivityRow>[]>(() => {
    const sortable = (key: SortKey, label: string) => ({
      label: `${label} ${sortArrow(sort, key)}`,
      onHeaderPress: () => toggleSort(key),
    });
    return [
      { key: 'idx', label: '#', width: 36, render: (_r, i) => String(i + 1) },
      {
        key: 'userId',
        label: 'UserId',
        width: 150,
        render: (r) => userIdOf(r) || '—',
        onCellPress: openUser,
      },
      {
        key: 'betAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'betAmount')),
        ...sortable('betAmount', 'Bet Amount'),
      },
      {
        key: 'betCount',
        width: 80,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'betCount')),
        ...sortable('betCount', 'Bet Count'),
      },
      {
        key: 'commissionAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'commissionAmount')),
        ...sortable('commissionAmount', 'Commission'),
      },
      {
        key: 'commissionCount',
        width: 90,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'commissionCount')),
        ...sortable('commissionCount', 'Commission Count'),
      },
      {
        key: 'rtp',
        width: 70,
        align: 'right',
        render: (r) => String(getMetric(r, 'rtp')),
        ...sortable('rtp', 'RTP'),
      },
      {
        key: 'ggr',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'ggr')),
        color: (r) => (getMetric(r, 'ggr') < 0 ? colors.destructive : colors.success),
        ...sortable('ggr', 'GGR'),
      },
      {
        key: 'winAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'winAmount')),
        ...sortable('winAmount', 'Win'),
      },
      {
        key: 'rollbackAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'rollbackAmount')),
        ...sortable('rollbackAmount', 'Rollback'),
      },
    ];
  }, [sort, toggleSort, openUser]);

  const totals = useMemo(() => {
    const sum = (key: SortKey) => sorted.reduce((acc, r) => acc + getMetric(r, key), 0);
    const ggr = sum('ggr');
    return [
      { label: 'Bet Amount', value: fmt(sum('betAmount')) },
      { label: 'Win Amount', value: fmt(sum('winAmount')) },
      { label: 'GGR', value: fmt(ggr), color: ggr < 0 ? colors.destructive : colors.success },
      { label: 'Commission', value: fmt(sum('commissionAmount')) },
    ];
  }, [sorted]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Player Activity</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row to see all details
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

      {!lockedSource ? (
        <View style={styles.toggleRow}>
          {(['Wco', 'Qtech'] as const).map((label) => {
            const active = label === 'Qtech' ? isQtech : !isQtech;
            return (
              <TouchableOpacity
                key={label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setIsQtech(label === 'Qtech')}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <Text style={styles.lockedLabel}>Provider: {isQtech ? 'Qtech' : 'Wco'}</Text>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Totals on top */}
      <View style={styles.totalsGrid}>
        {totals.map((t) => (
          <View key={t.label} style={styles.totalsCard}>
            <Text style={styles.totalsLabel}>{t.label}</Text>
            <Text style={[styles.totalsValue, t.color ? { color: t.color } : null]}>{t.value}</Text>
          </View>
        ))}
      </View>

      {loading && sorted.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && sorted.length === 0 ? <Text style={styles.hint}>No activity found</Text> : null}
      <View style={styles.list}>
        {sorted.map((row, index) => {
          const ggr = getMetric(row, 'ggr');
          return (
            <TouchableOpacity
              key={`row-${index}-${String(userIdOf(row) ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSelected(row)}
              onLongPress={() => openUser(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {userIdOf(row) || '—'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Bet: {fmt(getMetric(row, 'betAmount'))}</Text>
                <Text style={[styles.cardSplitRight, { color: ggr < 0 ? colors.destructive : colors.success }]}>
                  GGR: {fmt(ggr)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Win: {fmt(getMetric(row, 'winAmount'))}</Text>
                <Text style={styles.cardSplitRight}>RTP: {String(getMetric(row, 'rtp'))}</Text>
              </View>
              <Text style={styles.cardHint}>Tap for details · Long-press for providers</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? userIdOf(selected) || 'Details' : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: cleanLabel(c.label),
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
  screen: { flex: 1, backgroundColor: 'transparent' },
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
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  cardCheck: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  cardCheckOn: { borderColor: colors.primary, backgroundColor: 'rgba(37,99,235,0.12)' },
  cardCheckText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  cardCheckTextOn: { color: colors.primary },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: '40%',
  },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  selectAllBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  selectAllText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  totalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  totalsCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  totalsLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  totalsValue: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginTop: spacing(1) },
});
