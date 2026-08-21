/**
 * House Games — transactions list (Ludo admin).
 * Port of desktop HouseGamesPage with the mobile screen structure:
 * date filter, collapsible column filters (same filter payload as
 * desktop), paginated DataTable with main columns, bottom sheet with
 * every column, pull-to-refresh.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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
import { hasPermission, Permissions, canAccessNavItem } from '../../../auth/permissions';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { monthStartIST, todayIST } from '../../../utils/dates';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar, type SearchFieldOption } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { pickPageSizes } from '@astro/shared';

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
  winningAmount?: number | string;
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

const ITEMS_PER_PAGE_OPTIONS = pickPageSizes([50, 100, 200, 500]);

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

/** Search-bar field options (sent as desktop filter keys). */
const SEARCH_BAR_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'userId', label: 'User ID' },
  { key: 'txnId', label: 'Txn ID' },
  { key: 'refTxnId', label: 'Ref Txn ID' },
  { key: 'roundId', label: 'Round ID' },
  { key: 'sessionId', label: 'Session ID' },
  { key: 'gameId', label: 'Game ID' },
  { key: 'operatorId', label: 'Operator ID' },
  { key: 'currency', label: 'Currency' },
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

export function HouseGamesScreen() {
  const isFocused = useIsFocused();
  const canOpenHouseGames = canAccessNavItem({
    id: 'houseGames',
    permission: Permissions.house_game,
  });
  const canUpdateBets =
    hasPermission(Permissions.update_ludo_bets) || canOpenHouseGames;
  const canUpdateWinningPoint =
    hasPermission(Permissions.show_wining_btn) || canOpenHouseGames;

  const [draftStart, setDraftStart] = useState(monthStartIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(monthStartIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [draftFilters, setDraftFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [searchField, setSearchField] = useState('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pageNo, setPageNo] = useState(1);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TxnRow | null>(null);
  const [editItem, setEditItem] = useState<TxnRow | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editWinningAmount, setEditWinningAmount] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [winItem, setWinItem] = useState<TxnRow | null>(null);
  const [winStatus, setWinStatus] = useState('W');
  const [winPoint, setWinPoint] = useState('');
  const [winAmount, setWinAmount] = useState('');
  const [winLoading, setWinLoading] = useState(false);
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

  /** Search bar submit: put the text into the chosen field (clearing other search-bar fields). */
  const submitSearch = useCallback(() => {
    const next = { ...draftFilters };
    for (const f of SEARCH_BAR_FIELDS) (next as Record<string, unknown>)[f.key] = '';
    (next as Record<string, unknown>)[searchField] = searchDraft.trim();
    setDraftFilters(next);
    setFilters(next);
    setPageNo(1);
    setStartDate(draftStart);
    setEndDate(draftEnd);
  }, [draftFilters, searchField, searchDraft, draftStart, draftEnd]);

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

  const openUpdateModal = useCallback((item: TxnRow) => {
    setEditItem(item);
    setEditStatus(String(item.status ?? ''));
    setEditWinningAmount(String(item.winningAmount ?? item.amount ?? ''));
    setSelected(null);
  }, []);

  const closeUpdateModal = useCallback(() => {
    if (editLoading) return;
    setEditItem(null);
    setEditStatus('');
    setEditWinningAmount('');
  }, [editLoading]);

  const openWinningPointModal = useCallback((item: TxnRow) => {
    setWinItem(item);
    setWinStatus(String(item.status ?? 'W'));
    setWinPoint(String(item.winingPoint ?? ''));
    setWinAmount(String(item.amount ?? ''));
    setSelected(null);
  }, []);

  const closeWinningPointModal = useCallback(() => {
    if (winLoading) return;
    setWinItem(null);
    setWinStatus('W');
    setWinPoint('');
    setWinAmount('');
  }, [winLoading]);

  const submitUpdateStatus = useCallback(async () => {
    if (!editItem?._id) {
      Alert.alert('Error', 'Invalid transaction selected');
      return;
    }
    if (!editStatus) {
      Alert.alert('Error', 'Please select status');
      return;
    }
    if (editStatus === 'W' && !editWinningAmount) {
      Alert.alert('Error', 'Please enter winning amount');
      return;
    }

    const payload: Record<string, unknown> = {
      _id: editItem._id,
      status: editStatus,
    };
    if (editStatus === 'W') {
      payload.winningAmount = Number(editWinningAmount);
    }

    setEditLoading(true);
    try {
      const res = await secureApi('houseGames.updateBetStatus', payload);
      if (res.ok && res.success !== false) {
        Alert.alert('Success', res.message || 'Bet status updated successfully');
        setEditItem(null);
        setEditStatus('');
        setEditWinningAmount('');
        void load();
      } else {
        Alert.alert('Error', res.message || 'Failed to update bet status');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update bet status');
    } finally {
      setEditLoading(false);
    }
  }, [editItem, editStatus, editWinningAmount, load]);

  const submitWinningPoint = useCallback(async () => {
    if (!winItem?._id) {
      Alert.alert('Error', 'Invalid transaction selected');
      return;
    }

    const isWinType = String(winItem.type ?? '').toLowerCase() === 'win';
    let payload: Record<string, unknown>;

    if (isWinType) {
      if (winAmount === '' || Number.isNaN(Number(winAmount))) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }
      payload = { _id: winItem._id, amount: Number(winAmount) };
    } else {
      if (!winStatus) {
        Alert.alert('Error', 'Please select status');
        return;
      }
      if (winPoint === '' || Number.isNaN(Number(winPoint))) {
        Alert.alert('Error', 'Please enter a valid winning point');
        return;
      }
      payload = {
        _id: winItem._id,
        winingPoint: Number(winPoint),
        status: winStatus,
      };
    }

    setWinLoading(true);
    try {
      const res = await secureApi('houseGames.updateWiningPoint', payload);
      if (res.ok && res.success !== false) {
        Alert.alert('Success', res.message || 'Winning point updated successfully');
        setWinItem(null);
        setWinStatus('W');
        setWinPoint('');
        setWinAmount('');
        void load();
      } else {
        Alert.alert('Error', res.message || 'Failed to update winning point');
      }
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Failed to update winning point',
      );
    } finally {
      setWinLoading(false);
    }
  }, [winItem, winStatus, winPoint, winAmount, load]);

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{toDisplayText('House Games')}</Text>
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
          searchFields={SEARCH_BAR_FIELDS}
          searchField={searchField}
          onSearchFieldChange={setSearchField}
          searchText={searchDraft}
          onSearchTextChange={setSearchDraft}
          onSearchSubmit={submitSearch}
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

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No Data Found</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => {
          const st = String(row.status || '—');
          const ok = /success|complete|win|approved/i.test(st);
          const bad = /fail|reject|cancel|loss/i.test(st);
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id || row.txnId || '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSelected(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1 + rowOffset}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {String(row.name || '-')}
                </Text>
                {canUpdateBets ? (
                  <TouchableOpacity
                    style={styles.editIconBtn}
                    onPress={() => openUpdateModal(row)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Update Bet Status"
                  >
                    <Text style={styles.editIconText}>✎</Text>
                  </TouchableOpacity>
                ) : null}
                {canUpdateWinningPoint ? (
                  <TouchableOpacity
                    style={styles.trophyIconBtn}
                    onPress={() => openWinningPointModal(row)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Update Winning Point"
                  >
                    <Text style={styles.trophyIconText}>🏆</Text>
                  </TouchableOpacity>
                ) : null}
                <Text
                  style={[
                    styles.statusPill,
                    ok ? styles.statusOn : bad ? styles.statusOff : { color: colors.muted, backgroundColor: 'rgba(148,163,184,0.18)' },
                  ]}
                  numberOfLines={1}
                >
                  {st}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Amount: {fmt2(row.amount)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  {String(row.type || '-')}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Game: {String(row.gameId || '-')}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  {fmtDate(row)}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
        actions={
          selected && (canUpdateBets || canUpdateWinningPoint)
            ? [
                ...(canUpdateBets
                  ? [
                      {
                        label: 'Update Bet Status',
                        tone: 'warning' as const,
                        onPress: () => openUpdateModal(selected),
                      },
                    ]
                  : []),
                ...(canUpdateWinningPoint
                  ? [
                      {
                        label: 'Update Winning Point',
                        tone: 'primary' as const,
                        onPress: () => openWinningPointModal(selected),
                      },
                    ]
                  : []),
              ]
            : undefined
        }
        onClose={() => setSelected(null)}
      />
    </ScrollView>

    <Modal
      visible={editItem !== null}
      transparent
      animationType="fade"
      onRequestClose={closeUpdateModal}
    >
      <View style={styles.editBackdrop}>
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>{toDisplayText('Update Bet Status')}</Text>
          <Text style={styles.editLabel}>Document ID</Text>
          <Text style={styles.editValue} numberOfLines={2}>
            {String(editItem?._id ?? '')}
          </Text>

          <Text style={styles.editLabel}>Status</Text>
          <View style={styles.chipGroupRow}>
            {(
              [
                { value: 'L', label: `${toDisplayText('Loss')} (L)` },
                { value: 'R', label: `${toDisplayText('Refund')} (R)` },
                { value: 'W', label: `${toDisplayText('Win')} (W)` },
              ] as const
            ).map((opt) => {
              const active = editStatus === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setEditStatus(opt.value)}
                  disabled={editLoading}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {editStatus === 'W' ? (
            <>
              <Text style={styles.editLabel}>{toDisplayText('Winning Amount')}</Text>
              <TextInput
                style={styles.filterInput}
                value={editWinningAmount}
                onChangeText={setEditWinningAmount}
                keyboardType="numeric"
                placeholder="Enter winning amount"
                placeholderTextColor={colors.muted}
                editable={!editLoading}
              />
            </>
          ) : null}

          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={closeUpdateModal}
              disabled={editLoading}
            >
              <Text style={styles.clearBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, editLoading && styles.pagerBtnDisabled]}
              onPress={() => void submitUpdateStatus()}
              disabled={editLoading}
            >
              <Text style={styles.applyBtnText}>
                {editLoading ? 'Updating...' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    <Modal
      visible={winItem !== null}
      transparent
      animationType="fade"
      onRequestClose={closeWinningPointModal}
    >
      <View style={styles.editBackdrop}>
        <View style={styles.editCard}>
          <Text style={styles.editTitle}>{toDisplayText('Update Winning Point')}</Text>
          <Text style={styles.editLabel}>Document ID</Text>
          <Text style={styles.editValue} numberOfLines={2}>
            {String(winItem?._id ?? '')}
          </Text>
          <Text style={styles.editLabel}>Type</Text>
          <Text style={styles.editValue}>{String(winItem?.type ?? '')}</Text>

          {String(winItem?.type ?? '').toLowerCase() === 'win' ? (
            <>
              <Text style={styles.editLabel}>{toDisplayText('Amount')}</Text>
              <TextInput
                style={styles.filterInput}
                value={winAmount}
                onChangeText={setWinAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor={colors.muted}
                editable={!winLoading}
              />
            </>
          ) : (
            <>
              <Text style={styles.editLabel}>Status</Text>
              <View style={styles.chipGroupRow}>
                {(
                  [
                    { value: 'L', label: `${toDisplayText('Loss')} (L)` },
                    { value: 'R', label: `${toDisplayText('Refund')} (R)` },
                    { value: 'W', label: `${toDisplayText('Win')} (W)` },
                  ] as const
                ).map((opt) => {
                  const active = winStatus === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setWinStatus(opt.value)}
                      disabled={winLoading}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.editLabel}>{toDisplayText('Winning Point')}</Text>
              <TextInput
                style={styles.filterInput}
                value={winPoint}
                onChangeText={setWinPoint}
                keyboardType="numeric"
                placeholder="Enter winning point"
                placeholderTextColor={colors.muted}
                editable={!winLoading}
              />
            </>
          )}

          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={closeWinningPointModal}
              disabled={winLoading}
            >
              <Text style={styles.clearBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, winLoading && styles.pagerBtnDisabled]}
              onPress={() => void submitWinningPoint()}
              disabled={winLoading}
            >
              <Text style={styles.applyBtnText}>
                {winLoading ? 'Updating...' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
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
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: '40%',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
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
  editIconBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,159,10,0.16)',
    marginRight: spacing(1),
  },
  editIconText: { color: '#ff9f0a', fontSize: 14, fontWeight: '700' },
  trophyIconBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,166,35,0.18)',
    marginRight: spacing(1),
  },
  trophyIconText: { fontSize: 13 },
  editCityBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    backgroundColor: colors.surfaceAlt,
  },
  editCityText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
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
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  editCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(4),
    borderWidth: 1,
    borderColor: colors.border,
  },
  editTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  editLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing(1),
    marginTop: spacing(2),
  },
  editValue: {
    color: colors.foreground,
    fontSize: 13,
    marginBottom: spacing(1),
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(4),
  },
});
