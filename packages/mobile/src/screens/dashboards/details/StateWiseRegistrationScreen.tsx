/**
 * State wise Registration — port of desktop StateWiseRegistrationPage.
 * Calls users.registeredUsersReport with { pageNo, itemPerPage, startDate, endDate, filter }.
 * Shows a clickable "Players State Wise" summary; tapping a state filters the table.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import {
  DetailFilterBar,
  type SearchFieldKey,
  type SearchFieldOption,
} from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  email?: string;
  kyc?: boolean;
  clientName?: string;
  city?: string;
  state?: string;
  empCode?: string;
  deviceType?: string;
  played?: unknown;
  createdOn?: string;
  activeUser?: string;
  balance?: number | string;
  bonusWalletBalance?: number | string;
  blockUser?: boolean;
  dump?: boolean;
  [key: string]: unknown;
};


const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: '_id', label: 'User ID' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'empCode', label: 'Emp Code' },
  { key: 'deviceType', label: 'Device Type' },
  { key: 'played', label: 'Played (E/C/S)' },
];

/** Extract the state summary from the report payload (desktop key order). */
function extractStateSummary(data: unknown, rows: Row[]): Array<{ state: string; count: number }> {
  const keys = [
    'stateWise',
    'stateWisePlayers',
    'playersStateWise',
    'stateCounts',
    'stateWiseCount',
    'playersByState',
    'groupByState',
  ];
  const obj = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  let candidate: unknown;
  for (const k of keys) {
    if (obj[k] != null) {
      candidate = obj[k];
      break;
    }
  }
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const inner = candidate as Record<string, unknown>;
    if (Array.isArray(inner.result)) candidate = inner.result;
    else if (Array.isArray(inner.data)) candidate = inner.data;
  }
  const out: Array<{ state: string; count: number }> = [];
  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const state = String(o.state ?? o._id ?? o.name ?? '').trim() || 'Unknown';
      const count = Number(o.count ?? o.total ?? o.players ?? 0) || 0;
      out.push({ state, count });
    }
  } else if (candidate && typeof candidate === 'object') {
    for (const [state, v] of Object.entries(candidate as Record<string, unknown>)) {
      const count =
        typeof v === 'number' ? v : Number((v as Record<string, unknown>)?.count ?? 0) || 0;
      out.push({ state: state || 'Unknown', count });
    }
  }
  if (!out.length) {
    // Fall back to aggregating the visible rows.
    const map = new Map<string, number>();
    for (const r of rows) {
      const s = String(r.state || '').trim() || 'Unknown';
      map.set(s, (map.get(s) || 0) + 1);
    }
    for (const [state, count] of map) out.push({ state, count });
  }
  return out.sort((a, b) => b.count - a.count);
}

export function StateWiseRegistrationScreen() {
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');

  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [appClientName, setAppClientName] = useState('');
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [stateFilter, setStateFilter] = useState('');
  const [activeUser, setActiveUser] = useState(false);
  const [activeToday, setActiveToday] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<Array<{ state: string; count: number }>>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      if (stateFilter) filter.state = stateFilter;
      const text = appliedSearch.text.trim();
      if (text) filter[appliedSearch.field] = text;

      const payload: Record<string, unknown> = {
        pageNo: page,
        itemPerPage: pageSize,
        startDate,
        endDate,
        filter,
      };
      if (activeUser) {
        payload.hasActiveUser = true;
        payload.activeUserStartDate = startDate;
        payload.activeUserEndDate = endDate;
      }
      if (activeToday) payload.activeUserToday = true;

      const res = await secureApi<unknown>('users.registeredUsersReport', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load report');
        setRows([]);
        return;
      }
      const paged = asPaged<Row>(res.data);
      setSelected(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages || 1));
      // Desktop: summary is not refreshed while a state filter is active.
      if (!stateFilter) setSummary(extractStateSummary(res.data, paged.rows));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [appClientName, appliedSearch, stateFilter, activeUser, activeToday, endDate, page, pageSize, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 120, render: (r) => String(r.name || '—') },
      { key: 'userId', label: 'User ID', width: 150, render: (r) => String(r._id || '—') },
    ];
    if (!hideContact) {
      cols.push({
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => (r.mobile ? (canShowMobile ? String(r.mobile) : '**********') : '—'),
      });
    }
    cols.push(
      { key: 'kyc', label: 'KYC', width: 70, render: (r) => (r.kyc === true ? 'Done' : 'Not Done') },
      {
        key: 'appName',
        label: 'App Name',
        width: 80,
        render: (r) => appCodeForName(String(r.clientName || '')),
      },
    );
    if (!hideContact) {
      cols.push({ key: 'email', label: 'Email', width: 160, render: (r) => String(r.email || '—') });
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => String(r.city || '—') },
      { key: 'state', label: 'State', width: 110, render: (r) => String(r.state || '—') },
      { key: 'empCode', label: 'Employee Code', width: 100, render: (r) => String(r.empCode || '—') },
      { key: 'deviceType', label: 'Device Type', width: 90, render: (r) => String(r.deviceType || '—') },
      {
        key: 'played',
        label: 'Played',
        width: 90,
        render: (r) => (Array.isArray(r.played) ? r.played.join(', ') || '—' : String(r.played ?? '—')),
      },
      { key: 'created', label: 'Created', width: 100, render: (r) => formatDisplayDate(r.createdOn) || '—' },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 150,
        render: (r) =>
          r.activeUser
            ? `${formatDisplayDate(r.activeUser)} | ${formatDisplayTime(r.activeUser)}`
            : '—',
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'bonusBalance',
        label: 'Bonus Balance',
        width: 100,
        align: 'right',
        render: (r) => floorNum(r.bonusWalletBalance ?? 0).toLocaleString('en-IN'),
      },
      { key: 'block', label: 'Block', width: 70, render: (r) => (r.blockUser ? 'Yes' : 'No') },
      { key: 'dump', label: 'Dump', width: 70, render: (r) => (r.dump ? 'Yes' : 'No') },
    );
    return cols;
  }, [page, pageSize, hideContact, canShowMobile]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>State wise Registration</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total Users: {total.toLocaleString('en-IN')}
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
          setPage(1);
        }}
        appClientName={appClientName}
        onAppChange={(v) => {
          setAppClientName(v);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setAppliedSearch({ field: searchField, text: searchDraft });
          setPage(1);
        }}
      />

      {/* Active toggles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.chip, activeUser && styles.chipActive]}
          onPress={() => {
            setActiveUser((v) => !v);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, activeUser && styles.chipTextActive]}>Active User</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, activeToday && styles.chipActive]}
          onPress={() => {
            setActiveToday((v) => !v);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, activeToday && styles.chipTextActive]}>Active Today</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Players State Wise summary */}
      {summary.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Players State Wise</Text>
          <View style={styles.summaryWrap}>
            {stateFilter ? (
              <TouchableOpacity
                style={[styles.chip, styles.chipActive]}
                onPress={() => {
                  setStateFilter('');
                  setPage(1);
                }}
              >
                <Text style={[styles.chipText, styles.chipTextActive]}>Clear: {stateFilter} ✕</Text>
              </TouchableOpacity>
            ) : null}
            {summary.map((s) => (
              <TouchableOpacity
                key={s.state}
                style={[styles.chip, stateFilter === s.state && styles.chipActive]}
                onPress={() => {
                  setStateFilter(stateFilter === s.state ? '' : s.state);
                  setPage(1);
                }}
              >
                <Text style={[styles.chipText, stateFilter === s.state && styles.chipTextActive]}>
                  {s.state}: {s.count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No registered users for selected filters</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity key={`row-${index}-${String(row._id ?? '')}`} style={styles.card} activeOpacity={0.75} onPress={() => setSelected(row)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>{String(row.name || '—')}</Text>
              <Text style={[styles.statusPill, row.blockUser ? styles.statusOff : styles.statusOn]}>{row.blockUser ? 'Blocked' : 'Active'}</Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>State: {String(row.state || '—')}</Text>
              <Text style={styles.cardSplitRight}>App: {appCodeForName(String(row.clientName || ''))}</Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft}>Balance: {floorNum(row.balance ?? 0).toLocaleString('en-IN')}</Text>
              <Text style={styles.cardSplitRight}>KYC: {row.kyc === true ? 'Done' : 'Not Done'}</Text>
            </View>
            <Text style={styles.cardHint}>Tap card for details</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.name || '') : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(selected, 0),
                }))
            : []
        }
        onClose={() => setSelected(null)}
      />

      <View style={styles.pager}>
        <Text
          style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
          onPress={() => page > 1 && setPage((p) => p - 1)}
        >
          ‹ Prev
        </Text>
        <Text style={styles.pagerLabel}>
          Page {page} / {totalPages}
        </Text>
        <Text
          style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
          onPress={() => page < totalPages && setPage((p) => p + 1)}
        >
          Next ›
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  quickRow: { marginTop: spacing(3), flexGrow: 0 },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
    marginBottom: spacing(2),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  summaryTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', marginBottom: spacing(2) },
  summaryWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginBottom: spacing(1) },
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
  cardTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', flex: 1, minWidth: 0 },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  cardSplitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing(2), paddingVertical: 1 },
  cardSplitLeft: { color: colors.foreground, fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'left' },
  cardSplitRight: { color: colors.foreground, fontSize: 11, fontWeight: '700', flexShrink: 0, maxWidth: '48%', textAlign: 'right' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
