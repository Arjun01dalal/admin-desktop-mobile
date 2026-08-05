/**
 * New Registers — simplified port of desktop NewRegistersPage.
 * Calls users.getAll with { itemsPerPage, pageNo, startDate, endDate, filter }.
 * The 15+ advanced column filters are intentionally omitted; a paged list of
 * Name / Mobile / App / City-State / created date is shown.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar, type SearchFieldKey } from './DetailFilterBar';

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  city?: string;
  state?: string;
  createdOn?: string;
  createdAt?: string;
  [key: string]: unknown;
};

type Response = {
  users?: Row[];
  items?: Row[];
  total?: number;
  count?: number;
  totalPages?: number;
  payload?: Response;
};

const PAGE_SIZE = 25;

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}
function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
function formatDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function NewRegistersScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [appClientName, setAppClientName] = useState('');
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      if (appliedSearch.text.trim()) filter[appliedSearch.field] = appliedSearch.text.trim();
      const res = await secureApi<Response>('users.getAll', {
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
        startDate,
        endDate,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load users');
        setRows([]);
        return;
      }
      const data = (res.data || {}) as Response;
      const nested =
        data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)
          ? data.payload
          : data;
      const list: Row[] = Array.isArray(res.data)
        ? (res.data as Row[])
        : nested.items || nested.users || data.items || data.users || [];
      setRows(list);
      setTotal(
        Number(nested.total ?? nested.count ?? data.total ?? data.count ?? 0) || list.length,
      );
    } finally {
      setLoading(false);
    }
  }, [appClientName, appliedSearch, endDate, page, pageSize, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const header = useMemo(
    () => (
      <View>
        <Text style={styles.title}>New Registers</Text>
        <Text style={styles.sub}>
          {startDate} → {endDate} · Total: {total.toLocaleString('en-IN')}
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
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cell, styles.cellIndex, styles.headText]}>#</Text>
          <Text style={[styles.cell, styles.cellName, styles.headText]}>Name</Text>
          {!hideContact ? (
            <Text style={[styles.cell, styles.cellMobile, styles.headText]}>Mobile</Text>
          ) : null}
          <Text style={[styles.cell, styles.cellApp, styles.headText]}>App</Text>
          <Text style={[styles.cell, styles.cellCity, styles.headText]}>City/State</Text>
          <Text style={[styles.cell, styles.cellDate, styles.headText]}>Created</Text>
        </View>
      </View>
    ),
    [startDate, endDate, draftStart, draftEnd, loading, appClientName, searchField, searchDraft, pageSize, total, error, hideContact],
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      keyExtractor={(item, i) => item._id ?? String(i)}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
      renderItem={({ item, index }) => (
        <View style={styles.row}>
          <Text style={[styles.cell, styles.cellIndex]}>{(page - 1) * pageSize + index + 1}</Text>
          <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
            {display(item.name)}
          </Text>
          {!hideContact ? (
            <Text style={[styles.cell, styles.cellMobile]} numberOfLines={1}>
              {maskMobile(item.mobile, canShowMobile)}
            </Text>
          ) : null}
          <Text style={[styles.cell, styles.cellApp]} numberOfLines={1}>
            {appCodeForName(item.clientName)}
          </Text>
          <Text style={[styles.cell, styles.cellCity]} numberOfLines={1}>
            {display(item.city)}
            {item.state ? `, ${item.state}` : ''}
          </Text>
          <Text style={[styles.cell, styles.cellDate]} numberOfLines={1}>
            {formatDate(item.createdOn ?? item.createdAt)}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={{ marginTop: spacing(6) }} color={colors.primary} />
        ) : (
          <Text style={styles.empty}>No new registers found</Text>
        )
      }
      ListFooterComponent={
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
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headRow: { marginTop: spacing(3), borderBottomColor: colors.primary },
  headText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  cell: { color: colors.foreground, fontSize: 12, paddingHorizontal: spacing(1) },
  cellIndex: { width: 30 },
  cellName: { flex: 1.3 },
  cellMobile: { flex: 1.2 },
  cellApp: { width: 40, textAlign: 'center' },
  cellCity: { flex: 1.3 },
  cellDate: { flex: 1, textAlign: 'right' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing(6) },
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
