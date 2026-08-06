/**
 * Bot Performance — port of desktop BotPerformancePage.
 * Lists caller-user activity (botPerformance.callerUserActivity) with the
 * desktop filter set: date range, type, bot IDs, app, and per-column filters.
 * Desktop-only "Add to Dialer" (external dialer batch) is not ported.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { formatDisplayDate, todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type BotPerfRow = {
  _id: string;
  name?: string;
  mobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
  client_name?: string;
  empCode?: string;
  bot_id?: string | number;
  balance?: number | string;
  createdOn?: string;
  activeUser?: string;
  phone_number?: string;
};

const TYPE_OPTIONS = [
  'non_performing',
  'active',
  'today_active',
  'inactive',
  'active_by_bot',
] as const;

const PAGE_SIZES = [10, 25, 50, 100, 200, 500] as const;

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['sr', 'name', 'botId', 'balance']);

function formatBalance(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === undefined || value === null || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function display(value: unknown): string {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

export function BotPerformanceScreen() {
  const isFocused = useIsFocused();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const today = todayIST();

  // Draft filter inputs (applied on Apply/Search)
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<string>('non_performing');
  const [appName, setAppName] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [city, setCity] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [botIdsText, setBotIdsText] = useState('');
  const [minBal, setMinBal] = useState('');
  const [maxBal, setMaxBal] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [applyTick, setApplyTick] = useState(0);

  const [rows, setRows] = useState<BotPerfRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: BotPerfRow; index: number } | null>(null);

  const genRef = React.useRef(0);
  // Text filters are read at load time (like desktop: applied on Apply).
  const draftRef = React.useRef({ name, mobile, city, stateFilter, empCode, botIdsText, minBal, maxBal, appName, type });
  draftRef.current = { name, mobile, city, stateFilter, empCode, botIdsText, minBal, maxBal, appName, type };

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const f = draftRef.current;
      const filter: Record<string, unknown> = {};
      if (f.name.trim()) filter.name = f.name.trim();
      if (f.appName) filter.clientName = f.appName;
      if (f.stateFilter.trim()) filter.state = f.stateFilter.trim();
      if (f.mobile.trim()) filter.mobile = f.mobile.trim();
      if (f.city.trim()) filter.city = f.city.trim();
      if (f.empCode.trim()) filter.empCode = f.empCode.trim();
      if (f.minBal) filter.min = Number(f.minBal);
      if (f.maxBal) filter.max = Number(f.maxBal);

      const botId = f.botIdsText
        .split(/[,\s]+/)
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);

      const res = await secureApi('botPerformance.callerUserActivity', {
        type: f.type,
        startDate,
        endDate,
        pageNo: page,
        itemPerPage: pageSize,
        botId,
        status: 'completed',
        filter,
      });
      if (gen !== genRef.current) return; // stale response

      if (!res.ok) {
        setError(res.message || 'Failed to load bot performance');
        setRows([]);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      const paged = asPaged<BotPerfRow>(res.data);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages));
      setTotal(paged.total || paged.rows.length);
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, page, pageSize, applyTick]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const applyFilters = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    if (page !== 1) setPage(1);
    else setApplyTick((t) => t + 1);
  }, [draftStart, draftEnd, page]);

  const clearFilters = useCallback(() => {
    setName('');
    setMobile('');
    setCity('');
    setStateFilter('');
    setEmpCode('');
    setBotIdsText('');
    setMinBal('');
    setMaxBal('');
    setAppName('');
    if (page !== 1) setPage(1);
    else setApplyTick((t) => t + 1);
  }, [page]);

  const rowOffset = (page - 1) * pageSize;

  const columns = useMemo<DataTableColumn<BotPerfRow>[]>(
    () => [
      { key: 'sr', label: '#', width: 46, render: (_r, i) => String(rowOffset + i + 1) },
      { key: 'name', label: 'Name', width: 120, render: (r) => display(r.name || r.client_name) },
      { key: 'dpId', label: 'DP ID', width: 180, render: (r) => display(r._id) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => maskMobile(r.mobile || r.phone_number, canShowMobile),
      },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      { key: 'app', label: 'App Code', width: 70, render: (r) => appCodeForName(r.clientName) },
      { key: 'empCode', label: 'Emp Code', width: 90, render: (r) => display(r.empCode) },
      { key: 'botId', label: 'Bot ID', width: 60, render: (r) => display(r.bot_id) },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (r) => formatBalance(r.balance),
      },
      { key: 'createdAt', label: 'Created At', width: 110, render: (r) => formatDisplayDate(r.createdOn) || '—' },
      { key: 'lastActivity', label: 'Last Activity', width: 110, render: (r) => formatDisplayDate(r.activeUser) || '—' },
    ],
    [rowOffset, canShowMobile],
  );

  const textFilters: Array<{ label: string; value: string; set: (v: string) => void; keyboard?: 'phone-pad' | 'number-pad' | 'numeric' }> = [
    { label: 'Name', value: name, set: setName },
    { label: 'Mobile', value: mobile, set: setMobile, keyboard: 'phone-pad' },
    { label: 'City', value: city, set: setCity },
    { label: 'State', value: stateFilter, set: setStateFilter },
    { label: 'Emp Code', value: empCode, set: setEmpCode },
    { label: 'Bot IDs (e.g. 31, 69)', value: botIdsText, set: setBotIdsText },
    { label: 'Min Balance', value: minBal, set: setMinBal, keyboard: 'numeric' },
    { label: 'Max Balance', value: maxBal, set: setMaxBal, keyboard: 'numeric' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Bot Performance</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row for all details
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={applyFilters}
        appClientName={appName}
        onAppChange={(v) => setAppName(v)}
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
      />

      {/* Type chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {TYPE_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, type === t && styles.chipActive]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.chipText, type === t && styles.chipTextActive]}>
              {t.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Collapsible search filters */}
      <TouchableOpacity style={styles.collapseHeader} onPress={() => setFiltersOpen((o) => !o)}>
        <Text style={styles.collapseTitle}>Search Filters {filtersOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {filtersOpen && (
        <View style={styles.filterCard}>
          {textFilters.map((f) => (
            <View key={f.label} style={styles.filterRow}>
              <Text style={styles.filterLabel}>{f.label}</Text>
              <TextInput
                style={styles.filterInput}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.label}
                placeholderTextColor={colors.muted}
                keyboardType={f.keyboard}
              />
            </View>
          ))}
          <View style={styles.filterBtnRow}>
            <TouchableOpacity style={styles.searchBtn} onPress={applyFilters} disabled={loading}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} disabled={loading}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading data…</Text>
        </View>
      ) : (
        <>
          <DataTable
            columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
            rows={rows}
            keyFor={(r, i) => String(r._id || i)}
            emptyMessage="No records found"
            onRowPress={(row) => setSelected({ row, index: rows.indexOf(row) })}
            hint="Tap a row to see all details"
          />

          {/* Pagination */}
          <View style={styles.pagerRow}>
            <TouchableOpacity
              style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text style={styles.pagerBtnText}>‹ Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pagerInfo}>
              {total > 0
                ? `${total.toLocaleString()} users · page ${page} of ${totalPages}`
                : `page ${page} of ${totalPages}`}
            </Text>
            <TouchableOpacity
              style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <Text style={styles.pagerBtnText}>Next ›</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.row.name || selected.row.client_name) : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'sr' && c.key !== 'name')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(selected.row, selected.index),
                }))
            : []
        }
        note="Add to Dialer is available on the desktop app only."
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  chipScroll: { marginTop: spacing(3), flexGrow: 0 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginRight: spacing(2),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  collapseHeader: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  collapseTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  filterCard: {
    marginTop: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  filterLabel: { color: colors.muted, fontSize: 12, width: 120 },
  filterInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.foreground,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    fontSize: 13,
  },
  filterBtnRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  searchBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  clearBtn: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  clearBtnText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  loadingBox: { alignItems: 'center', paddingVertical: spacing(10), gap: spacing(3) },
  loadingText: { color: colors.muted, fontSize: 13 },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
    gap: spacing(2),
  },
  pagerBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(2),
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  pagerInfo: { color: colors.muted, fontSize: 12, flexShrink: 1, textAlign: 'center' },
});
