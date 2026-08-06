/**
 * Non Performing User — port of desktop NonPerformingUserPage.
 * ops.nonPerformingUser { pageNo, itemPerPage, startDate?, endDate?, filter } (filter always
 * present, dates only when both applied). Row tap opens a detail modal with all columns.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
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
  clientName?: string;
  email?: string;
  mobile?: string;
  balance?: number | string;
  totalAmount?: number | string;
  state?: string;
  city?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  createdOn?: string;
  updatedOn?: string;
  [key: string]: unknown;
};

const PAGE_SIZE = 25;
const MAIN_KEYS = new Set(['idx', 'name', 'balance', 'lastActivity']);

const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'dpId', label: 'Dp ID' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'balance', label: 'Balance' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === null || value === undefined || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function formatTs(ts?: string): string {
  if (!ts) return '—';
  return `${formatDisplayDate(ts)} ${formatDisplayTime(ts)}`;
}

export function NonPerformingUserScreen() {
  const canShowMobile = hasPermission('show_mobile');

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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      // Desktop buildFilter: name, _id (dpId), mobile, numeric balance, state, city, clientName.
      const filter: Record<string, unknown> = {};
      const text = appliedSearch.text.trim();
      if (text) {
        if (appliedSearch.field === 'dpId') filter._id = text;
        else if (appliedSearch.field === 'balance') {
          if (!Number.isNaN(Number(text))) filter.balance = Number(text);
        } else filter[appliedSearch.field] = text;
      }
      if (appClientName) filter.clientName = appClientName;
      const res = await secureApi<unknown>('ops.nonPerformingUser', {
        pageNo: page,
        itemPerPage: PAGE_SIZE,
        ...(startDate && endDate ? { startDate, endDate } : {}),
        filter,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load non performing users');
        setRows([]);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      const parsed = asPaged<Row>(res.data);
      setSheetRow(null);
      setRows(parsed.rows);
      setTotal(parsed.total ?? parsed.rows.length);
      setTotalPages(Math.max(1, parsed.totalPages ?? 1));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, startDate, endDate, appliedSearch, appClientName]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * PAGE_SIZE + i + 1) },
      { key: 'name', label: 'User Name', width: 130, render: (r) => display(r.name) },
      { key: 'dpId', label: 'Dp ID', width: 150, render: (r) => display(r._id) },
      { key: 'appCode', label: 'App Code', width: 80, render: (r) => appCodeForName(String(r.clientName || '')) },
      { key: 'email', label: 'Email', width: 160, render: (r) => display(r.email) },
      { key: 'mobile', label: 'Mobile', width: 100, render: (r) => maskMobile(r.mobile, canShowMobile) },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'center',
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'depositAmount',
        label: 'Deposit Amount',
        width: 110,
        align: 'center',
        render: (r) => floorNum(r.totalAmount ?? 0).toLocaleString('en-IN'),
      },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      {
        key: 'appVersion',
        label: 'Current / Updated App Version',
        width: 160,
        render: (r) => `${display(r.currentAppVersion)} / ${display(r.updatedAppVersion)}`,
      },
      { key: 'created', label: 'Created', width: 150, render: (r) => formatTs(r.createdOn) },
      { key: 'lastActivity', label: 'Last Activity', width: 150, render: (r) => formatTs(r.updatedOn) },
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
      <Text style={styles.title}>Non Performing User</Text>
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

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No data available"
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
