/**
 * Todays Active — port of desktop TodaysActivePage.
 * ops.activeCustomers with startDate/endDate. Card list + detail sheet.
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { pickLastActivity } from '../../../dashboards/userRowUtils';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import {
  DetailFilterBar,
  type SearchFieldKey,
  type SearchFieldOption,
} from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

/** Search fields mirroring desktop TodaysActivePage per-column filters. */
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
  currentAppVersion?: string;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
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
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigation.navigate('/user-report', {
        userId: String(userId),
        userName: String(userName || ''),
      });
    },
    [navigation],
  );

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

  const sheetFields = useCallback(
    (r: Row): SheetField[] => {
      const fields: SheetField[] = [
        { label: 'Dp Id', value: display(r._id) },
        { label: 'App Code', value: appCodeForName(r.clientName) },
        { label: 'In', value: display(r.played) },
      ];
      if (!hideContact) {
        fields.push(
          { label: 'Mobile', value: maskMobile(r.mobile, canShowMobile) },
          { label: 'Account', value: display(r.accountNumber) },
          { label: 'Aadhar', value: display(r.aadhaarNumber) },
          {
            label: 'Email',
            value: canShowMobile ? display(r.email) : '**********',
          },
        );
      }
      fields.push(
        { label: 'City', value: display(r.city) },
        { label: 'State', value: display(r.state) },
        { label: 'Device', value: display(r.deviceType) },
        {
          label: 'Balance',
          value: floorNum(r.balance ?? 0).toLocaleString('en-IN'),
        },
        { label: 'User App Version', value: display(r.currentAppVersion) },
        {
          label: 'App Version',
          value: display(appVersions[r.clientName || '']),
        },
        { label: 'Last Activity', value: pickLastActivity(r) },
        {
          label: 'Date',
          value: r.createdOn ? formatDisplayDate(r.createdOn) : '—',
        },
        {
          label: 'Time',
          value: r.createdOn ? formatDisplayTime(r.createdOn) : '—',
        },
      );
      return fields;
    },
    [hideContact, canShowMobile, appVersions],
  );

  const sheetActions = useMemo<SheetAction[] | undefined>(() => {
    if (!selected?._id) return undefined;
    return [
      {
        label: 'User Report',
        tone: 'primary',
        onPress: () => {
          const id = selected._id;
          const name = selected.name;
          setSelected(null);
          openUserReport(id, name);
        },
      },
    ];
  }, [selected, openUserReport]);

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

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No active users found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSelected(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
              {row._id ? (
                <TouchableOpacity
                  style={styles.reportBtn}
                  onPress={() => openUserReport(row._id, row.name)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={styles.reportBtnText}>User Report</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>App</Text>
              <Text style={styles.cardValue}>{appCodeForName(row.clientName)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Balance</Text>
              <Text style={styles.cardValue}>
                {floorNum(row.balance ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
            {!hideContact ? (
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Mobile</Text>
                <Text style={styles.cardValue}>{maskMobile(row.mobile, canShowMobile)}</Text>
              </View>
            ) : null}
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>In</Text>
              <Text style={styles.cardValue}>{display(row.played)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Last Activity</Text>
              <Text style={styles.cardValue}>{pickLastActivity(row)}</Text>
            </View>
            <Text style={styles.cardHint}>Tap card for full details</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.name) : ''}
        fields={selected ? sheetFields(selected) : []}
        onClose={() => setSelected(null)}
        actions={sheetActions}
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
  reportBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    flexShrink: 0,
  },
  reportBtnText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: { color: colors.foreground, fontSize: 11, flex: 1, textAlign: 'right' },
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
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
