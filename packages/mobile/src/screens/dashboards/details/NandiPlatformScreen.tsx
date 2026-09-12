/**
 * Shatabhisha / Satta Matka platform detail — Laxmi `/nandi-platform`.
 * Opened from ops dashboard Satta Matka card.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  NANDI_MARKET_TABS,
  buildNandiDetailCards,
  buildNandiSessionMetrics,
  extractNandiPlayersList,
  formatNandiDetailValue,
  isRealNandiBazarId,
  mapNandiPlayerRow,
  nandiMetricTone,
  normalizeNandiBazarCards,
  normalizeNandiSessionLabel,
  unwrapNandiPayload,
  type NandiBazarCard,
  type NandiMarketKey,
  type NandiSessionRow,
} from '@astro/shared';
import { secureApi } from '../../../api/client';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar, PAGE_SIZE_OPTIONS } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

function toneColor(tone?: string): string {
  if (tone === 'neg') return colors.destructive;
  if (tone === 'pos') return colors.success;
  return colors.foreground;
}

export function NandiPlatformScreen() {
  const navigation = useNavigation<any>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [market, setMarket] = useState<NandiMarketKey>('regular');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailCards, setDetailCards] = useState(() => buildNandiDetailCards(null));
  const [bazars, setBazars] = useState<NandiBazarCard[]>([]);

  const [playersOpen, setPlayersOpen] = useState(false);
  const [players, setPlayers] = useState<Record<string, unknown>[]>([]);
  const [playersTotal, setPlayersTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBazarId, setSelectedBazarId] = useState('');
  const [selectedBazarName, setSelectedBazarName] = useState('');
  const [selectedSession, setSelectedSession] = useState('Open');
  const [selectedPlayer, setSelectedPlayer] = useState<Record<string, unknown> | null>(null);

  const playersReqId = useRef(0);

  const loadDetails = useCallback(async (from: string, to: string) => {
    setDetailsLoading(true);
    try {
      const res = await secureApi<unknown>('dashboard.nandiPlatformDetails', {
        startDate: from,
        endDate: to,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load platform details');
        setDetailCards([]);
        return;
      }
      setDetailCards(buildNandiDetailCards(unwrapNandiPayload(res.data)));
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const loadByMarket = useCallback(async (from: string, to: string, nextMarket: NandiMarketKey) => {
    setMarketLoading(true);
    try {
      const res = await secureApi<unknown>('dashboard.nandiPlatformByMarket', {
        startDate: from,
        endDate: to,
        market: nextMarket,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load market data');
        setBazars([]);
        return;
      }
      setBazars(normalizeNandiBazarCards(res.data));
      setPlayersOpen(false);
      setPlayers([]);
      setSelectedPlayer(null);
      setSelectedBazarId('');
      setSelectedBazarName('');
      setSelectedSession('Open');
      setPageNo(1);
    } finally {
      setMarketLoading(false);
    }
  }, []);

  const loadPlayers = useCallback(
    async (opts?: {
      from?: string;
      to?: string;
      selectedMarket?: NandiMarketKey;
      bazarId?: string;
      session?: string;
      page?: number;
      perPage?: number;
    }) => {
      const from = opts?.from ?? startDate;
      const to = opts?.to ?? endDate;
      const selectedMarket = opts?.selectedMarket ?? market;
      const bazarId = opts?.bazarId ?? selectedBazarId;
      const session = normalizeNandiSessionLabel(opts?.session ?? selectedSession);
      const page = opts?.page ?? pageNo;
      const perPage = opts?.perPage ?? pageSize;
      const reqId = ++playersReqId.current;

      setPlayersLoading(true);
      try {
        const body: Record<string, unknown> = {
          startDate: from,
          endDate: to,
          market: selectedMarket,
          session,
          pageNo: page,
          itemsPerPage: perPage,
        };
        if (isRealNandiBazarId(bazarId)) body.bazarId = bazarId;

        const res = await secureApi<unknown>('dashboard.nandiPlatformPlayers', body);
        if (reqId !== playersReqId.current) return;
        if (!res.ok) {
          setError(res.message || 'Failed to load players');
          setPlayers([]);
          setPlayersTotal(0);
          setTotalPages(1);
          return;
        }
        const parsed = extractNandiPlayersList(res.data);
        setPlayers(parsed.list);
        setPlayersTotal(parsed.totalCount);
        setTotalPages(parsed.totalPages);
        setPageNo(page);
      } finally {
        if (reqId === playersReqId.current) setPlayersLoading(false);
      }
    },
    [endDate, market, pageNo, pageSize, selectedBazarId, selectedSession, startDate],
  );

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([loadDetails(startDate, endDate), loadByMarket(startDate, endDate, market)]);
  }, [endDate, loadByMarket, loadDetails, market, startDate]);

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSessionPlayers = (sessionRow: NandiSessionRow, bazar: NandiBazarCard) => {
    const session = normalizeNandiSessionLabel(sessionRow.session, 'Open');
    setError(null);
    setSelectedBazarId(bazar.bazarId);
    setSelectedBazarName(bazar.bazarName);
    setSelectedSession(session);
    setPageNo(1);
    setPlayers([]);
    setPlayersOpen(true);
    void loadPlayers({
      bazarId: bazar.bazarId,
      session,
      page: 1,
      selectedMarket: market,
    });
  };

  const closePlayers = () => {
    playersReqId.current += 1;
    setPlayersOpen(false);
    setPlayersLoading(false);
    setSelectedPlayer(null);
  };

  const marketLabel = NANDI_MARKET_TABS.find((t) => t.key === market)?.label ?? market;
  const loading = detailsLoading || marketLoading;

  const playerSheetFields = useMemo<SheetField[]>(() => {
    if (!selectedPlayer) return [];
    const view = mapNandiPlayerRow(selectedPlayer, selectedSession);
    return [
      { label: 'User', value: view.userName },
      { label: 'Mobile', value: view.mobile },
      { label: 'Customer ID', value: view.customerId },
      { label: 'Partner Customer ID', value: view.partnerCustomerId },
      { label: 'Count', value: view.count },
      { label: 'Bet Count', value: view.betCount },
      { label: 'Bet', value: view.bet },
      { label: 'Win', value: view.win },
      { label: 'GGR', value: view.ggr, color: toneColor(view.ggrTone) },
      { label: 'Session', value: view.session },
    ];
  }, [selectedPlayer, selectedSession]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void refreshAll()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{toDisplayText('Satta Matka Platform')}</Text>
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
          setError(null);
          void loadDetails(draftStart, draftEnd);
          void loadByMarket(draftStart, draftEnd, market);
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Platform Details</Text>
        {detailsLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      <View style={styles.summaryGrid}>
        {detailCards.length === 0 && !detailsLoading ? (
          <Text style={styles.empty}>No summary data</Text>
        ) : (
          detailCards.map((card) => {
            const n = Number(card.value);
            const tone =
              /ggr|profit/i.test(card.label) && Number.isFinite(n) ? nandiMetricTone(n) : '';
            return (
              <View key={card.key} style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>{toDisplayText(card.label)}</Text>
                <Text style={[styles.summaryValue, { color: toneColor(tone) }]}>
                  {formatNandiDetailValue(card.value, card.format)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Markets</Text>
        {marketLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {NANDI_MARKET_TABS.map((tab) => {
            const active = market === tab.key;
            return (
              <Pressable
                key={tab.key}
                disabled={marketLoading}
                onPress={() => {
                  setMarket(tab.key);
                  setError(null);
                  void loadByMarket(startDate, endDate, tab.key);
                }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {marketLoading && bazars.length === 0 ? (
        <Text style={styles.empty}>Loading markets…</Text>
      ) : bazars.length === 0 ? (
        <Text style={styles.empty}>No market data for selected filters</Text>
      ) : (
        <View style={[styles.bazarList, marketLoading && styles.dimmed]}>
          {bazars.map((bazar) => {
            const selected = playersOpen && selectedBazarId === bazar.bazarId;
            return (
              <View key={bazar.bazarId} style={[styles.bazarCard, selected && styles.bazarCardSelected]}>
                <View style={styles.bazarHead}>
                  <View style={styles.bazarHeadMain}>
                    <Text style={styles.bazarName} numberOfLines={1}>
                      {bazar.bazarName}
                    </Text>
                    {(bazar.openTime || bazar.closeTime) && (
                      <Text style={styles.bazarTimes}>
                        {bazar.openTime ? `O ${bazar.openTime}` : ''}
                        {bazar.openTime && bazar.closeTime ? ' · ' : ''}
                        {bazar.closeTime ? `C ${bazar.closeTime}` : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.result, !bazar.result && styles.resultEmpty]} numberOfLines={2}>
                    {bazar.result || 'Not declared'}
                  </Text>
                </View>

                <View style={styles.metricGrid}>
                  {bazar.summary.map((m) => (
                    <View key={m.label} style={styles.metricCell}>
                      <Text style={styles.metricK}>{m.label}</Text>
                      <Text style={[styles.metricV, { color: toneColor(m.tone) }]}>{m.value}</Text>
                    </View>
                  ))}
                </View>

                {bazar.sessions.map((sessionRow, sIdx) => {
                  const sessionName = normalizeNandiSessionLabel(
                    sessionRow.session,
                    sIdx === 0 ? 'Open' : 'Close',
                  );
                  const active =
                    selected && selectedSession.toLowerCase() === sessionName.toLowerCase();
                  const metrics = buildNandiSessionMetrics(sessionRow);
                  return (
                    <Pressable
                      key={`${bazar.bazarId}-${sessionName}-${sIdx}`}
                      onPress={() =>
                        openSessionPlayers({ ...sessionRow, session: sessionName }, bazar)
                      }
                      style={[styles.session, active && styles.sessionActive]}
                    >
                      <Text style={styles.sessionLabel}>{sessionName}</Text>
                      <View style={styles.sessionGrid}>
                        {metrics.map((m) => (
                          <View key={m.label} style={styles.sessionCell}>
                            <Text style={styles.metricK}>{m.label}</Text>
                            <Text style={[styles.sessionV, { color: toneColor(m.tone) }]}>
                              {m.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={playersOpen} transparent animationType="slide" onRequestClose={closePlayers}>
        <View style={styles.modalBackdrop}>
          <TouchableWithoutFeedback onPress={closePlayers}>
            <View style={styles.modalTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Players · {selectedBazarName || selectedBazarId}
                </Text>
                <Text style={styles.modalMeta}>
                  {selectedSession} · {marketLabel} · Total {playersTotal.toLocaleString('en-IN')}
                </Text>
              </View>
              <TouchableOpacity onPress={closePlayers} hitSlop={10}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.playersBody}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.pageSizeRow}>
                  {PAGE_SIZE_OPTIONS.map((n) => {
                    const active = pageSize === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => {
                          setPageSize(n);
                          void loadPlayers({ page: 1, perPage: n });
                        }}
                        style={[styles.pageChip, active && styles.pageChipActive]}
                      >
                        <Text style={[styles.pageChipText, active && styles.pageChipTextActive]}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {playersLoading && players.length === 0 ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing(4) }} />
              ) : players.length === 0 ? (
                <Text style={styles.empty}>No players found</Text>
              ) : (
                players.map((player, index) => {
                  const view = mapNandiPlayerRow(player, selectedSession);
                  return (
                    <Pressable
                      key={`${view.userId || view.customerId}-${index}`}
                      style={styles.playerCard}
                      onPress={() => setSelectedPlayer(player)}
                    >
                      <View style={styles.playerTop}>
                        <Text style={styles.playerName} numberOfLines={1}>
                          {view.userName}
                        </Text>
                        <Text style={[styles.playerGgr, { color: toneColor(view.ggrTone) }]}>
                          {view.ggr}
                        </Text>
                      </View>
                      <Text style={styles.playerMeta}>
                        Bet {view.bet} · Win {view.win} · {view.session}
                      </Text>
                      <Pressable
                        onPress={() => {
                          if (!view.customerId || view.customerId === '-') return;
                          setSelectedPlayer(null);
                          closePlayers();
                          navigation.navigate('/user-report', {
                            userId: view.customerId,
                            userName: view.userName,
                          });
                        }}
                      >
                        <Text style={styles.playerLink}>{view.customerId}</Text>
                      </Pressable>
                    </Pressable>
                  );
                })
              )}

              {totalPages > 1 ? (
                <View style={styles.pager}>
                  <Pressable
                    disabled={pageNo <= 1 || playersLoading}
                    onPress={() => void loadPlayers({ page: pageNo - 1 })}
                    style={[styles.pagerBtn, pageNo <= 1 && styles.pagerDisabled]}
                  >
                    <Text style={styles.pagerText}>Prev</Text>
                  </Pressable>
                  <Text style={styles.pagerMeta}>
                    {pageNo} / {totalPages}
                  </Text>
                  <Pressable
                    disabled={pageNo >= totalPages || playersLoading}
                    onPress={() => void loadPlayers({ page: pageNo + 1 })}
                    style={[styles.pagerBtn, pageNo >= totalPages && styles.pagerDisabled]}
                  >
                    <Text style={styles.pagerText}>Next</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <RowDetailSheet
        visible={selectedPlayer !== null}
        title={mapNandiPlayerRow(selectedPlayer || {}, selectedSession).userName}
        fields={playerSheetFields}
        onClose={() => setSelectedPlayer(null)}
      />
    </ScrollView>
  );
}

const styles = makeStyles({
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  error: { color: colors.destructive, fontSize: 13, marginBottom: spacing(3) },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(4),
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
  summaryValue: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing(1),
  },
  empty: { color: colors.muted, fontSize: 13, marginBottom: spacing(3) },
  tabsScroll: { marginBottom: spacing(3) },
  tabs: { flexDirection: 'row', gap: spacing(2) },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  bazarList: { gap: spacing(3), marginBottom: spacing(4) },
  dimmed: { opacity: 0.55 },
  bazarCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    backgroundColor: colors.surface,
  },
  bazarCardSelected: { borderColor: colors.primary },
  bazarHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  bazarHeadMain: { flex: 1, minWidth: 0 },
  bazarName: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  bazarTimes: { color: colors.muted, fontSize: 11, marginTop: 2 },
  result: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: '42%',
    textAlign: 'right',
  },
  resultEmpty: { color: colors.muted },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(2) },
  metricCell: { width: '30%' },
  metricK: { color: colors.muted, fontSize: 10 },
  metricV: { color: colors.foreground, fontSize: 13, fontWeight: '700', marginTop: 2 },
  session: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(2),
    marginTop: spacing(2),
    backgroundColor: colors.background,
  },
  sessionActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  sessionLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
  sessionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  sessionCell: { width: '23%' },
  sessionV: { color: colors.foreground, fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalTouch: { flex: 1 },
  modalSheet: {
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(4),
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginVertical: spacing(2),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  modalMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  modalClose: { color: colors.muted, fontSize: 18, paddingHorizontal: 4 },
  playersBody: { gap: spacing(2), paddingBottom: spacing(6) },
  pageSizeRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(2) },
  pageChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  pageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pageChipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  pageChipTextActive: { color: '#fff' },
  playerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    backgroundColor: colors.background,
  },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(2) },
  playerName: { flex: 1, color: colors.foreground, fontWeight: '700', fontSize: 14 },
  playerGgr: { fontWeight: '700', fontSize: 14 },
  playerMeta: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  playerLink: { color: colors.primary, fontSize: 12, marginTop: spacing(1), fontWeight: '600' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    marginTop: spacing(2),
  },
  pagerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  pagerDisabled: { opacity: 0.4 },
  pagerText: { color: colors.foreground, fontWeight: '600' },
  pagerMeta: { color: colors.muted, fontSize: 13 },
});
