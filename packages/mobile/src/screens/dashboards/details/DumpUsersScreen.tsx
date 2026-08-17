/**
 * Dump Users — port of desktop DumpUsersPage.
 * users.getAll { itemsPerPage, pageNo, filter:{ dump:true, name?, mobile?, _id? } }
 * lists dumped users; ops.dumpUsersUpdate { _id, dump:false } un-dumps a row.
 * Table shows a compact subset; row tap opens the full detail sheet with the
 * Un-Dump action. Desktop's user-report navigation is desktop-only (no /users/report
 * route on mobile) and is skipped.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { pickPageSizes, appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getRoleId, hasPermission } from '../../../auth/permissions';
import { CALLER_ROLE_IDS } from '../../../auth/callerRoles';
import { formatDisplayDate } from '../../../utils/dates';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type SearchFieldOption = { key: string; label: string };

type Row = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  balance?: number | string;
  empCode?: string;
  totalDeposit?: number | string;
  city?: string;
  state?: string;
  email?: string;
  dumpReason?: {
    reason?: string;
    name?: string;
    Date?: string;
  };
  [key: string]: unknown;
};

const PAGE_SIZE_OPTIONS = pickPageSizes([25, 50, 100, 200]);

const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: '_id', label: 'Dp Id' },
  { key: 'mobile', label: 'Mobile' },
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function formatAmount(value: unknown): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  if (num === 0) return '0';
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

export function DumpUsersScreen() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchField, setSearchField] = useState<string>('name');
  const [searchText, setSearchText] = useState('');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'name',
    text: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const [undumpingId, setUndumpingId] = useState('');
  const genRef = useRef(0);

  const canShowMobile = hasPermission('show_mobile');
  const isCaller = CALLER_ROLE_IDS.has(getRoleId() || '');

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = { dump: true };
      const text = applied.text.trim();
      if (text) {
        if (applied.field === '_id') filter._id = text;
        else if (applied.field === 'mobile') filter.mobile = text;
        else filter.name = text;
      }
      const res = await secureApi<unknown>('users.getAll', {
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load dump users');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<Row>(res.data);
      setSheetRow(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    setApplied({ field: searchField, text: searchText });
    setPage(1);
  }, [searchField, searchText]);

  const handleUndump = useCallback(
    (row: Row) => {
      Alert.alert('Un-Dump user', `Un-dump ${display(row.name)}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Un-Dump',
          onPress: () => {
            void (async () => {
              setUndumpingId(row._id);
              try {
                const res = await secureApi<unknown>('ops.dumpUsersUpdate', {
                  _id: row._id,
                  dump: false,
                });
                if (!res.ok) {
                  setError(res.message || 'Failed to un-dump user');
                  setSheetRow(null);
                  return;
                }
                setSheetRow(null);
                void load();
              } finally {
                setUndumpingId('');
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'idx', label: '#', width: 48, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 150, render: (r) => display(r.name) },
      { key: 'dpId', label: 'Dp Id', width: 200, render: (r) => display(r._id) },
      { key: 'mobile', label: 'Mobile', width: 130, render: (r) => maskMobile(r.mobile, canShowMobile) },
      { key: 'appCode', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'balance', label: 'Balance', width: 100, align: 'right', render: (r) => formatAmount(r.balance) },
      { key: 'empCode', label: 'Emp Code', width: 110, render: (r) => display(r.empCode) },
      {
        key: 'totalDeposit',
        label: 'Total Deposit',
        width: 120,
        align: 'right',
        render: (r) => formatAmount(r.totalDeposit),
      },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 130, render: (r) => display(r.state) },
      { key: 'email', label: 'Email', width: 180, render: (r) => display(r.email) },
    ];
    if (!isCaller) {
      cols.push({
        key: 'dumpReason',
        label: 'Dump Reason',
        width: 160,
        render: (r) => display(r.dumpReason?.reason),
      });
    }
    cols.push({
      key: 'updatedBy',
      label: 'Update By',
      width: 180,
      render: (r) =>
        `${display(r.dumpReason?.name)}${
          r.dumpReason?.Date ? ` · ${formatDisplayDate(r.dumpReason.Date)}` : ''
        }`,
    });
    return cols;
  }, [page, pageSize, canShowMobile, isCaller]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(sheetRow, 0),
        multiline: c.key === 'updatedBy' || c.key === 'dumpReason',
      }));
  }, [sheetRow, columns]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Dump Users</Text>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          <Text style={styles.chipsLabel}>Search by</Text>
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
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder={`Search ${
              SEARCH_FIELDS.find((f) => f.key === searchField)?.label ?? 'name'
            }…`}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={searchField === 'mobile' ? 'phone-pad' : 'default'}
          />
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.btnDisabled]}
            disabled={loading}
            onPress={search}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.perPageRow}>
        <Text style={styles.chipsLabel}>Per page:</Text>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, pageSize === n && styles.chipActive]}
            onPress={() => {
              if (pageSize !== n) {
                setPageSize(n);
                setPage(1);
              }
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

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No dump users found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSheetRow(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
              <TouchableOpacity
                style={styles.undumpBtn}
                onPress={() => handleUndump(row)}
                disabled={undumpingId === row._id}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.undumpBtnText}>
                  {undumpingId === row._id ? '…' : 'Un-Dump'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>
                App Code: {appCodeForName(row.clientName)}
              </Text>
              <Text style={styles.cardSplitRight} numberOfLines={1}>
                Balance: {formatAmount(row.balance)}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>DP ID</Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {display(row._id)}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Mobile</Text>
              <Text style={styles.cardValue}>
                {maskMobile(row.mobile, canShowMobile)}
              </Text>
            </View>
            {!isCaller ? (
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Reason</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.dumpReason?.reason)}
                </Text>
              </View>
            ) : null}
            <Text style={styles.cardHint}>Tap card for full details</Text>
          </TouchableOpacity>
        ))}
      </View>

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

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={sheetFields}
        actions={
          sheetRow
            ? ([
                {
                  label: undumpingId === sheetRow._id ? 'Un-Dumping…' : 'Un-Dump',
                  tone: 'primary',
                  disabled: undumpingId === sheetRow._id,
                  onPress: () => handleUndump(sheetRow),
                },
              ] satisfies SheetAction[])
            : []
        }
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  filterWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chipsRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  chipsLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  perPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
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
    alignItems: 'center',
    justifyContent: 'center',
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
  undumpBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    flexShrink: 0,
  },
  undumpBtnText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '700',
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
