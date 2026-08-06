/**
 * Players RTP — mobile port of desktop PlayerRtpPage.
 * Type selector (Qtech / WCO / Satta Matka / Falcon / Exchange / AAA Exchange);
 * only Qtech (ops.playerRtpQtech) and AAA Exchange (ops.playerRtpExchange) have
 * wired APIs — other types show "not available yet" (same as desktop).
 * Date filter + userId/gameId search. Row tap opens a popup with all fields; for
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
  useWindowDimensions,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
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
  const [sheetRow, setSheetRow] = useState<QtechRow | null>(null);
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

  // Fit the visible (main) columns to the phone width so there is no
  // horizontal scroll. Widths scale with the screen size.
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 34;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);
  // Qtech main columns: userId(3) gameCount(2) totalAmount(3) winPct(2)
  const qtechW = {
    userId: fit(3, 10),
    gameCount: fit(2, 10),
    totalAmount: fit(3, 10),
    winPct: fit(2, 10),
  };
  // Exchange main columns: userId(3) amount(2.5) name(3) winLoss(2.5)
  const exchW = {
    userId: fit(3, 11),
    amount: fit(2.5, 11),
    name: fit(3, 11),
    winLoss: fit(2.5, 11),
  };

  const qtechColumns = useMemo<DataTableColumn<QtechRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      { key: 'userId', label: 'User ID', width: qtechW.userId, render: (r) => display(r.userId) },
      {
        key: 'games',
        label: 'Games',
        width: 200,
        render: (r) =>
          [...(r.games || [])]
            .sort((a, b) => (Number(b.winPercentage) || 0) - (Number(a.winPercentage) || 0))
            .map((g) => g.gameId)
            .filter(Boolean)
            .join(', ') || '—',
      },
      {
        key: 'gameCount',
        label: 'Games',
        width: qtechW.gameCount,
        align: 'center',
        render: (r) => String(r.games?.length || 0),
      },
      { key: 'totalAmount', label: 'Amount', width: qtechW.totalAmount, align: 'right', render: (r) => formatAmount(r.combined?.totalAmount ?? 0) },
      { key: 'totalBets', label: 'Total Bets', width: 100, align: 'right', render: (r) => display(r.combined?.totalBets ?? 0) },
      { key: 'totalWins', label: 'Total Wins', width: 100, align: 'right', render: (r) => display(r.combined?.totalWins ?? 0) },
      { key: 'winAmount', label: 'Total Wins Amount', width: 130, align: 'right', render: (r) => formatAmount(r.combined?.winAmount ?? 0) },
      {
        key: 'winPct',
        label: 'Win %',
        width: qtechW.winPct,
        render: (r) => display(r.combined?.winPercentage ?? 0),
        badge: (r) => winPctBadge(r.combined?.winPercentage),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableWidth],
  );

  const exchangeColumns = useMemo<DataTableColumn<ExchangeRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      { key: 'userId', label: 'User ID', width: exchW.userId, render: (r) => display(r.userId) },
      { key: 'amount', label: 'Amount', width: exchW.amount, align: 'right', render: (r) => formatAmount(r.amount) },
      { key: 'clientName', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'name', label: 'Name', width: exchW.name, render: (r) => display(r.name) },
      { key: 'provider', label: 'Provider', width: 120, render: (r) => display(r.provider) },
      { key: 'totalBets', label: 'Total Bets', width: 100, align: 'right', render: (r) => display(r.totalBets) },
      {
        key: 'winLoss',
        label: 'Win Loss',
        width: exchW.winLoss,
        align: 'right',
        render: (r) => formatAmount(r.winLoss ?? 0),
        color: (r) => (Number(r.winLoss) < 0 ? colors.destructive : '#16a34a'),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableWidth],
  );

  const isQtech = type === 'Qtech';
  const isSupported = SUPPORTED_RTP_TYPES.has(type);

  const sheetFields: SheetField[] = useMemo(() => {
    if (!sheetRow) return [];
    const games = [...(sheetRow.games || [])].sort(
      (a, b) => (Number(b.winPercentage) || 0) - (Number(a.winPercentage) || 0),
    );
    const fields: SheetField[] = [
      { label: 'User ID', value: display(sheetRow.userId) },
      { label: 'Game Count', value: String(sheetRow.games?.length || 0) },
      { label: 'Total Amount', value: formatAmount(sheetRow.combined?.totalAmount ?? 0) },
      { label: 'Total Bets', value: display(sheetRow.combined?.totalBets ?? 0) },
      { label: 'Total Wins', value: display(sheetRow.combined?.totalWins ?? 0) },
      { label: 'Total Wins Amount', value: formatAmount(sheetRow.combined?.winAmount ?? 0) },
      {
        label: 'Total Win %',
        value: display(sheetRow.combined?.winPercentage ?? 0),
        badgeColor: winPctBadge(sheetRow.combined?.winPercentage),
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
  }, [sheetRow]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Players RTP</Text>
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
        <View style={styles.card}>
          <Text style={styles.empty}>{type} RTP is not available yet</Text>
        </View>
      ) : isQtech ? (
        <DataTable
          columns={qtechColumns.filter((c) =>
            ['idx', 'userId', 'gameCount', 'totalAmount', 'winPct'].includes(c.key),
          )}
          rows={rows as QtechRow[]}
          keyFor={(r, i) => String(r.userId || i)}
          loading={loading}
          emptyMessage="No RTP data found"
          onRowPress={(row) => setSheetRow(row)}
          hint="Tap a row to see all games"
        />
      ) : (
        <DataTable
          columns={exchangeColumns.filter((c) =>
            ['idx', 'userId', 'amount', 'name', 'winLoss'].includes(c.key),
          )}
          rows={rows as ExchangeRow[]}
          keyFor={(r, i) => String(r.userId || i)}
          loading={loading}
          emptyMessage="No RTP data found"
          onRowPress={(row) =>
            setSheetRow({ userId: row.userId, games: [], combined: {} })
          }
          hint="Tap a row to see details"
        />
      )}

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? `User ${display(sheetRow.userId)}` : ''}
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
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
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
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
