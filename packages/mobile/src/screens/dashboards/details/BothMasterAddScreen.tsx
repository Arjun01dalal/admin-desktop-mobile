/**
 * Live Match Total (AAA & Master AAA) — port of desktop BothMasterAddPage.
 * Combines dashboard.zehnRiskOs (Laxmi / AAA) and dashboard.zehnRiskVip (Master AAA)
 * into per-match team totals across MATCH_ODDS / Bookmaker / BookmakerAndMatchOdds.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { secureApi } from '../../../api/client';
import { toNum } from '../../../dashboards/mergeMetrics';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';

type TeamTotals = {
  team: string;
  MATCH_ODDS: number;
  Bookmaker: number;
  BookmakerAndMatchOdds: number;
  total: number;
};

type MatchTotals = {
  match: string;
  teams: TeamTotals[];
};

const VALID_MARKETS = ['MATCH_ODDS', 'Bookmaker', 'BookmakerAndMatchOdds'];

function normalize(name: string) {
  return name.trim().toLowerCase();
}

type RiskGame = {
  game?: { gameName?: string };
  markets?: Array<{
    marketName?: string;
    riskData?: Array<{ runner?: string; pl?: number }>;
  }>;
};

function calculateTeamWiseTotals(
  obj1: unknown[],
  obj2: unknown[],
): MatchTotals[] {
  const result: MatchTotals[] = [];

  obj1.forEach((game1Raw) => {
    const game1 = (game1Raw || {}) as RiskGame;
    const matchName = game1?.game?.gameName;
    if (!matchName) return;

    const game2 = obj2.find((g) => {
      const row = (g || {}) as RiskGame;
      return row?.game?.gameName === matchName;
    }) as RiskGame | undefined;
    if (!game2) return;

    const teamMap: Record<string, TeamTotals> = {};

    const processMarkets = (
      markets: Array<{
        marketName?: string;
        riskData?: Array<{ runner?: string; pl?: number }>;
      }> = [],
    ) => {
      markets.forEach((market) => {
        const marketName = market.marketName || '';
        if (!VALID_MARKETS.includes(marketName)) return;
        market.riskData?.forEach((runner) => {
          const key = normalize(String(runner.runner || ''));
          if (!teamMap[key]) {
            teamMap[key] = {
              team: String(runner.runner || ''),
              MATCH_ODDS: 0,
              Bookmaker: 0,
              BookmakerAndMatchOdds: 0,
              total: 0,
            };
          }
          const bucket = marketName as keyof Pick<
            TeamTotals,
            'MATCH_ODDS' | 'Bookmaker' | 'BookmakerAndMatchOdds'
          >;
          teamMap[key][bucket] += toNum(runner.pl);
        });
      });
    };

    processMarkets(game1.markets);
    processMarkets(game2.markets);

    Object.values(teamMap).forEach((team) => {
      team.total =
        team.MATCH_ODDS + team.Bookmaker + team.BookmakerAndMatchOdds;
    });

    result.push({ match: matchName, teams: Object.values(teamMap) });
  });

  return result;
}

function unpackList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.payload)) return obj.payload;
    if (Array.isArray(obj.result)) return obj.result;
  }
  return [];
}

function fmt(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function TeamRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.teamRow}>
      <Text style={styles.teamLabel}>{label}</Text>
      <Text style={[styles.teamValue, value < 0 && styles.negative]}>
        {fmt(value)}
      </Text>
    </View>
  );
}

export function BothMasterAddScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commonData, setCommonData] = useState<MatchTotals[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        secureApi('dashboard.zehnRiskOs', {}),
        secureApi('dashboard.zehnRiskVip', {}),
      ]);
      if (!res1.ok || !res2.ok) {
        setError(
          res1.message || res2.message || 'Failed to load AAA / Master AAA risk',
        );
        setCommonData([]);
        return;
      }
      const data1 = unpackList(res1.data);
      const data2 = unpackList(res2.data);
      setError('');
      setCommonData(calculateTeamWiseTotals(data1, data2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setCommonData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(
    () =>
      commonData.filter((m) => m.teams[0] && m.teams[1]),
    [commonData],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{toDisplayText('Live Match Total (AAA & Master AAA)')}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && cards.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && cards.length === 0 && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No live match risk data available.</Text>
        </View>
      ) : null}

      {cards.map((matchItem, index) => {
        const team1 = matchItem.teams[0];
        const team2 = matchItem.teams[1];
        return (
          <View style={styles.card} key={`${matchItem.match}-${index}`}>
            <Text style={styles.matchName}>{matchItem.match}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>BOOKMAKER</Text>
              <TeamRow label={`${team1.team}:`} value={team1.Bookmaker} />
              <TeamRow label={`${team2.team}:`} value={team2.Bookmaker} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MATCH ODDS</Text>
              <TeamRow label={`${team1.team}:`} value={team1.MATCH_ODDS} />
              <TeamRow label={`${team2.team}:`} value={team2.MATCH_ODDS} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>TOTAL</Text>
              <TeamRow label={`${team1.team}:`} value={team1.total} />
              <TeamRow label={`${team2.team}:`} value={team2.total} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  loading: { paddingVertical: spacing(8), alignItems: 'center' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  emptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  matchName: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
    marginBottom: spacing(3),
  },
  section: { marginBottom: spacing(3) },
  sectionTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing(1.5),
  },
  teamLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  teamValue: { color: colors.success, fontSize: 13, fontWeight: '700' },
  negative: { color: colors.destructive },
});
