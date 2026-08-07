/**
 * Profit & Loss — per-user balances, bets, deposits and withdrawals.
 * Port of desktop ProfitLossPage with the mobile screen structure:
 * search bar (User ID / Name / Mobile), per-page chips, DataTable with
 * main columns and a bottom sheet showing every column, pagination.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { type SearchFieldOption } from './DetailFilterBar';
import { TextInput } from 'react-native';

type PLRow = {
  _id?: string;
  name?: string;
  mobile?: number | string;
  balance?: number;
  deposite?: number;
  betAmount?: number;
  totalProfit?: number;
  withdrawl?: number;
  bonus?: number;
};

/** Search fields map to desktop filter keys (_id / name / mobile). */
const SEARCH_BAR_FIELDS: readonly SearchFieldOption[] = [
  { key: '_id', label: 'User ID' },
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile' },
];

const PAGE_SIZES = [10, 25, 50, 75, 100];

function fmt(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === undefined || value === null || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function unwrap(raw: unknown): { rows: PLRow[]; count: number } {
  const body =
    raw && typeof raw === 'object' && 'payload' in (raw as object)
      ? (raw as { payload?: unknown }).payload ?? raw
      : raw;
  if (body && typeof body === 'object') {
    const obj = body as { data?: unknown; count?: unknown };
    if (Array.isArray(obj.data)) {
      return { rows: obj.data as PLRow[], count: Number(obj.count ?? 0) || 0 };
    }
  }
  if (Array.isArray(body)) return { rows: body as PLRow[], count: (body as PLRow[]).length };
  return { rows: [], count: 0 };
}

/** Columns shown in the list; the bottom sheet shows all of them. */
const MAIN_KEYS = new Set(['sr', 'name', 'deposite', 'winAmount']);

export function ProfitLossScreen() {
  const isFocused = useIsFocused();
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchField, setSearchField] = useState('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<PLRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: PLRow; index: number } | null>(null);
  const genRef = React.useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const res = await secureApi('profitLoss.list', {
        pageSize,
        pageNumber: page,
        filter,
      });
      if (gen !== genRef.current) return; // stale response
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load profit & loss');
        setRows([]);
        setCount(0);
        return;
      }
      const { rows: next, count: total } = unwrap(res.data);
      setRows(next);
      setCount(total);
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, filter]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const submitSearch = useCallback(() => {
    const text = searchDraft.trim();
    setPage(1);
    setFilter(text ? { [searchField]: text } : {});
  }, [searchField, searchDraft]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize) || 1);
  const rowOffset = (page - 1) * pageSize;

  const columns = useMemo<DataTableColumn<PLRow>[]>(
    () => [
      { key: 'sr', label: '#', width: 50, render: (_r, i) => String(i + 1 + rowOffset) },
      { key: 'userId', label: 'User ID', width: 160, render: (r) => String(r._id || '—') },
      { key: 'name', label: 'User Name', width: 140, render: (r) => String(r.name || '—') },
      { key: 'mobile', label: 'Mobile No', width: 110, render: (r) => maskMobile(r.mobile, canShowMobile) },
      { key: 'startBalance', label: 'Start Balance', width: 110, align: 'right', render: (r) => fmt(r.balance) },
      { key: 'deposite', label: 'Deposite', width: 100, align: 'right', render: (r) => fmt(r.deposite) },
      { key: 'betAmount', label: 'Bet Amount', width: 100, align: 'right', render: (r) => fmt(r.betAmount) },
      { key: 'winAmount', label: 'Win Amount', width: 100, align: 'right', render: (r) => fmt(r.totalProfit) },
      { key: 'withdraw', label: 'Withdraw', width: 100, align: 'right', render: (r) => fmt(r.withdrawl) },
      { key: 'bonus', label: 'Bonus', width: 90, align: 'right', render: (r) => fmt(r.bonus ?? 0) },
      { key: 'endBalance', label: 'End Balance', width: 110, align: 'right', render: (r) => fmt(r.balance) },
    ],
    [rowOffset, canShowMobile],
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
      <Text style={styles.title}>Profit &amp; Loss</Text>
      <Text style={styles.sub}>
        Per-user balances, bets, deposits and withdrawals · Tap a row for all details
      </Text>

      {/* Search bar (same pattern as other pages) */}
      <View style={styles.searchCard}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Text style={styles.chipRowLabel}>Search by</Text>
            {SEARCH_BAR_FIELDS.map((f) => (
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
          </View>
        </ScrollView>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder={`Search ${SEARCH_BAR_FIELDS.find((f) => f.key === searchField)?.label ?? ''}…`}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={searchField === 'mobile' ? 'phone-pad' : 'default'}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={submitSearch} disabled={loading}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Per-page chips */}
      <View style={styles.chipRowSpaced}>
        <Text style={styles.chipRowLabel}>Per page</Text>
        {PAGE_SIZES.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, pageSize === n && styles.chipActive]}
            onPress={() => {
              setPageSize(n);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, pageSize === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
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
        emptyMessage={loading ? 'Loading…' : 'No records found'}
        onRowPress={(row) => setSelected({ row, index: rows.indexOf(row) })}
        hint="Tap a row to see all details"
      />

      {/* Pagination */}
      <View style={styles.pagerRow}>
        <TouchableOpacity
          style={[styles.pagerBtn, (page <= 1 || loading) && styles.pagerBtnDisabled]}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
        >
          <Text style={styles.pagerBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pagerInfo}>
          {count > 0
            ? `${count.toLocaleString()} records · page ${page} of ${totalPages}`
            : 'No records'}
        </Text>
        <TouchableOpacity
          style={[styles.pagerBtn, (page >= totalPages || loading) && styles.pagerBtnDisabled]}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
        >
          <Text style={styles.pagerBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.row.name || 'Details') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected.row, selected.index),
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
  searchCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  chipRowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  chipRowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  searchRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
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
    gap: spacing(2),
  },
  pagerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  pagerInfo: { color: colors.muted, fontSize: 12, flexShrink: 1, textAlign: 'center' },
});
