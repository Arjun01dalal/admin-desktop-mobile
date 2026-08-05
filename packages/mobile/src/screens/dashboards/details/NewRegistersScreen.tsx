/**
 * New Registers — full-column port of desktop NewRegistersPage.
 * Calls users.getAll with { itemsPerPage, pageNo, startDate, endDate, filter }.
 * Every desktop column is shown in a sideways-scrolling table; contact
 * columns are hidden for restricted roles like on desktop.
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
import {
  formatAadharAddress,
  nestedDpId,
  nestedName,
  pickAadharNumber,
  pickAccountNumber,
  pickAppName,
  pickLastActivity,
  pickPlayIn,
  pickUserBankName,
} from '../../../dashboards/userRowUtils';
import { secureApi } from '../../../api/client';
import { getRoleId, getRoleName, hasPermission } from '../../../auth/permissions';
import { CALLER_ROLE_IDS } from '../../../auth/callerRoles';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar, type SearchFieldKey } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['idx', 'name', 'mobile', 'appName', 'balance', 'created']);

/** Mirror of desktop NewRegistersPage isNewRegistersCaller — caller roles must not see contact columns. */
function isNewRegistersCaller(): boolean {
  const id = String(getRoleId() || '');
  if (id && CALLER_ROLE_IDS.has(id)) return true;
  const name = String(getRoleName() || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return name === 'caller' || name === 'caller_new';
}

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

export function NewRegistersScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none') || isNewRegistersCaller();

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});

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
  const [selected, setSelected] = useState<Row | null>(null);

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
      setSelected(null);
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

  const columns = useMemo<DataTableColumn<Row>[]>(() => {
    const cols: DataTableColumn<Row>[] = [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 120, render: (r) => display(r.name) },
      { key: 'dpId', label: 'DP ID', width: 150, render: (r) => display(r._id) },
      {
        key: 'userComesFrom',
        label: 'User Comes From',
        width: 110,
        render: (r) => String(r.userComesFrom || 'Company'),
      },
      {
        key: 'balance',
        label: 'Balance',
        width: 80,
        align: 'right',
        render: (r) => floorNum(r.balance ?? 0).toLocaleString('en-IN'),
      },
      { key: 'lastActivity', label: 'Last Activity', width: 150, render: (r) => pickLastActivity(r) },
    ];
    if (!hideContact) {
      cols.push({ key: 'userBankName', label: 'User Bank Name', width: 130, render: (r) => pickUserBankName(r) });
    }
    cols.push(
      { key: 'appName', label: 'App Code', width: 70, render: (r) => appCodeForName(pickAppName(r)) },
      { key: 'playIn', label: 'In', width: 90, render: (r) => pickPlayIn(r) },
      {
        key: 'encryptedDpId',
        label: 'User Encrypted Dp Id',
        width: 150,
        render: (r) => String(r.encryptedUserName || '-'),
      },
    );
    if (!hideContact) {
      cols.push(
        { key: 'mobile', label: 'Mobile Phone', width: 100, render: (r) => maskMobile(r.mobile, canShowMobile) },
        { key: 'kyc', label: 'Kyc', width: 70, render: (r) => (r.kyc === true ? 'Done' : 'Not Done') },
        { key: 'accountNumber', label: 'Account Number', width: 130, render: (r) => pickAccountNumber(r) },
        { key: 'aadharNumber', label: 'Aadhar Number', width: 120, render: (r) => pickAadharNumber(r) },
        { key: 'email', label: 'Email', width: 160, render: (r) => (canShowMobile ? display(r.email) : '**********') },
      );
    }
    cols.push(
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
    );
    if (!hideContact) {
      cols.push(
        { key: 'previousCallerName', label: 'Previous Caller Name', width: 130, render: (r) => nestedName(r.previousCaller) },
        { key: 'previousCallerDpId', label: 'Previous Caller Dp_ID', width: 150, render: (r) => nestedDpId(r.previousCaller) },
      );
    }
    cols.push({ key: 'empCode', label: 'Employee Code', width: 100, render: (r) => String(r.empCode || '-') });
    if (!hideContact) {
      cols.push(
        { key: 'currentCaller', label: 'Current Caller', width: 120, render: (r) => nestedName(r.currentCaller) },
        { key: 'referredCode', label: 'Referred Referral Code', width: 140, render: (r) => String(r.referredCode || '-') },
        { key: 'referralCode', label: 'Referral Code', width: 110, render: (r) => String(r.referralCodeUser || '-') },
      );
    }
    cols.push(
      { key: 'deviceType', label: 'Device Type', width: 90, render: (r) => String(r.deviceType || '-') },
      { key: 'playerAppVersion', label: 'User App Version', width: 110, render: (r) => String(r.currentAppVersion || '-') },
      {
        key: 'appVersion',
        label: 'App Version',
        width: 90,
        render: (r) => display(appVersions[String(pickAppName(r) || '')]),
      },
      {
        key: 'created',
        label: 'Created',
        width: 90,
        render: (r) => formatDisplayDate(r.createdOn || r.createdAt) || '-',
      },
      {
        key: 'time',
        label: 'Time',
        width: 80,
        render: (r) => formatDisplayTime(r.createdOn || r.createdAt) || '-',
      },
      {
        key: 'bonusBalance',
        label: 'Free Points Bonus',
        width: 110,
        align: 'right',
        render: (r) => floorNum(r.bonusWalletBalance ?? 0).toLocaleString('en-IN'),
      },
    );
    if (!hideContact) {
      cols.push(
        { key: 'blockReason', label: 'Block User Reason', width: 140, render: (r) => String(r.blockUserReason || '-') },
        { key: 'aadharAddress', label: 'Aadhar Address', width: 220, render: (r) => formatAadharAddress(r) },
      );
    }
    return cols;
  }, [page, pageSize, hideContact, canShowMobile, appVersions]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
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

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No users found"
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
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
