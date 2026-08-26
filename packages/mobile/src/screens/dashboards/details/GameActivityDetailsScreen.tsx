/**
 * Game Activity Details — per-game breakdown for one provider.
 * Card list UI (same pattern as GameActivityScreen). Loads provider games on
 * mount (params can drop large `games[]`). Qtech: long-press / sheet → User Stats.
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
  normalizeActivityList,
  providerLabel,
  type ActivityRow,
} from '../../../dashboards/activityUtils';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { resolveGameId, resolveGameName } from '@astro/shared/gameUserStats';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type GameRow = Record<string, unknown>;

function gameName(game: GameRow): string {
  return String(game.Name || game.name || game.gameId || '-');
}

function fmt(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return floorNum(n).toLocaleString('en-IN');
}

/** Laxmi: GGR = bet − win. */
function gameGgr(game: GameRow): number {
  const bet = Number(game.totalBetAmount ?? game.betAmount ?? 0);
  const win = Number(game.totalWinAmount ?? game.winAmount ?? 0);
  return bet - win;
}

function parseParamRow(raw: unknown): ActivityRow | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as ActivityRow;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as ActivityRow) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function matchProviderRow(
  rows: ActivityRow[],
  providerId: string,
  providerName: string,
  fallback: ActivityRow | null,
): ActivityRow | null {
  if (providerId) {
    const byId = rows.find((r) => r.providerId != null && String(r.providerId) === providerId);
    if (byId) return byId;
  }
  if (providerName) {
    const byLabel = rows.filter((r) => providerLabel(r) === providerName);
    if (byLabel.length === 1) return byLabel[0];
  }
  if (fallback) {
    const id = fallback.providerId != null ? String(fallback.providerId) : '';
    if (id) {
      const byId = rows.find((r) => r.providerId != null && String(r.providerId) === id);
      if (byId) return byId;
    }
    const label = providerLabel(fallback);
    const byLabel = rows.filter((r) => providerLabel(r) === label);
    if (byLabel.length === 1) return byLabel[0];
  }
  return fallback;
}

function gameDetailFields(game: GameRow, isQtech: boolean): SheetField[] {
  const ggr = gameGgr(game);
  const fields: SheetField[] = [
    { label: 'Game Name', value: gameName(game) },
    { label: 'Game ID', value: resolveGameId(game) || '—' },
    { label: 'Bet Amount', value: fmt(game.totalBetAmount ?? game.betAmount) },
    { label: 'Bet Count', value: fmt(game.betCount) },
    { label: 'Commission Amount', value: fmt(game.commissionAmount) },
    { label: 'Commission Count', value: fmt(game.commissionCount ?? 0) },
    { label: 'RTP', value: String(game.rtp ?? '—') },
    {
      label: 'GGR',
      value: fmt(ggr),
      color: ggr < 0 ? colors.destructive : colors.success,
    },
  ];
  if (isQtech) {
    fields.push({ label: 'Total Rate', value: fmt(game.totalRate ?? 0) });
  }
  fields.push(
    { label: 'Win Amount', value: fmt(game.totalWinAmount ?? game.winAmount) },
    { label: 'Win Count', value: fmt(game.winCount) },
  );
  return fields;
}

export function GameActivityDetailsScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: object) => void;
    getParent?: () => unknown;
  }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const isQtech = isTruthyFlag(params.isQtech);
  const startDate = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const endDate = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const providerId = typeof params.providerId === 'string' ? params.providerId : '';
  const providerName = typeof params.providerName === 'string' ? params.providerName : '';

  const paramProvider = useMemo(() => parseParamRow(params.row), [params.row]);

  const [provider, setProvider] = useState<ActivityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GameRow | null>(null);

  const loadProvider = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const action = isQtech ? 'game.qtechStats' : 'game.wcoStats';
      const res = await secureApi(action, { startDate, endDate });
      if (!res.ok) {
        setError(res.message || 'Failed to load games');
        setProvider(paramProvider);
        return;
      }
      const rows = normalizeActivityList(res.data);
      const match = matchProviderRow(rows, providerId, providerName, paramProvider);
      if (!match) {
        setError('Provider not found for selected dates');
        setProvider(paramProvider);
        return;
      }
      setProvider(match);
    } finally {
      setLoading(false);
    }
  }, [isQtech, startDate, endDate, providerId, providerName, paramProvider]);

  useEffect(() => {
    void loadProvider();
  }, [loadProvider]);

  const openUserStats = useCallback(
    (game: GameRow) => {
      if (!isQtech) return;
      const gameId = resolveGameId(game);
      if (!gameId) return;
      openPanelTarget(navigation, {
        href: '/game-activity/user-stats',
        state: {
          gameId,
          gameName: resolveGameName(game),
          startDate,
          endDate,
        },
      });
    },
    [isQtech, navigation, startDate, endDate],
  );

  const games = useMemo<GameRow[]>(
    () => (Array.isArray(provider?.games) ? (provider!.games as GameRow[]) : []),
    [provider],
  );

  const title =
    (provider ? providerLabel(provider) : providerName) || 'Provider';

  if (!provider && !loading) {
    return (
      <View style={[styles.screen, styles.centerBox]}>
        <Text style={styles.empty}>
          {error || 'No provider selected. Open a provider from Games Activity.'}
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
          onRefresh={() => void loadProvider()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{title} — Games</Text>
      <Text style={styles.sub}>
        {isQtech
          ? 'Tap card for details · Long-press for user stats'
          : 'Tap a card for full details'}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && games.length === 0 ? <Text style={styles.hint}>Loading games…</Text> : null}
      {!loading && games.length === 0 ? <Text style={styles.hint}>No games for this provider</Text> : null}

      <View style={styles.list}>
        {games.map((game, index) => {
          const ggr = gameGgr(game);
          return (
            <TouchableOpacity
              key={`game-${index}-${String(game.gameId || game.Name || '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSelected(game)}
              onLongPress={() => openUserStats(game)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index}</Text>
                <Text
                  style={[styles.cardTitle, isQtech && styles.cardTitleLink]}
                  numberOfLines={1}
                >
                  {gameName(game)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>
                  Bet: {fmt(game.totalBetAmount ?? game.betAmount)}
                </Text>
                <Text
                  style={[
                    styles.cardSplitRight,
                    { color: ggr < 0 ? colors.destructive : colors.success },
                  ]}
                >
                  GGR: {fmt(ggr)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>
                  Win: {fmt(game.totalWinAmount ?? game.winAmount)}
                </Text>
                <Text style={styles.cardSplitRight}>RTP: {String(game.rtp ?? '—')}</Text>
              </View>
              <Text style={styles.cardHint}>
                {isQtech
                  ? 'Tap for details · Long-press for user stats'
                  : 'Tap for details'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? gameName(selected) : ''}
        fields={selected ? gameDetailFields(selected, isQtech) : []}
        onClose={() => setSelected(null)}
        actions={
          selected && isQtech
            ? [
                {
                  label: 'User Stats',
                  tone: 'primary',
                  onPress: () => {
                    openUserStats(selected);
                    setSelected(null);
                  },
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
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
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
