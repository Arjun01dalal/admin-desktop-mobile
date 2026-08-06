/**
 * BetConstruct Games — port of desktop BetConstructGamesPage.
 * ops.betConstructGetAll { pageNo, itemPerPage, status:true, Name? }; parses
 * data.games + data.count. Row tap opens a detail modal. Image upload stays desktop-only.
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
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  Name?: string;
  name?: string;
  category?: string;
  allowedCurrency?: string[];
  allowedCurrencies?: string[];
  subCategory?: string;
  gameId?: string | number;
  providerName?: string;
  provider?: { name?: string; id?: string | number };
  rating?: number | string;
  ratingCount?: number | string;
  status?: boolean;
  updatedOn?: string;
  [key: string]: unknown;
};

const PAGE_SIZE = 25;
const MAIN_KEYS = new Set(['idx', 'name', 'category', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function BetConstructGamesScreen() {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemPerPage: PAGE_SIZE,
        status: true,
      };
      const name = appliedSearch.trim();
      if (name) payload.Name = name;
      const res = await secureApi<unknown>('ops.betConstructGetAll', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load BetConstruct games');
        setRows([]);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      const data = (res.data || {}) as { games?: Row[]; count?: number };
      const count = Number(data.count) || 0;
      setSheetRow(null);
      setRows(Array.isArray(data.games) ? data.games : []);
      setTotal(count);
      setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
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
      { key: 'name', label: 'Name', width: 160, render: (r) => display(r.Name || r.name) },
      { key: 'category', label: 'Category', width: 110, render: (r) => display(r.category) },
      {
        key: 'currency',
        label: 'Allowed Currency',
        width: 130,
        render: (r) => {
          const list = r.allowedCurrency ?? r.allowedCurrencies;
          return Array.isArray(list) ? list.join(', ') : '—';
        },
      },
      { key: 'subCategory', label: 'Sub Category', width: 110, render: (r) => display(r.subCategory) },
      { key: 'gameId', label: 'Game Id', width: 110, render: (r) => display(r.gameId) },
      {
        key: 'providerName',
        label: 'Provider Name',
        width: 130,
        render: (r) => display(r.providerName || r.provider?.name),
      },
      {
        key: 'providerDetails',
        label: 'Provider Details',
        width: 150,
        render: (r) =>
          r.provider ? `${display(r.provider.name)} / ${display(r.provider.id)}` : '—',
      },
      { key: 'rating', label: 'Rating', width: 70, align: 'center', render: (r) => display(r.rating) },
      {
        key: 'ratingCount',
        label: 'Rating Count',
        width: 100,
        align: 'center',
        render: (r) => display(r.ratingCount),
      },
      { key: 'status', label: 'Status', width: 80, render: (r) => (r.status ? 'Active' : 'Inactive') },
      {
        key: 'updatedOn',
        label: 'Updated On',
        width: 150,
        render: (r) =>
          r.updatedOn ? `${formatDisplayDate(r.updatedOn)} ${formatDisplayTime(r.updatedOn)}` : '—',
      },
    ],
    [page],
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
      <Text style={styles.title}>BetConstruct Games</Text>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchDraft}
          onChangeText={setSearchDraft}
          onSubmitEditing={() => {
            setAppliedSearch(searchDraft);
            setPage(1);
          }}
          returnKeyType="search"
          placeholder="Search by game name…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={() => {
            setAppliedSearch(searchDraft);
            setPage(1);
          }}
        >
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
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
        emptyMessage="No games found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.Name || sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        note="Image upload is available on the desktop panel."
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(3) },
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
