/**
 * Players RTP — mobile port of desktop PlayerRtpPage.
 * Type selector (Qtech / WCO / Satta Matka / Falcon / Exchange / AAA Exchange);
 * only Qtech (ops.playerRtpQtech) and AAA Exchange (ops.playerRtpExchange) have
 * wired APIs — other types show "not available yet" (same as desktop).
 * Date filter + userId/gameId search. Card tap opens a popup with all fields; for
 * Qtech the per-game breakdown is listed there (desktop opens a details route).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type RtpType = 'Qtech' | 'WCO' | 'Satta Matka' | 'Falcon' | 'Exchange' | 'AAA Exchange';

type QtechGame = {
  gameId?: string;
  totalAmount?: number;
  totalBets?: number;
  totalWins?: number;
  winAmount?: number;
  winPercentage?: number;
};

type QtechRow = {
  userId: string;
  games?: QtechGame[];
  combined?: {
    totalAmount?: number;
    totalBets?: number;
    totalWins?: number;
    winAmount?: number;
    winPercentage?: number;
  };
};

type ExchangeRow = {
  userId: string;
  amount?: number;
  clientName?: string;
  name?: string;
  provider?: string;
  totalBets?: number;
  winLoss?: number;
};

type PlayerRtpRow = QtechRow | ExchangeRow;

type SheetState =
  | { kind: 'qtech'; row: QtechRow }
  | { kind: 'exchange'; row: ExchangeRow }
  | null;

const TYPE_OPTIONS: RtpType[] = [
  'Qtech',
  'WCO',
  'Satta Matka',
  'Falcon',
  'Exchange',
  'AAA Exchange',
];

/** Only these have RTP APIs wired (same as desktop TYPE_CONFIG). */
const SUPPORTED_RTP_TYPES = new Set<RtpType>(['Qtech', 'AAA Exchange']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatAmount(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** Old UI: Object.entries(res?.payload || {}). Tolerant map/array unpack. */
function unpackExchangeRows(data: unknown, filterUserId: string): ExchangeRow[] {
  const asMap = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };

  const envelope = asMap(data) || {};
  let map: Record<string, unknown> | unknown[] =
    asMap(envelope.payload) ||
    asMap(envelope.data) ||
    asMap(envelope.result) ||
    asMap(envelope.report) ||
    envelope;

  if (Array.isArray(envelope.payload)) map = envelope.payload as unknown[];

  if (typeof envelope.payload === 'string') {
    try {
      const parsed = JSON.parse(envelope.payload) as unknown;
      map = asMap(parsed) || (Array.isArray(parsed) ? (parsed as unknown[]) : map);
    } catch {
      /* ignore */
    }
  }

  const list: ExchangeRow[] = [];

  if (Array.isArray(map)) {
    for (const item of map) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const id = String(row.userId || row._id || row.id || '');
      if (!id) continue;
      list.push({ ...(row as Omit<ExchangeRow, 'userId'>), userId: id });
    }
  } else if (map) {
    for (const [id, value] of Object.entries(map)) {
      if (!id || id === 'payload' || id === 'data' || id === 'success' || id === 'message') {
        continue;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      list.push({ ...(value as Omit<ExchangeRow, 'userId'>), userId: id });
    }
  }

  if (!filterUserId.trim()) return list;
  return list.filter((row) => row.userId === filterUserId.trim());
}

function unpackQtechRows(data: unknown): QtechRow[] {
  if (Array.isArray(data)) return data as QtechRow[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return obj.payload as QtechRow[];
    if (Array.isArray(obj.items)) return obj.items as QtechRow[];
    if (Array.isArray(obj.data)) return obj.data as QtechRow[];
  }
  return [];
}

/** Win% row highlight (desktop rowBgSx): >85 red, >70 amber. */
function winPctBadge(winPercentage: number | undefined): string | undefined {
  const pct = Number(winPercentage) || 0;
  if (pct > 85) return '#dc2626';
  if (pct > 70) return '#f59e0b';
  return undefined;
}

/** Translucent card background by win% (desktop rowBgSx parity). */
function winPctRowBg(winPercentage: number | undefined): string | undefined {
  const pct = Number(winPercentage) || 0;
  if (pct > 85) return 'rgba(220,38,38,0.18)';
  if (pct > 70) return 'rgba(245,158,11,0.15)';
  return undefined;
}

export function PlayerRtpScreen() {
  const [type, setType] = useState<RtpType>('Qtech');
  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [draftUserId, setDraftUserId] = useState('');
  const [draftGameId, setDraftGameId] = useState('');
  const [userId, setUserId] = useState('');
  const [gameId, setGameId] = useState('');
  const [rows, setRows] = useState<PlayerRtpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (!SUPPORTED_RTP_TYPES.has(type)) {
        setRows([]);
        return;
      }
      const action = type === 'Qtech' ? 'ops.playerRtpQtech' : 'ops.playerRtpExchange';
      const res = await secureApi<unknown>(action, {
        startDate,
        endDate,
        userId: userId || '',
        gameId: type === 'Qtech' ? gameId : '',
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load players RTP');
        setRows([]);
        return;
      }
      if (type === 'Qtech') {
        setRows(unpackQtechRows(res.data));
      } else {
        const list = unpackExchangeRows(res.data, userId);
        setRows(list);
        if (list.length === 0 && res.message) setInfo(res.message);
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [type, startDate, endDate, userId, gameId]);

  useEffect(() => {
    void load();
    // reload on type/userId/gameId change (matches desktop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, userId, gameId, startDate, endDate]);

  const search = useCallback(() => {
    setUserId(draftUserId.trim());
    setGameId(draftGameId.trim());
  }, [draftUserId, draftGameId]);

  const isQtech = type === 'Qtech';
  const isSupported = SUPPORTED_RTP_TYPES.has(type);

  const sheetFields: SheetField[] = useMemo(() => {
    if (!sheet) return [];
    if (sheet.kind === 'exchange') {
      const r = sheet.row;
      const winLoss = Number(r.winLoss) || 0;
      return [
        { label: 'User ID', value: display(r.userId) },
        { label: 'Name', value: display(r.name) },
        { label: 'App Code', value: appCodeForName(r.clientName) },
        { label: 'Provider', value: display(r.provider) },
        { label: 'Amount', value: formatAmount(r.amount) },
        { label: 'Total Bets', value: display(r.totalBets) },
        {
          label: 'Win Loss',
          value: formatAmount(r.winLoss ?? 0),
          color: winLoss < 0 ? colors.destructive : '#16a34a',
        },
      ];
    }

    const row = sheet.row;
    const games = [...(row.games || [])].sort(
      (a, b) => (Number(b.winPercentage) || 0) - (Number(a.winPercentage) || 0),
    );
    const fields: SheetField[] = [
      { label: 'User ID', value: display(row.userId) },
      { label: 'Game Count', value: String(row.games?.length || 0) },
      { label: 'Total Amount', value: formatAmount(row.combined?.totalAmount ?? 0) },
      { label: 'Total Bets', value: display(row.combined?.totalBets ?? 0) },
      { label: 'Total Wins', value: display(row.combined?.totalWins ?? 0) },
      { label: 'Total Wins Amount', value: formatAmount(row.combined?.winAmount ?? 0) },
      {
        label: 'Total Win %',
        value: display(row.combined?.winPercentage ?? 0),
        badgeColor: winPctBadge(row.combined?.winPercentage),
      },
    ];
    games.forEach((g, i) => {
      fields.push({
        label: `Game ${i + 1} — ${g.gameId || '—'}`,
        value: `Amt ${formatAmount(g.totalAmount ?? 0)} · Bets ${display(g.totalBets ?? 0)} · Wins ${display(
          g.totalWins ?? 0,
        )} · Win Amt ${formatAmount(g.winAmount ?? 0)} · Win% ${display(g.winPercentage ?? 0)}`,
        multiline: true,
      });
    });
    return fields;
  }, [sheet]);

  const qtechRows = rows as QtechRow[];
  const exchangeRows = rows as ExchangeRow[];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{toDisplayText('Players RTP')}</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · {rows.length.toLocaleString('en-IN')} rows
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

      <View style={styles.chipsWrap}>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, type === opt && styles.chipActive]}
            onPress={() => {
              setType(opt);
              setDraftUserId('');
              setDraftGameId('');
              setUserId('');
              setGameId('');
              setSheet(null);
            }}
          >
            <Text style={[styles.chipText, type === opt && styles.chipTextActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={draftUserId}
          onChangeText={setDraftUserId}
          onSubmitEditing={search}
          returnKeyType="search"
          placeholder="Search by User ID"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isQtech ? (
          <TextInput
            style={styles.searchInput}
            value={draftGameId}
            onChangeText={setDraftGameId}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="Search Game ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : null}
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {info && !error ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{info}</Text>
        </View>
      ) : null}

      {!isSupported ? (
        <View style={styles.unavailableCard}>
          <Text style={styles.empty}>{type} RTP is not available yet</Text>
        </View>
      ) : (
        <>
          {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
          {!loading && rows.length === 0 ? (
            <Text style={styles.hint}>No RTP data found</Text>
          ) : null}

          {isQtech ? (
            <View style={styles.list}>
              {qtechRows.map((row, index) => {
                const winPct = row.combined?.winPercentage;
                const badge = winPctBadge(winPct);
                const bg = winPctRowBg(winPct);
                return (
                  <TouchableOpacity
                    key={`row-${index}-${String(row.userId ?? '')}`}
                    style={[styles.card, bg ? { backgroundColor: bg } : null]}
                    activeOpacity={0.75}
                    onPress={() => setSheet({ kind: 'qtech', row })}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardIndex}>#{index + 1}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {display(row.userId)}
                      </Text>
                      <Text style={[styles.winPill, badge ? { color: badge, borderColor: badge } : null]}>
                        Win%: {display(winPct ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft}>
                        Amount: {formatAmount(row.combined?.totalAmount ?? 0)}
                      </Text>
                      <Text style={styles.cardSplitRight}>
                        Games: {row.games?.length || 0}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft}>
                        Bets: {display(row.combined?.totalBets ?? 0)}
                      </Text>
                      <Text style={styles.cardSplitRight}>
                        Wins: {display(row.combined?.totalWins ?? 0)}
                      </Text>
                    </View>
                    <Text style={styles.cardHint}>Tap card for game breakdown</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.list}>
              {exchangeRows.map((row, index) => {
                const winLoss = Number(row.winLoss) || 0;
                return (
                  <TouchableOpacity
                    key={`row-${index}-${String(row.userId ?? '')}`}
                    style={styles.card}
                    activeOpacity={0.75}
                    onPress={() => setSheet({ kind: 'exchange', row })}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardIndex}>#{index + 1}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {display(row.name) !== '—' ? display(row.name) : display(row.userId)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft} numberOfLines={1}>
                        App Code: {appCodeForName(row.clientName)}
                      </Text>
                      <Text
                        style={[
                          styles.cardSplitRight,
                          { color: winLoss < 0 ? colors.destructive : '#16a34a' },
                        ]}
                        numberOfLines={1}
                      >
                        P/L: {formatAmount(row.winLoss ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.cardSplitRow}>
                      <Text style={styles.cardSplitLeft}>
                        Amount: {formatAmount(row.amount)}
                      </Text>
                      <Text style={styles.cardSplitRight}>
                        Bets: {display(row.totalBets)}
                      </Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>User ID</Text>
                      <Text style={styles.cardValue} numberOfLines={1}>
                        {display(row.userId)}
                      </Text>
                    </View>
                    <Text style={styles.cardHint}>Tap card for details</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      <RowDetailSheet
        visible={sheet !== null}
        title={
          sheet
            ? sheet.kind === 'qtech'
              ? `User ${display(sheet.row.userId)}`
              : display(sheet.row.name) !== '—'
                ? display(sheet.row.name)
                : `User ${display(sheet.row.userId)}`
            : ''
        }
        fields={sheetFields}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  unavailableCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
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
  winPill: {
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    color: colors.foreground,
    overflow: 'hidden',
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
    textAlign: 'right',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  infoBox: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  infoText: { color: colors.foreground, fontSize: 13 },
});
