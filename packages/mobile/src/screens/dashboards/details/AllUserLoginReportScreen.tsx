/**
 * All User Login Report — port of desktop AllUserLoginReportPage.
 * Calls reports.allUserLoginLogout with { page, limit, filter:{ startDate, endDate, ... } }.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
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

type ActionItem = { action?: string; timestamp?: string; [key: string]: unknown };
type Row = {
  _id: string;
  name?: string;
  realName?: string;
  mobile?: string;
  actionHistory?: ActionItem[];
  [key: string]: unknown;
};

const PAGE_SIZE = 25;

const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Panel Name' },
  { key: 'realName', label: 'Real Name' },
  { key: 'subAdminId', label: 'User ID' },
  { key: 'mobile', label: 'Mobile' },
];

function getActionStats(history: ActionItem[] | undefined, actionType: string) {
  const filtered = (history || []).filter((item) => item.action === actionType);
  return { count: filtered.length, last: filtered[filtered.length - 1] };
}

function formatTs(ts?: string): string {
  if (!ts) return '—';
  return `${formatDisplayDate(ts)}-${formatDisplayTime(ts)}`;
}

export function AllUserLoginReportScreen() {
  const canShowMobile = hasPermission('show_mobile');

  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = { startDate, endDate };
      const text = appliedSearch.text.trim();
      if (text) filter[appliedSearch.field] = text;
      const res = await secureApi<unknown>('reports.allUserLoginLogout', {
        page,
        limit: PAGE_SIZE,
        filter,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load login report');
        setRows([]);
        setTotal(0);
        return;
      }
      const data = (res.data || {}) as { data?: unknown; total?: unknown };
      setSelected(null);
      setRows(Array.isArray(data.data) ? (data.data as Row[]) : []);
      setTotal(Number(data.total) || 0);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [appliedSearch, endDate, page, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * PAGE_SIZE + i + 1) },
      { key: 'name', label: 'Panel Name', width: 130, render: (r) => String(r.name || '—') },
      { key: 'realName', label: 'Real Name', width: 130, render: (r) => String(r.realName || '—') },
      { key: 'userId', label: 'User ID', width: 150, render: (r) => String(r._id || '—') },
      {
        key: 'mobile',
        label: 'Mobile No',
        width: 100,
        render: (r) => (canShowMobile ? String(r.mobile || '—') : '*********'),
      },
      {
        key: 'logoutCount',
        label: 'Logout Count',
        width: 90,
        align: 'right',
        render: (r) => String(getActionStats(r.actionHistory, 'logout').count),
      },
      {
        key: 'loginCount',
        label: 'Login Count',
        width: 110,
        align: 'left',
        render: (r) => String(getActionStats(r.actionHistory, 'login').count),
      },
      {
        key: 'lastLogin',
        label: 'Last Login Time',
        width: 175,
        render: (r) => formatTs(getActionStats(r.actionHistory, 'login').last?.timestamp),
      },
      {
        key: 'lastLogout',
        label: 'Last Logout Time',
        width: 160,
        render: (r) => formatTs(getActionStats(r.actionHistory, 'logout').last?.timestamp),
      },
    ],
    [page, canShowMobile],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>All User Login Report</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total Count:- {total.toLocaleString('en-IN')}
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

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No login records found</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => {
          const login = getActionStats(row.actionHistory, 'login');
          const logout = getActionStats(row.actionHistory, 'logout');
          return (
            <TouchableOpacity key={`row-${index}-${String(row._id ?? '')}`} style={styles.card} activeOpacity={0.75} onPress={() => setSelected(row)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * PAGE_SIZE + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>{String(row.name || '—')}</Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Logins: {login.count}</Text>
                <Text style={styles.cardSplitRight}>Logouts: {logout.count}</Text>
              </View>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>Last login: {formatTs(login.last?.timestamp)}</Text>
              <Text style={styles.cardHint}>Tap card for details</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.name || '') : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(selected, 0) }))
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
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 8,
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
