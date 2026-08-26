/**
 * Game User Stats — per-game user breakdown for Qtech.
 * Card list UI (same pattern as GameActivityScreen). Opened from Game Activity
 * Details by tapping a game name. POST /Qtech/user-stats-by-game.
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
import * as Clipboard from 'expo-clipboard';
import {
  QTECH_USER_STATS_PROVIDER,
  buildUserStatsByGamePayload,
  extractUserStatsList,
  formatGameDisplay,
  formatGameUserStatNumber,
  gameUserStatBet,
  gameUserStatBetCount,
  gameUserStatGgr,
  gameUserStatRtp,
  gameUserStatUserId,
  gameUserStatUserName,
  gameUserStatWin,
  gameUserStatWinCount,
  nextGameUserStatsSort,
  sortGameUserStats,
  summarizeGameUserStats,
  type GameUserStatRow,
  type GameUserStatsSortConfig,
  type GameUserStatsSortKey,
} from '@astro/shared/gameUserStats';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

const SORT_CHIPS: { key: GameUserStatsSortKey; label: string }[] = [
  { key: 'ggr', label: 'GGR' },
  { key: 'betAmount', label: 'Bet' },
  { key: 'winAmount', label: 'Win' },
  { key: 'rtp', label: 'RTP' },
];

function userDetailFields(row: GameUserStatRow): SheetField[] {
  const ggr = gameUserStatGgr(row);
  return [
    { label: 'User ID', value: gameUserStatUserId(row) },
    { label: 'Name', value: gameUserStatUserName(row) },
    { label: 'Bet Amount', value: formatGameUserStatNumber(gameUserStatBet(row)) },
    { label: 'Bet Count', value: formatGameUserStatNumber(gameUserStatBetCount(row), 0) },
    { label: 'Win Amount', value: formatGameUserStatNumber(gameUserStatWin(row)) },
    { label: 'Win Count', value: formatGameUserStatNumber(gameUserStatWinCount(row), 0) },
    { label: 'RTP', value: formatGameUserStatNumber(gameUserStatRtp(row)) },
    {
      label: 'GGR',
      value: formatGameUserStatNumber(ggr),
      color: ggr < 0 ? colors.destructive : colors.success,
    },
  ];
}

export function GameUserStatsScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const gameId = typeof params.gameId === 'string' ? params.gameId.trim() : '';
  const gameNameParam = typeof params.gameName === 'string' ? params.gameName : gameId;
  const gameDisplay = formatGameDisplay(gameNameParam || gameId);

  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GameUserStatRow[]>([]);
  const [sort, setSort] = useState<GameUserStatsSortConfig>({
    key: 'ggr',
    direction: 'asc',
  });
  const [selected, setSelected] = useState<GameUserStatRow | null>(null);

  const load = useCallback(async () => {
    if (!gameId) {
      setError('Game ID missing');
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = buildUserStatsByGamePayload(gameId, startDate, endDate);
      const res = await secureApi('game.userStatsByGame', payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load user stats');
        setRows([]);
        return;
      }
      setRows(extractUserStatsList(res.data));
    } finally {
      setLoading(false);
    }
  }, [gameId, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => sortGameUserStats(rows, sort), [rows, sort]);
  const summary = useMemo(() => summarizeGameUserStats(rows), [rows]);

  const toggleSort = useCallback((key: GameUserStatsSortKey) => {
    setSort((prev) => nextGameUserStatsSort(prev, key));
  }, []);

  const openUserReport = useCallback(
    (row: GameUserStatRow) => {
      const userId = gameUserStatUserId(row);
      if (userId === '—') return;
      navigation.navigate('/user-report', {
        userId,
        userName: gameUserStatUserName(row),
      });
    },
    [navigation],
  );

  const copyUserId = useCallback(async (userId: string) => {
    if (!userId || userId === '—') return;
    await Clipboard.setStringAsync(userId);
  }, []);

  if (!gameId) {
    return (
      <View style={[styles.screen, styles.centerBox]}>
        <Text style={styles.empty}>
          No game selected. Open a game from {toDisplayText('Game Activity Details')}.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{gameDisplay.label || toDisplayText('Game User Stats')}</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap user for details · Long-press for report
      </Text>

      <View style={styles.chipsRow}>
        <Text style={styles.metaChip}>Game ID: {gameId}</Text>
        <Text style={styles.metaChip}>Provider: {QTECH_USER_STATS_PROVIDER}</Text>
        <Text style={styles.metaChip}>Users: {rows.length}</Text>
      </View>

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

      <View style={styles.toggleRow}>
        {SORT_CHIPS.map((chip) => {
          const active = sort.key === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleSort(chip.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {chip.label}
                {active ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.totalsGrid}>
        <View style={styles.totalsCard}>
          <Text style={styles.totalsLabel}>Total Bet</Text>
          <Text style={styles.totalsValue}>{formatGameUserStatNumber(summary.bet)}</Text>
        </View>
        <View style={styles.totalsCard}>
          <Text style={styles.totalsLabel}>Total Win</Text>
          <Text style={styles.totalsValue}>{formatGameUserStatNumber(summary.win)}</Text>
        </View>
        <View style={styles.totalsCard}>
          <Text style={styles.totalsLabel}>Total GGR</Text>
          <Text
            style={[
              styles.totalsValue,
              { color: summary.ggr < 0 ? colors.destructive : colors.success },
            ]}
          >
            {formatGameUserStatNumber(summary.ggr)}
          </Text>
        </View>
        <View style={styles.totalsCard}>
          <Text style={styles.totalsLabel}>Users</Text>
          <Text style={styles.totalsValue}>{String(rows.length)}</Text>
        </View>
      </View>

      {loading && sorted.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && sorted.length === 0 ? <Text style={styles.hint}>No data found</Text> : null}

      <View style={styles.list}>
        {sorted.map((row, index) => {
          const userId = gameUserStatUserId(row);
          const ggr = gameUserStatGgr(row);
          return (
            <TouchableOpacity
              key={`user-${index}-${userId}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSelected(row)}
              onLongPress={() => openUserReport(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={[styles.cardTitle, styles.cardTitleLink]} numberOfLines={1}>
                  {userId}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>
                  Bet: {formatGameUserStatNumber(gameUserStatBet(row))}
                </Text>
                <Text
                  style={[
                    styles.cardSplitRight,
                    { color: ggr < 0 ? colors.destructive : colors.success },
                  ]}
                >
                  GGR: {formatGameUserStatNumber(ggr)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>
                  Win: {formatGameUserStatNumber(gameUserStatWin(row))}
                </Text>
                <Text style={styles.cardSplitRight}>
                  RTP: {formatGameUserStatNumber(gameUserStatRtp(row))}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap for details · Long-press for user report</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? gameUserStatUserId(selected) : ''}
        fields={selected ? userDetailFields(selected) : []}
        onClose={() => setSelected(null)}
        actions={
          selected
            ? [
                {
                  label: 'User Report',
                  tone: 'primary',
                  onPress: () => {
                    openUserReport(selected);
                    setSelected(null);
                  },
                },
                {
                  label: 'Copy ID',
                  onPress: () => void copyUserId(gameUserStatUserId(selected)),
                },
              ]
            : undefined
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  centerBox: { justifyContent: 'center', alignItems: 'center', padding: spacing(6) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    marginTop: spacing(2),
  },
  metaChip: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
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
  cardTitleLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
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
