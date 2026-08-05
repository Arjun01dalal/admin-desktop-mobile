/**
 * Live Match Total — port of desktop LiveMatchTotalPage.
 * variant selects the book API:
 *   laxmi  -> dashboard.finalBookLaxmi
 *   master -> dashboard.finalBookVip
 *   both   -> dashboard.finalBookBoth
 * Also fetches dashboard.oddsGameList for live odds and merges by match name.
 * Polls every ~4s while focused, plus pull-to-refresh.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import type { SecureAction } from '../../../api/registry.generated';
import { toNum } from '../../../dashboards/mergeMetrics';
import { LiveStreamModal } from '../../../dashboards/ui/LiveStreamModal';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';

type Variant = 'laxmi' | 'master' | 'both';

type OddsCell = { price: string | number; size: string | number };
type FancyMarket = {
  marketName?: string;
  betSize?: unknown;
  result?: unknown;
  data: Record<string, number>;
};
type MatchRow = {
  matchName: string;
  sportName: string;
  teams: Record<string, number>;
  fancy: FancyMarket[];
  betSize?: unknown;
  oddsTeams?: OddsCell[];
  code?: string;
};

const BOOK_ACTION: Record<Variant, SecureAction> = {
  laxmi: 'dashboard.finalBookLaxmi',
  master: 'dashboard.finalBookVip',
  both: 'dashboard.finalBookBoth',
};

const TITLES: Record<Variant, string> = {
  laxmi: 'Live Match Total',
  master: 'Live Match Total (Master)',
  both: 'Live Match Total (Master & Laxmi)',
};

const POLL_MS = 4000;

function buildRunnerUI(input: unknown): Array<{
  eventName?: string;
  data: OddsCell[];
  code?: string;
}> {
  const matches = Array.isArray(input) ? input : [input];
  const build = (p: { price?: unknown; size?: unknown } | undefined): OddsCell => ({
    price: (p?.price as string | number) ?? '-',
    size: (p?.size as string | number) ?? '-',
  });

  return matches.map((match) => {
    const m = (match || {}) as {
      eventName?: string;
      code?: string;
      runners?: Array<{
        backPrices?: Array<{ price?: unknown; size?: unknown }>;
        layPrices?: Array<{ price?: unknown; size?: unknown }>;
      }>;
    };
    const runners = m.runners ?? [];
    if (runners.length === 0) {
      return { eventName: m.eventName, data: [], code: m.code };
    }
    const get = (i: number, type: 'back' | 'lay') =>
      build(runners?.[i]?.[`${type}Prices`]?.[0]);

    const data: OddsCell[] =
      runners.length >= 3
        ? [
            get(0, 'back'),
            get(0, 'lay'),
            get(2, 'back'),
            get(2, 'lay'),
            get(1, 'back'),
            get(1, 'lay'),
          ]
        : [
            get(0, 'back'),
            get(0, 'lay'),
            { price: '-', size: '-' },
            { price: '-', size: '-' },
            get(1, 'back'),
            get(1, 'lay'),
          ];

    return { eventName: m.eventName, data, code: m.code };
  });
}

function formatDataForUI(data: unknown): MatchRow[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const rowData = (item || {}) as {
      game?: { gameName?: string; sportName?: string };
      markets?: Array<{
        marketType?: string;
        marketName?: string;
        betSize?: unknown;
        result?: unknown;
        riskData?: Array<{ runner?: string; pl?: number }>;
      }>;
    };
    const matchName = String(rowData?.game?.gameName || '');
    const sportRaw = String(rowData?.game?.sportName || '').trim();
    const sportName = sportRaw.length > 0 ? sportRaw : 'Other';
    const result: MatchRow = { matchName, sportName, teams: {}, fancy: [] };

    rowData?.markets?.forEach((market) => {
      if (market.marketType === 'MARKET') {
        market?.riskData?.forEach((r) => {
          const team = String(r.runner || '').toLowerCase();
          result.teams[team] = (result.teams[team] || 0) + toNum(r.pl);
        });
      }
      if (market.marketType === 'FANCY') {
        const fancyObj: FancyMarket = {
          marketName: market.marketName,
          betSize: market?.betSize,
          result: market?.result,
          data: {},
        };
        market?.riskData?.forEach((r) => {
          const key = String(r.runner || '');
          fancyObj.data[key] = (fancyObj.data[key] || 0) + toNum(r.pl);
        });
        result.fancy.push(fancyObj);
      }
      result.betSize = market?.betSize;
    });

    return result;
  });
}

function mergeFinalData(
  finalRes: MatchRow[],
  matches: Array<{ eventName?: string; data: OddsCell[]; code?: string }>,
): MatchRow[] {
  return finalRes.map((match) => {
    const found = matches.find(
      (m) =>
        String(m.eventName || '').toLowerCase() ===
        String(match.matchName || '').toLowerCase(),
    );
    return {
      ...match,
      oddsTeams:
        found?.data ||
        (Array(6).fill({ price: '-', size: '-' }) as OddsCell[]),
      code: found?.code,
    };
  });
}

function groupBySport(data: MatchRow[]): Record<string, MatchRow[]> {
  return data.reduce<Record<string, MatchRow[]>>((acc, item) => {
    const sport = item?.sportName ?? '';
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(item);
    return acc;
  }, {});
}

function sortSports(
  grouped: Record<string, MatchRow[]>,
): Array<[string, MatchRow[]]> {
  return Object.entries(grouped).sort(([a], [b]) => {
    const A = a.toLowerCase();
    const B = b.toLowerCase();
    if (A === 'cricket') return -1;
    if (B === 'cricket') return 1;
    if (A === 'other') return 1;
    if (B === 'other') return -1;
    return A.localeCompare(B);
  });
}

function getClosestKey(
  data: Record<string, number>,
  result: unknown,
): number | null {
  if (result === '' || result == null) return null;
  const keys = Object.keys(data).map(Number);
  if (Object.prototype.hasOwnProperty.call(data, String(result))) {
    return Number(result);
  }
  if (keys.length === 0) return null;
  return keys.reduce((prev, curr) =>
    Math.abs(curr - Number(result)) < Math.abs(prev - Number(result))
      ? curr
      : prev,
  );
}

function unpackBookList(raw: unknown): unknown[] {
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

export function LiveMatchTotalScreen({ variant }: { variant: Variant }) {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const startDate =
    typeof params.startDate === 'string' ? params.startDate : todayIST();
  const endDate =
    typeof params.endDate === 'string' ? params.endDate : todayIST();

  const isFocused = useIsFocused();
  const orderRef = useRef<string[]>([]);
  const firstLoad = useRef(true);
  const mountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [groupedData, setGroupedData] = useState<Array<[string, MatchRow[]]>>(
    [],
  );
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Record<string, boolean>>({});
  const [streamId, setStreamId] = useState('');
  const [streamOpen, setStreamOpen] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      if (firstLoad.current) setLoading(true);

      let matches: Array<{
        eventName?: string;
        data: OddsCell[];
        code?: string;
      }> = [];
      try {
        const oddsRes = await secureApi('dashboard.oddsGameList', {});
        if (oddsRes.ok) {
          const oddsRaw = oddsRes.data;
          const oddsList =
            oddsRaw && typeof oddsRaw === 'object' && !Array.isArray(oddsRaw)
              ? ((oddsRaw as { data?: unknown }).data ?? oddsRaw)
              : oddsRaw;
          matches = buildRunnerUI(oddsList);
        }
      } catch {
        matches = [];
      }

      const bookRes = await secureApi(BOOK_ACTION[variant], {
        startDate,
        endDate,
      });
      if (!mountedRef.current) return;
      if (!bookRes.ok) {
        setError(bookRes.message || 'Failed to load live match book');
        setGroupedData([]);
        return;
      }

      const finalBook = formatDataForUI(unpackBookList(bookRes.data));
      const merged = mergeFinalData(finalBook, matches);

      if (firstLoad.current) {
        orderRef.current = merged.map((m) => m.matchName);
      }

      const stableSorted = [...merged].sort(
        (a, b) =>
          orderRef.current.indexOf(a.matchName) -
          orderRef.current.indexOf(b.matchName),
      );

      setError('');
      setGroupedData(sortSports(groupBySport(stableSorted)));
      firstLoad.current = false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [endDate, startDate, variant]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isFocused) return undefined;
    let active = true;
    void fetchAllData();
    const id = setInterval(() => {
      if (active) void fetchAllData();
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isFocused, fetchAllData]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void fetchAllData()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{TITLES[variant]}</Text>
      <Text style={styles.dateRange}>
        {startDate} → {endDate}
      </Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && groupedData.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && groupedData.length === 0 && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            No live match book data for this date range.
          </Text>
        </View>
      ) : null}

      {groupedData.map(([sport, matches]) => (
        <View style={styles.sportBlock} key={sport}>
          <Text style={styles.sportHeader}>{sport || 'Other'}</Text>
          {matches.map((match, mi) => {
            const cardKey = `${match.matchName}-${match.code || mi}`;
            const fancyList = match.fancy || [];
            const expanded = showAll[cardKey] ?? false;
            const visibleFancy = expanded
              ? fancyList
              : fancyList.slice(0, 7);
            const oddsLabels = ['1', 'X', '2'];
            const oddsGroups = [
              (match.oddsTeams || []).slice(0, 2),
              (match.oddsTeams || []).slice(2, 4),
              (match.oddsTeams || []).slice(4, 6),
            ];
            return (
              <View style={styles.card} key={cardKey}>
                <View style={styles.matchHeader}>
                  <Text style={styles.matchName}>{match.matchName}</Text>
                  {match.code ? (
                    <TouchableOpacity
                      style={styles.liveTvBtn}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        setStreamId(String(match.code || ''));
                        setStreamOpen(true);
                      }}
                    >
                      <Text style={styles.liveTvText}>📺 Live</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Live odds 1 / X / 2 */}
                <View style={styles.oddsWrap}>
                  {oddsGroups.map((group, gi) => (
                    <View style={styles.oddsGroup} key={`g-${gi}`}>
                      <Text style={styles.oddsLabel}>{oddsLabels[gi]}</Text>
                      <View style={styles.oddsCells}>
                        {group.map((cell, ci) => (
                          <View
                            style={[
                              styles.oddsCell,
                              ci === 0 ? styles.backCell : styles.layCell,
                            ]}
                            key={`c-${gi}-${ci}`}
                          >
                            <Text style={styles.oddsPrice}>
                              {String(cell?.price ?? '-')}
                            </Text>
                            <Text style={styles.oddsSize}>
                              {String(cell?.size ?? '-')}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Market runners */}
                {Object.keys(match.teams || {}).length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Market</Text>
                    {Object.entries(match.teams).map(([team, value]) => (
                      <View style={styles.plRow} key={team}>
                        <Text style={styles.plLabel}>{team}</Text>
                        <Text
                          style={[styles.plValue, value < 0 && styles.negative]}
                        >
                          {fmt(value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Fancy markets (collapsible) */}
                {visibleFancy.map((f, fi) => {
                  const uniqueKey = `${cardKey}-${f.marketName || fi}`;
                  const isOpen = openKey === uniqueKey;
                  const selectedKey = getClosestKey(f?.data || {}, f?.result);
                  return (
                    <View style={styles.fancyBlock} key={uniqueKey}>
                      <TouchableOpacity
                        style={styles.fancyHeader}
                        activeOpacity={0.7}
                        onPress={() =>
                          setOpenKey(isOpen ? null : uniqueKey)
                        }
                      >
                        <Text style={styles.fancyTitle}>
                          {`${f?.marketName} (Bet Size:- ${String(
                            f?.betSize ?? '',
                          )})`}
                        </Text>
                        <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                      </TouchableOpacity>
                      {isOpen
                        ? Object.entries(f?.data || {}).map(([key, val]) => {
                            const active = Number(key) === selectedKey;
                            return (
                              <View
                                style={[
                                  styles.fancyRow,
                                  active && styles.fancyRowActive,
                                ]}
                                key={key}
                              >
                                <Text
                                  style={[
                                    styles.fancyKey,
                                    active && styles.fancyKeyActive,
                                  ]}
                                >
                                  {key}
                                </Text>
                                <Text
                                  style={[
                                    styles.fancyVal,
                                    val < 0 && styles.negative,
                                  ]}
                                >
                                  {fmt(val)}
                                </Text>
                              </View>
                            );
                          })
                        : null}
                    </View>
                  );
                })}

                {fancyList.length > 10 ? (
                  <TouchableOpacity
                    onPress={() => {
                      setShowAll((prev) => ({
                        ...prev,
                        [cardKey]: !expanded,
                      }));
                      setOpenKey(null);
                    }}
                  >
                    <Text style={styles.showMore}>
                      {expanded ? 'Show Less' : 'Show More'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}

      <LiveStreamModal
        open={streamOpen}
        onClose={() => setStreamOpen(false)}
        streamId={streamId}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  dateRange: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
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
  sportBlock: { marginBottom: spacing(4) },
  sportHeader: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radius.sm,
    marginBottom: spacing(2),
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    marginBottom: spacing(3),
    paddingHorizontal: spacing(2),
  },
  matchName: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: spacing(2),
    flex: 1,
  },
  liveTvBtn: {
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
  },
  liveTvText: { color: colors.destructive, fontSize: 12, fontWeight: '800' },
  oddsWrap: { flexDirection: 'row', gap: spacing(1), marginBottom: spacing(3) },
  oddsGroup: { flex: 1 },
  oddsLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing(1),
  },
  oddsCells: { flexDirection: 'row', gap: spacing(0.5) },
  oddsCell: {
    flex: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing(1),
    alignItems: 'center',
  },
  backCell: { backgroundColor: '#1d4665' },
  layCell: { backgroundColor: '#90101a' },
  oddsPrice: { color: '#fff', fontSize: 11, fontWeight: '700' },
  oddsSize: { color: '#fff', fontSize: 9 },
  section: { marginBottom: spacing(3) },
  sectionTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing(1.5),
  },
  plRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
  },
  plLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  plValue: { color: colors.success, fontSize: 13, fontWeight: '700' },
  negative: { color: colors.destructive },
  fancyBlock: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing(2),
    marginBottom: spacing(2),
  },
  fancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fancyTitle: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  chevron: { color: colors.muted, fontSize: 12 },
  fancyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.sm,
    marginTop: spacing(0.5),
  },
  fancyRowActive: { backgroundColor: 'rgba(255,192,203,0.18)' },
  fancyKey: { color: colors.foreground, fontSize: 13 },
  fancyKeyActive: { fontWeight: '700' },
  fancyVal: { color: colors.success, fontSize: 13, fontWeight: '600' },
  showMore: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing(1),
  },
});
