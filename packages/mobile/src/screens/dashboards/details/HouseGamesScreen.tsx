/**
 * House Games — transactions list (Ludo admin).
 * Port of desktop HouseGamesPage with the mobile screen structure:
 * date filter, collapsible column filters (same filter payload as
 * desktop), paginated DataTable with main columns, bottom sheet with
 * every column, pull-to-refresh.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { colors, radius, spacing } from '../../../theme';
import { monthStartIST, todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type TxnRow = {
  _id?: string;
  name?: string;
  userId?: string;
  txnId?: string;
  transactionId?: string;
  refTxnId?: string;
  roundId?: string;
  sessionId?: string;
  gameId?: string;
  operatorId?: string;
  type?: string;
  status?: string;
  currency?: string;
  amount?: number;
  winingPoint?: number;
  roundCapacity?: number | string;
  isBot?: boolean | string | number;
  bot?: unknown;
  playerIdentity?: { bot?: unknown; real?: unknown };
  playerIdentityBot?: unknown;
  playerIdentityReal?: unknown;
  createdAt?: string;
  createdOn?: string;
  updatedAt?: string;
};

const ITEMS_PER_PAGE_OPTIONS = [50, 100, 200, 500];

/** Same shape as desktop INITIAL_FILTERS. */
const INITIAL_FILTERS = {
  userId: '',
  txnId: '',
  refTxnId: '',
  roundId: '',
  sessionId: '',
  gameId: '',
  operatorId: '',
  type: '',
  status: '',
  name: '',
  currency: '',
  roundCapacity: '',
  isBot: null as boolean | null,
  human: null as boolean | null,
  minAmount: '',
  maxAmount: '',
};
type FiltersState = typeof INITIAL_FILTERS;

const TEXT_FILTER_FIELDS: { key: keyof FiltersState; placeholder: string; numeric?: boolean }[] = [
  { key: 'name', placeholder: 'Name' },
  { key: 'userId', placeholder: 'User ID' },
  { key: 'txnId', placeholder: 'Txn ID' },
  { key: 'refTxnId', placeholder: 'Ref Txn ID' },
  { key: 'roundId', placeholder: 'Round ID' },
  { key: 'sessionId', placeholder: 'Session ID' },
  { key: 'gameId', placeholder: 'Game ID' },
  { key: 'operatorId', placeholder: 'Operator ID' },
  { key: 'currency', placeholder: 'Currency' },
  { key: 'roundCapacity', placeholder: 'Round Capacity', numeric: true },
  { key: 'minAmount', placeholder: 'Min Amount', numeric: true },
  { key: 'maxAmount', placeholder: 'Max Amount', numeric: true },
];

const TYPE_OPTIONS = ['', 'bet', 'win', 'refund'];
const STATUS_OPTIONS = ['', 'W', 'L'];

const NUMERIC_FILTER_KEYS = new Set(['roundCapacity', 'minAmount', 'maxAmount']);

/** Mirrors desktop buildFilterPayload (txnId also sent as transactionId). */
function buildFilterPayload(filters: FiltersState): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value === '' || value === null) return;
    if (key === 'isBot' || key === 'human') {
      filter[key] = value;
      return;
    }
    if (NUMERIC_FILTER_KEYS.has(key)) {
      const num = Number(value);
      if (!Number.isNaN(num)) filter[key] = num;
      return;
    }
    filter[key] = value;
  });
  if (filter.txnId) filter.transactionId = filter.txnId;
  return filter;
}

/** Mirrors desktop useHouseGamesQuery row unwrapping. */
function asRows(raw: unknown): TxnRow[] {
  if (Array.isArray(raw)) return raw as TxnRow[];
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  for (const key of ['items', 'transactions', 'results', 'docs', 'data']) {
    if (Array.isArray(obj[key])) return obj[key] as TxnRow[];
  }
  if (obj.data && typeof obj.data === 'object') {
    const nested = obj.data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items as TxnRow[];
  }
  return [];
}

function pickNumber(raw: unknown, keys: string[]): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    const v = key.includes('.')
      ? key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
      : obj[key];
    const n = Number(v);
    if (v !== undefined && v !== null && Number.isFinite(n)) return n;
  }
  return null;
}

function fmt2(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function fmtDate(row: TxnRow): string {
  const raw = row.createdAt || row.createdOn || row.updatedAt;
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} - ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Mirrors desktop getPlayerIdentity. */
function playerIdentity(row: TxnRow): string {
  if (row.playerIdentity) {
    return `Bot: ${row.playerIdentity.bot ?? '-'}, Real: ${row.playerIdentity.real ?? '-'}`;
  }
  if (row.playerIdentityBot !== undefined || row.playerIdentityReal !== undefined) {
    return `Bot: ${row.playerIdentityBot ?? '-'}, Real: ${row.playerIdentityReal ?? '-'}`;
  }
  return '-';
}

/** Mirrors desktop getIsBotValue. */
function isBotValue(row: TxnRow): string {
  if (row.isBot !== undefined) return String(row.isBot);
  if (row.bot !== undefined) return String(row.bot);
  return '-';
}

/** Columns shown in the list; tapping a row opens a sheet with every column. */
const MAIN_KEYS = new Set(['sr', 'name', 'amount', 'status', 'created']);

export function HouseGamesScreen() {
  const isFocused = useIsFocused();

  const [draftStart, setDraftStart] = useState(monthStartIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(monthStartIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [draftFilters, setDraftFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageNo, setPageNo] = useState(1);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TxnRow | null>(null);
  const genRef = React.useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        pageNo,
        itemsPerPage,
        startDate,
        endDate,
      };
      const filter = buildFilterPayload(filters);
      if (Object.keys(filter).length > 0) payload.filter = filter;

      const res = await secureApi('houseGames.transactions', payload);
      if (gen !== genRef.current) return; // stale response
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load house games');
        setRows([]);
        return;
      }
      const data = res.data;
      setRows(asRows(data));
      const count = pickNumber(data, ['total', 'count', 'totalCount', 'data.total', 'data.count']);
      setTotalCount(count);
      setTotalAmount(pickNumber(data, ['totals.totalAmount', 'data.totals.totalAmount']));
      const pages = pickNumber(data, ['totalPages', 'data.totalPages']);
      setTotalPages(pages ?? (count !== null ? Math.max(1, Math.ceil(count / itemsPerPage)) : 1));
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [pageNo, itemsPerPage, startDate, endDate, filters]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const setDraft = useCallback(
    <K extends keyof FiltersState>(key: K, value: FiltersState[K]) =>
      setDraftFilters((f) => ({ ...f, [key]: value })),
    [],
  );

  const applyAll = useCallback(() => {
    setPageNo(1);
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setFilters(draftFilters);
  }, [draftStart, draftEnd, draftFilters]);

  const rowOffset = (pageNo - 1) * itemsPerPage;

  const columns = useMemo<DataTableColumn<TxnRow>[]>(
    () => [
      { key: 'sr', label: 'SR.No', width: 60, render: (_r, i) => String(i + 1 + rowOffset) },
      { key: 'name', label: 'Name', width: 130, render: (r) => String(r.name || '-') },
      { key: 'userId', label: 'User ID', width: 130, render: (r) => String(r.userId || '-') },
      { key: 'txnId', label: 'Transaction ID', width: 160, render: (r) => String(r.txnId || r.transactionId || '-') },
      { key: 'refTxnId', label: 'Ref Txn ID', width: 160, render: (r) => String(r.refTxnId || '-') },
      { key: 'roundId', label: 'Round ID', width: 140, render: (r) => String(r.roundId || '-') },
      { key: 'sessionId', label: 'Session ID', width: 140, render: (r) => String(r.sessionId || '-') },
      { key: 'gameId', label: 'Game ID', width: 110, render: (r) => String(r.gameId || '-') },
      { key: 'operatorId', label: 'Operator ID', width: 110, render: (r) => String(r.operatorId || '-') },
      { key: 'type', label: 'Type', width: 90, render: (r) => String(r.type || '-') },
      { key: 'status', label: 'Status', width: 90, render: (r) => String(r.status || '-') },
      { key: 'currency', label: 'Currency', width: 90, render: (r) => String(r.currency || '-') },
      { key: 'amount', label: 'Amount', width: 110, align: 'right', render: (r) => fmt2(r.amount) },
      { key: 'winingPoint', label: 'Winning Point', width: 110, align: 'right', render: (r) => fmt2(r.winingPoint) },
      { key: 'roundCapacity', label: 'Round Capacity', width: 110, align: 'right', render: (r) => String(r.roundCapacity ?? '-') },
      { key: 'isBot', label: 'Is Bot', width: 90, render: (r) => isBotValue(r) },
      { key: 'player', label: 'Player Identity', width: 160, render: (r) => playerIdentity(r) },
      { key: 'created', label: 'Created At', width: 150, render: (r) => fmtDate(r) },
    ],
    [rowOffset],
  );

  const activeFilterCount = useMemo(
    () => Object.keys(buildFilterPayload(filters)).filter((k) => k !== 'transactionId').length,
    [filters],
  );

  const clearFilters = useCallback(() => {
    setDraftFilters(INITIAL_FILTERS);
    setFilters(INITIAL_FILTERS);
    setPageNo(1);
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>House Games</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row to see all details
      </Text>

      <View style={styles.dateBarWrap}>
        <DetailFilterBar
          startDate={draftStart}
          endDate={draftEnd}
          loading={loading}
          onStartDateChange={setDraftStart}
          onEndDateChange={setDraftEnd}
          onApply={applyAll}
        />
      </View>

      {/* Items per page (desktop: 50/100/200/500) */}
      <View style={[styles.chipGroupRow, styles.rowsSelector]}>
        <Text style={styles.chipGroupLabel}>Rows</Text>
        {ITEMS_PER_PAGE_OPTIONS.map((opt) => {
          const active = itemsPerPage === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setItemsPerPage(opt);
                setPageNo(1);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Collapsible search filters (same payload as desktop) */}
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowFilters((v) => !v)}
        accessibilityRole="button"
      >
        <Text style={styles.filterToggleText}>
          {showFilters ? 'Hide Search ▲' : `Search Filters ▼${activeFilterCount ? ` (${activeFilterCount} active)` : ''}`}
        </Text>
      </TouchableOpacity>

      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterGrid}>
            {TEXT_FILTER_FIELDS.map((f) => (
              <TextInput
                key={f.key}
                style={styles.filterInput}
                placeholder={f.placeholder}
                placeholderTextColor={colors.muted}
                value={String(draftFilters[f.key] ?? '')}
                keyboardType={f.numeric ? 'numeric' : 'default'}
                autoCapitalize="none"
                onChangeText={(t) => setDraft(f.key, t as never)}
                returnKeyType="search"
                onSubmitEditing={applyAll}
              />
            ))}
          </View>

          <View style={styles.chipGroupRow}>
            <Text style={styles.chipGroupLabel}>Type</Text>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt || 'all'}
                style={[styles.chip, draftFilters.type === opt && styles.chipActive]}
                onPress={() => setDraft('type', opt)}
              >
                <Text style={[styles.chipText, draftFilters.type === opt && styles.chipTextActive]}>
                  {opt || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.chipGroupRow}>
            <Text style={styles.chipGroupLabel}>Status</Text>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt || 'all'}
                style={[styles.chip, draftFilters.status === opt && styles.chipActive]}
                onPress={() => setDraft('status', opt)}
              >
                <Text style={[styles.chipText, draftFilters.status === opt && styles.chipTextActive]}>
                  {opt || 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chipGroupRow}>
            {(['isBot', 'human'] as const).map((key) => {
              const on = draftFilters[key] === true;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, on && styles.chipActive]}
                  onPress={() => setDraft(key, on ? null : true)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>
                    {key === 'isBot' ? 'Is Bot' : 'Human'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} accessibilityRole="button">
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={applyAll} accessibilityRole="button">
              <Text style={styles.applyBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Totals line (matches desktop "Total Count / Total Amount") */}
      {(totalCount !== null || totalAmount !== null) && (
        <View style={styles.totalsLine}>
          {totalCount !== null && (
            <Text style={styles.totalsText}>Total Count: {totalCount.toLocaleString('en-IN')}</Text>
          )}
          {totalAmount !== null && (
            <Text style={styles.totalsText}>
              Total Amount: {Math.round(Number(totalAmount) || 0).toLocaleString('en-IN')}
            </Text>
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || r.txnId || i)}
        emptyMessage={loading ? 'Loading…' : 'No Data Found'}
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      {/* Pagination */}
      <View style={styles.pagerRow}>
        <TouchableOpacity
          style={[styles.pagerBtn, (pageNo <= 1 || loading) && styles.pagerBtnDisabled]}
          disabled={pageNo <= 1 || loading}
          onPress={() => setPageNo((p) => Math.max(1, p - 1))}
          accessibilityRole="button"
        >
          <Text style={styles.pagerBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pagerLabel}>
          Page {pageNo} of {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pagerBtn, (pageNo >= totalPages || loading) && styles.pagerBtnDisabled]}
          disabled={pageNo >= totalPages || loading}
          onPress={() => setPageNo((p) => Math.min(totalPages, p + 1))}
          accessibilityRole="button"
        >
          <Text style={styles.pagerBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.name || selected.txnId || 'Details') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
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
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  filterToggle: { marginBottom: spacing(3) },
  filterToggleText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  filterPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
    gap: spacing(2),
  },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  filterInput: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 130,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    color: colors.foreground,
    fontSize: 13,
    backgroundColor: colors.background,
  },
  dateBarWrap: { marginTop: spacing(3) },
  rowsSelector: { marginTop: spacing(3), marginBottom: spacing(3) },
  chipGroupRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing(2) },
  chipGroupLabel: { color: colors.muted, fontSize: 12, width: 44 },
  chip: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  filterActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(2) },
  clearBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearBtnText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  applyBtn: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  totalsLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(4),
    marginBottom: spacing(3),
  },
  totalsText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
  },
  pagerBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
