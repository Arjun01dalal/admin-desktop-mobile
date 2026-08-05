/**
 * Game Activity — full-column port of desktop GameActivityPage.
 * game.wcoStats / game.qtechStats with startDate/endDate. Route param `type`
 * ('Qtech' | 'Wco') preselects (and locks) the provider source. Tapping a
 * provider name opens the per-game breakdown (GameActivityDetailsScreen).
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
  gameCount,
  getMetric,
  nextSortConfig,
  normalizeActivityList,
  providerLabel,
  rollbackCount,
  sortActivityRows,
  sortArrow,
  winCount,
  type ActivityRow,
  type SortConfig,
  type SortKey,
} from '../../../dashboards/activityUtils';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'provider', 'betAmount', 'ggr']);

function fmt(n: number): string {
  return floorNum(n).toLocaleString('en-IN');
}

/** Strip sort arrows from column labels for the detail sheet. */
function cleanLabel(label: string): string {
  return label.replace(/[⬍⬆⬇]/g, '').trim();
}

export function GameActivityScreen() {
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
      setRows(normalizeActivityList(res.data));
    } finally {
      setLoading(false);
    }
  }, [endDate, isQtech, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => sortActivityRows(rows, sort), [rows, sort]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort((prev) => nextSortConfig(prev, key));
  }, []);

  const openProvider = useCallback(
    (row: ActivityRow) => {
      navigation.navigate('/game-activity/details', {
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
    const cols: DataTableColumn<ActivityRow>[] = [
      { key: 'idx', label: '#', width: 36, render: (_r, i) => String(i + 1) },
      {
        key: 'provider',
        label: 'Provider',
        width: 130,
        render: (r) => providerLabel(r),
        onCellPress: openProvider,
      },
      { key: 'gameCount', label: 'Game Count', width: 80, align: 'right', render: (r) => String(gameCount(r)) },
    ];
    if (isQtech) {
      cols.push({
        key: 'licenseFeePercent',
        width: 100,
        align: 'right',
        render: (r) => String(getMetric(r, 'licenseFeePercent')),
        ...sortable('licenseFeePercent', 'License Fee %'),
      });
    }
    cols.push(
      {
        key: 'betAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'betAmount')),
        ...sortable('betAmount', 'Bet Amount'),
      },
      { key: 'betCount', label: 'Bet Count', width: 80, align: 'right', render: (r) => fmt(getMetric(r, 'betCount')) },
      {
        key: 'commissionAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'commissionAmount')),
        ...sortable('commissionAmount', 'Commission'),
      },
      {
        key: 'commissionCount',
        label: 'Comm. Count',
        width: 90,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'commissionCount')),
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
      { key: 'winCount', label: 'Win Count', width: 80, align: 'right', render: (r) => fmt(winCount(r)) },
      {
        key: 'rollbackCount',
        label: 'Rollback Count',
        width: 100,
        align: 'right',
        render: (r) => fmt(rollbackCount(r)),
      },
      {
        key: 'totalRollbackAmount',
        width: 100,
        align: 'right',
        render: (r) => fmt(getMetric(r, 'totalRollbackAmount')),
        ...sortable('totalRollbackAmount', 'Rollback'),
      },
    );
    return cols;
  }, [sort, toggleSort, openProvider, isQtech]);

  const footer = useMemo(() => {
    const sum = (key: SortKey) => sorted.reduce((acc, r) => acc + getMetric(r, key), 0);
    const ggr = sum('ggr');
    return {
      label: 'Total',
      cells: {
        betAmount: fmt(sum('betAmount')),
        winAmount: fmt(sum('winAmount')),
        ggr: fmt(ggr),
        commissionAmount: fmt(sum('commissionAmount')),
      },
    };
  }, [sorted]);

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
        {startDate} → {endDate} · Tap a provider to see its games
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

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={sorted}
        keyFor={(r, i) => String(r.providerId || providerLabel(r) || i)}
        loading={loading}
        footer={footer}
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details · Tap a provider name for its games"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? providerLabel(selected) : ''}
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
});
