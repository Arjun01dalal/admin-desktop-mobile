/**
 * Customer Allotment — port of desktop CustomerAllotmentPage (list view).
 * ops.customerSupportGetAll { itemPerPage, pageNo, filter? } plus deposit stats overlay
 * from ops.customerSupportDeposit { itemPerPage, pageNo }. Row tap opens a detail modal.
 * Block/Unblock and Caller Report dialogs stay desktop-only.
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
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Stat = { count?: number | string; totalAmount?: number | string; [key: string]: unknown };
type DepositEntry = {
  _id?: string;
  callerId?: string;
  depositData?: Stat[];
  coinData?: Stat[];
  [key: string]: unknown;
};

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  city?: string;
  email?: string;
  empCode?: string;
  allotedCustomer?: unknown[];
  block?: boolean;
  blockReason?: string;
  [key: string]: unknown;
};

const PAGE_SIZE = 25;
const MAIN_KEYS = new Set(['idx', 'name', 'empCode', 'autoDeposit']);
const SEARCH_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'empCode', label: 'Emp Code' },
] as const;
type SearchKey = (typeof SEARCH_FIELDS)[number]['key'];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === null || value === undefined || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function statLabel(stats: Stat[] | undefined): string {
  const s = Array.isArray(stats) ? stats[0] : undefined;
  if (!s) return '(0) : 0';
  return `(${Number(s.count) || 0}) : ${floorNum(s.totalAmount ?? 0).toLocaleString('en-IN')}`;
}

/** Tolerant unpack matching desktop extractCustomerItems. */
function extractItems(raw: unknown): { items: Row[]; totalPages: number; total: number } {
  const obj = (raw || {}) as Record<string, unknown>;
  const nested = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as Record<
    string,
    unknown
  >;
  let items: Row[] = [];
  if (Array.isArray(nested.items)) items = nested.items as Row[];
  else if (Array.isArray(obj.items)) items = obj.items as Row[];
  else if (Array.isArray(raw)) items = raw as Row[];
  items = items.filter((r) => r && String(r._id || '').length > 0);
  const totalPages = Math.max(1, Number(nested.totalPages ?? obj.totalPages) || 1);
  const total = Number(nested.total ?? obj.total) || items.length;
  return { items, totalPages, total };
}

function unpackDeposits(raw: unknown): Map<string, DepositEntry> {
  const map = new Map<string, DepositEntry>();
  let list: DepositEntry[] = [];
  if (Array.isArray(raw)) list = raw as DepositEntry[];
  else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) list = obj.items as DepositEntry[];
    else if (Array.isArray(obj.payload)) list = obj.payload as DepositEntry[];
    else list = [obj as DepositEntry];
  }
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const key = String(entry._id || entry.callerId || '');
    if (key) {
      map.set(key, entry);
      continue;
    }
    // Desktop also handles a map keyed directly by caller id:
    // { [callerId]: { depositData, coinData } }
    for (const [k, v] of Object.entries(entry)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const val = v as DepositEntry;
        if (Array.isArray(val.depositData) || Array.isArray(val.coinData)) map.set(k, val);
      }
    }
  }
  return map;
}

export function CustomerAllotmentScreen() {
  const canShowMobile = hasPermission('show_mobile');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [depositMap, setDepositMap] = useState<Map<string, DepositEntry>>(new Map());
  const [searchField, setSearchField] = useState<SearchKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { itemPerPage: PAGE_SIZE, pageNo: page };
      const text = appliedSearch.text.trim();
      if (text) payload.filter = { [appliedSearch.field]: text };
      const res = await secureApi<unknown>('ops.customerSupportGetAll', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load customer allotment');
        setRows([]);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      const parsed = extractItems(res.data);
      setSheetRow(null);
      setRows(parsed.items);
      setTotalPages(parsed.totalPages);
      setTotal(parsed.total);

      // Deposit stats overlay (desktop loads this after the list).
      const dep = await secureApi<unknown>('ops.customerSupportDeposit', {
        itemPerPage: PAGE_SIZE,
        pageNo: page,
      });
      if (gen !== genRef.current) return;
      setDepositMap(dep.ok ? unpackDeposits(dep.data) : new Map());
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * PAGE_SIZE + i + 1) },
      { key: 'name', label: 'Name', width: 130, render: (r) => display(r.name) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'email', label: 'Email', width: 160, render: (r) => display(r.email) },
      { key: 'empCode', label: 'Emp Code', width: 90, render: (r) => display(r.empCode) },
      {
        key: 'autoDeposit',
        label: 'Todays Automatic Deposit',
        width: 150,
        align: 'center',
        render: (r) => statLabel(depositMap.get(String(r._id || ''))?.depositData),
      },
      {
        key: 'coinDeposit',
        label: 'Todays Coin Deposit',
        width: 140,
        align: 'center',
        render: (r) => statLabel(depositMap.get(String(r._id || ''))?.coinData),
      },
      {
        key: 'alloted',
        label: 'Allotted Customer',
        width: 120,
        align: 'center',
        render: (r) => String(r.allotedCustomer?.length ?? 0),
      },
      { key: 'block', label: 'Status', width: 90, render: (r) => (r.block ? 'Blocked' : 'Active') },
      { key: 'blockReason', label: 'Block Reason', width: 130, render: (r) => display(r.blockReason) },
    ],
    [page, canShowMobile, depositMap],
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
      <Text style={styles.title}>Customer Allotment</Text>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

      {/* Search (no date filter on this page, matching desktop) */}
      <View style={styles.searchWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Text style={styles.rowLabel}>Search by</Text>
          {SEARCH_FIELDS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, searchField === f.key && styles.chipActive]}
              onPress={() => setSearchField(f.key)}
            >
              <Text style={[styles.chipText, searchField === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={() => {
              setAppliedSearch({ field: searchField, text: searchDraft });
              setPage(1);
            }}
            returnKeyType="search"
            placeholder={`Search ${SEARCH_FIELDS.find((f) => f.key === searchField)?.label ?? ''}…`}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={searchField === 'mobile' ? 'phone-pad' : 'default'}
          />
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.btnDisabled]}
            disabled={loading}
            onPress={() => {
              setAppliedSearch({ field: searchField, text: searchDraft });
              setPage(1);
            }}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No callers found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        note="Block/Unblock and Caller Report are available on the desktop panel."
        onClose={() => setSheetRow(null)}
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
  searchWrap: { marginTop: spacing(3) },
  chipRow: { alignItems: 'center', paddingVertical: spacing(1) },
  rowLabel: { color: colors.muted, fontSize: 12, marginRight: spacing(2) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(2) },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginRight: spacing(2),
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  btnDisabled: { opacity: 0.5 },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
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
  pagerLabel: { color: colors.muted, fontSize: 13 },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
});
