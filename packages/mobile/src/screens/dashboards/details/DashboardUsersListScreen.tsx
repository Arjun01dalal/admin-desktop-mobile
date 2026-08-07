/**
 * Dashboard users list — port of desktop DashboardUsersListPage.
 * kind: 'balance' | 'bonus' | 'registered' maps to a secureApi action.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar, type SearchFieldKey } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Kind = 'balance' | 'bonus' | 'registered';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  balance?: number;
  bonusBalance?: number;
  clientName?: string;
  [key: string]: unknown;
};

const META: Record<
  Kind,
  { title: string; action: 'users.getAllBalance' | 'users.getAllBonus' | 'users.registeredUser'; decreasing?: boolean }
> = {
  balance: { title: 'Total Users Balance', action: 'users.getAllBalance', decreasing: true },
  bonus: { title: 'Total Users Bonus Balance', action: 'users.getAllBonus' },
  registered: { title: 'Total Registered Users App Today', action: 'users.registeredUser' },
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

export function DashboardUsersListScreen({ kind }: { kind: Kind }) {
  const meta = META[kind];
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
  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBalance, setTotalBalance] = useState(0);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    const fields: SheetField[] = [
      { label: 'Name', value: display(selected.name) },
      { label: 'DP ID', value: display(selected._id) },
      { label: 'Mobile', value: maskMobile(selected.mobile, canShowMobile) },
      { label: 'App', value: appCodeForName(selected.clientName) },
      { label: 'Balance', value: floorNum(selected.balance ?? 0).toLocaleString('en-IN') },
    ];
    if (kind === 'bonus') {
      fields.push({
        label: 'Bonus',
        value: floorNum(selected.bonusBalance ?? 0).toLocaleString('en-IN'),
      });
    }
    fields.push(
      { label: 'City', value: display(selected.city) },
      { label: 'State', value: display(selected.state) },
    );
    // Show any remaining data the API returned so the sheet never drops fields.
    const known = new Set([
      '_id',
      'name',
      'mobile',
      'balance',
      'bonusBalance',
      'clientName',
      'city',
      'state',
      '__v',
      'password',
      'token',
    ]);
    const contactKeys = new Set([
      'email',
      'accountNumber',
      'aadharNumber',
      'aadhaarNumber',
      'aadharAddress',
      'ifsc',
      'bankName',
      'userBankName',
    ]);
    for (const [key, value] of Object.entries(selected)) {
      if (known.has(key)) continue;
      if (hideContact && contactKeys.has(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object') continue;
      const label = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());
      fields.push({ label, value: String(value) });
    }
    return fields;
  }, [selected, canShowMobile, hideContact, kind]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      if (appliedSearch.text.trim()) filter[appliedSearch.field] = appliedSearch.text.trim();
      const payload: Record<string, unknown> = {
        startDate,
        endDate,
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      if (meta.decreasing) payload.decreasing = true;

      const res = await secureApi(meta.action, payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load users');
        setRows([]);
        return;
      }
      const paged = asPaged<UserRow>(res.data);
      setSelected(null);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages || 1));

      const envelope =
        res.data && typeof res.data === 'object'
          ? (res.data as Record<string, unknown>)
          : {};
      const total =
        Number(envelope.totalBalance ?? envelope.totalBonusBalance ?? envelope.total ?? 0) || 0;
      setTotalBalance(total);
    } finally {
      setLoading(false);
    }
  }, [appClientName, appliedSearch, endDate, meta.action, meta.decreasing, page, pageSize, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const header = useMemo(
    () => (
      <View>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.sub}>
          {startDate} → {endDate}
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
        {totalBalance > 0 ? (
          <Text style={styles.total}>Total: ₹{totalBalance.toLocaleString('en-IN')}</Text>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cell, styles.cellIndex, styles.headText]}>#</Text>
          <Text style={[styles.cell, styles.cellName, styles.headText]}>Name</Text>
          <Text style={[styles.cell, styles.cellMobile, styles.headText]}>Mobile</Text>
          <Text style={[styles.cell, styles.cellApp, styles.headText]}>App</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headText]}>
            {kind === 'bonus' ? 'Bonus' : 'Balance'}
          </Text>
        </View>
        <Text style={styles.hint}>Tap a row to see all details</Text>
      </View>
    ),
    [meta.title, startDate, endDate, draftStart, draftEnd, loading, appClientName, searchField, searchDraft, pageSize, totalBalance, error, kind],
  );

  return (
    <>
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={rows}
      showsVerticalScrollIndicator={false}
      keyExtractor={(item, i) => item._id ?? String(i)}
      ListHeaderComponent={header}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
      renderItem={({ item, index }) => {
        const value = kind === 'bonus' ? item.bonusBalance : item.balance;
        return (
          <TouchableOpacity style={styles.row} onPress={() => setSelected(item)}>
            <Text style={[styles.cell, styles.cellIndex]}>{(page - 1) * pageSize + index + 1}</Text>
            <Text style={[styles.cell, styles.cellName]} numberOfLines={1}>
              {display(item.name)}
            </Text>
            <Text style={[styles.cell, styles.cellMobile]} numberOfLines={1}>
              {maskMobile(item.mobile, canShowMobile)}
            </Text>
            <Text style={[styles.cell, styles.cellApp]} numberOfLines={1}>
              {appCodeForName(item.clientName)}
            </Text>
            <Text style={[styles.cell, styles.cellNum]}>
              {floorNum(value ?? 0).toLocaleString('en-IN')}
            </Text>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={{ marginTop: spacing(6) }} color={colors.primary} />
        ) : (
          <Text style={styles.empty}>No users</Text>
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
    <RowDetailSheet
      visible={selected !== null}
      title={selected ? display(selected.name) : ''}
      fields={sheetFields}
      onClose={() => setSelected(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  total: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: spacing(2) },
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
  cellIndex: { width: 34 },
  cellName: { flex: 1.4 },
  cellMobile: { flex: 1.3 },
  cellApp: { width: 44, textAlign: 'center' },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: spacing(1) },
  cellNum: { flex: 1, textAlign: 'right', fontWeight: '700' },
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
