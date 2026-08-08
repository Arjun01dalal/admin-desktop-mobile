/**
 * Todays Active — full-column port of desktop TodaysActivePage.
 * ops.activeCustomers with startDate/endDate route params. Shows every
 * desktop column in a sideways-scrolling table.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { pickLastActivity } from '../../../dashboards/userRowUtils';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import {
  DetailFilterBar,
  type SearchFieldKey,
  type SearchFieldOption,
} from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'name', 'mobile', 'appName', 'balance']);

/** Search fields mirroring desktop TodaysActivePage per-column filters (filter keys match).
 *  Contact-identifier fields are withheld for restricted roles like the desktop column filters. */
function todaysActiveSearchFields(hideContact: boolean): readonly SearchFieldOption[] {
  const fields: SearchFieldOption[] = [
    { key: 'name', label: 'Name' },
    { key: '_id', label: 'Dp Id' },
  ];
  if (!hideContact) {
    fields.push(
      { key: 'mobile', label: 'Mobile' },
      { key: 'accountNumber', label: 'Account' },
      { key: 'aadhaarNumber', label: 'Aadhar' },
      { key: 'email', label: 'Email' },
    );
  }
  fields.push(
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'played', label: 'In (E/C/S)' },
  );
  return fields;
}

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  played?: string;
  city?: string;
  state?: string;
  deviceType?: string;
  balance?: number;
  activeUser?: string;
  createdOn?: string;
  [key: string]: unknown;
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

export function TodaysActiveScreen() {
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
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      if (appliedSearch.text.trim()) filter[appliedSearch.field] = appliedSearch.text.trim();
      const res = await secureApi('ops.activeCustomers', {
        itemsPerPage: pageSize,
        pageNo: page,
        ...(startDate && endDate ? { startDate, endDate } : {}),
        filter,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load todays active users');
        setRows([]);
        return;
      }
      const raw = res.data as
        | { user?: Row[]; totalPages?: number; count?: number }
        | undefined;
      setSelected(null);
      setRows(Array.isArray(raw?.user) ? raw!.user! : []);
      setTotalPages(Math.max(1, Number(raw?.totalPages ?? 1) || 1));
      setTotal(Number(raw?.count ?? 0) || 0);
    } finally {
      setLoading(false);
    }
  }, [appClientName, appliedSearch, endDate, page, pageSize, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await secureApi<{ clientName?: string; version?: string }[]>(
        'users.appVersions',
        {},
      );
      if (cancelled || !res.ok) return;
      const map: Record<string, string> = {};
      for (const item of Array.isArray(res.data) ? res.data : []) {
        if (item?.clientName) map[item.clientName] = String(item.version ?? '');
      }
      setAppVersions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 120, render: (r) => display(r.name) },
      { key: 'dpId', label: 'Dp Id', width: 150, render: (r) => display(r._id) },
    ];
    if (!hideContact) {
      cols.push({
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => maskMobile(r.mobile, canShowMobile),
      });
    }
    cols.push(
      { key: 'appName', label: 'App Code', width: 70, render: (r) => appCodeForName(r.clientName) },
      { key: 'playIn', label: 'In', width: 90, render: (r) => display(r.played) },
    );
    if (!hideContact) {
      cols.push(
        { key: 'account', label: 'Account', width: 120, render: (r) => display(r.accountNumber) },
        { key: 'aadhar', label: 'Aadhar', width: 110, render: (r) => display(r.aadhaarNumber) },
        {
          key: 'email',
          label: 'Email',
          width: 160,
          render: (r) => (canShowMobile ? display(r.email) : '**********'),
        },
      );
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      { key: 'device', label: 'Device', width: 80, render: (r) => display(r.deviceType) },
      {
        key: 'balance',
        label: 'Balance',
        width: 80,
        align: 'right',
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'playerAppVersion',
        label: 'User App Version',
        width: 110,
        render: (r) => display(r.currentAppVersion),
      },
      {
        key: 'appVersion',
        label: 'App Version',
        width: 90,
        render: (r) => display(appVersions[r.clientName || '']),
      },
      { key: 'lastActivity', label: 'Last Activity', width: 150, render: (r) => pickLastActivity(r) },
      {
        key: 'date',
        label: 'Date',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 80,
        render: (r) => (r.createdOn ? formatDisplayTime(r.createdOn) : '—'),
      },
    );
    return cols;
  }, [page, pageSize, hideContact, canShowMobile, appVersions]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Todays Active</Text>
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
        searchFields={todaysActiveSearchFields(hideContact)}
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
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No active users found"
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.name) : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(selected, 0),
                  color: c.color?.(selected),
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
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
