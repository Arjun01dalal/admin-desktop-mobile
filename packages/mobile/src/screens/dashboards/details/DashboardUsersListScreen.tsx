/**
 * Dashboard users list — port of desktop DashboardUsersListPage.
 * kind: 'balance' | 'bonus' | 'registered' maps to a secureApi action.
 * Phone UI: compact cards (not a horizontal table).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { makeStyles } from '../../../styles/common';
import { useNavigation, useRoute } from '@react-navigation/native';
import { INDIA_STATES, appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { todayIST } from '../../../utils/dates';
import {
  DetailFilterBar,
  SEARCH_FIELDS,
  type SearchFieldKey,
  type SearchFieldOption,
} from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Kind = 'balance' | 'bonus' | 'registered';
type UserTypeFilter = '' | 'Active' | 'InActive';

type UserRow = {
  _id?: string;
  name?: string;
  mobile?: string;
  balance?: number;
  bonusBalance?: number;
  clientName?: string;
  city?: string;
  state?: string;
  [key: string]: unknown;
};

type DashboardUsersResponse = {
  users?: UserRow[];
  items?: UserRow[];
  totalBalance?: number;
  totalBonusBalance?: number;
  total?: number;
  totalPages?: number;
};

const META: Record<
  Kind,
  {
    title: string;
    action: 'users.getAllBalance' | 'users.getAllBonus' | 'users.registeredUser';
    decreasing?: boolean;
  }
> = {
  balance: { title: 'Total Users Balance', action: 'users.getAllBalance', decreasing: true },
  bonus: { title: 'Total Users Bonus Balance', action: 'users.getAllBonus' },
  registered: { title: 'Total Registered Users App Today', action: 'users.registeredUser' },
};

const PAGE_SIZE = 25;

const USER_TYPE_OPTIONS: { value: UserTypeFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'InActive', label: 'InActive' },
];

const BALANCE_SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'balance', label: 'Balance' },
  { key: 'city', label: 'City' },
];

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
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = typeof params.startDate === 'string' ? params.startDate : todayIST();
  const initialEnd = typeof params.endDate === 'string' ? params.endDate : todayIST();
  const canShowMobile = hasPermission('show_mobile');
  const hideContact = hasPermission('contact_visibility_none');
  const canOpenReport = hasPermission('wallet_history');
  const showUserTypeFilter = kind === 'balance' || kind === 'bonus';
  const showStateFilter = kind === 'balance' || kind === 'bonus';
  const searchFields = kind === 'registered' ? SEARCH_FIELDS : BALANCE_SEARCH_FIELDS;

  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [appClientName, setAppClientName] = useState('');
  const [userType, setUserType] = useState<UserTypeFilter>('');
  const [stateFilter, setStateFilter] = useState('');
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

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId || !canOpenReport) return;
      navigation.navigate('/user-report', {
        userId: String(userId),
        userName: String(userName || ''),
      });
    },
    [canOpenReport, navigation],
  );

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

  const sheetActions = useMemo<SheetAction[] | undefined>(() => {
    if (!selected?._id || !canOpenReport) return undefined;
    return [
      {
        label: 'View Details',
        tone: 'primary',
        onPress: () => {
          const id = selected._id;
          const name = selected.name;
          setSelected(null);
          openUserReport(id, name);
        },
      },
    ];
  }, [selected, canOpenReport, openUserReport]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appClientName) filter.clientName = appClientName;
      if (stateFilter) filter.state = stateFilter;
      if (userType === 'Active') filter.active = true;
      if (userType === 'InActive') filter.inActive = true;

      const searchText = appliedSearch.text.trim();
      if (searchText) {
        if (appliedSearch.field === 'balance') {
          const n = Number(searchText);
          if (Number.isFinite(n)) filter.balance = n;
        } else {
          filter[appliedSearch.field] = searchText;
        }
      }

      const payload: Record<string, unknown> = {
        startDate,
        endDate,
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      if (meta.decreasing) payload.decreasing = true;

      const res = await secureApi<DashboardUsersResponse | UserRow[]>(meta.action, payload);
      if (!res.ok) {
        setError(res.message || 'Failed to load users');
        setRows([]);
        return;
      }
      const paged = asPaged<UserRow>(res.data);
      setSelected(null);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages || 1));

      const envelope = Array.isArray(res.data) ? {} : (res.data ?? {});
      const total = Number(
        envelope.totalBalance ?? envelope.totalBonusBalance ?? envelope.total ?? 0,
      ) || 0;
      setTotalBalance(total);
    } finally {
      setLoading(false);
    }
  }, [
    appClientName,
    appliedSearch,
    endDate,
    meta.action,
    meta.decreasing,
    page,
    pageSize,
    startDate,
    stateFilter,
    userType,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const amountLabel = kind === 'bonus' ? 'Bonus' : 'Balance';

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
          searchFields={searchFields}
          searchField={searchField}
          onSearchFieldChange={setSearchField}
          searchText={searchDraft}
          onSearchTextChange={setSearchDraft}
          onSearchSubmit={() => {
            setAppliedSearch({ field: searchField, text: searchDraft });
            setPage(1);
          }}
        />
        {showUserTypeFilter ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Text style={styles.filterLabel}>User Type</Text>
            {USER_TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.chip, userType === opt.value && styles.chipActive]}
                onPress={() => {
                  setUserType(opt.value);
                  setPage(1);
                }}
              >
                <Text style={[styles.chipText, userType === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        {showStateFilter ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Text style={styles.filterLabel}>State</Text>
            <TouchableOpacity
              style={[styles.chip, !stateFilter && styles.chipActive]}
              onPress={() => {
                setStateFilter('');
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, !stateFilter && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {INDIA_STATES.map((state) => (
              <TouchableOpacity
                key={state}
                style={[styles.chip, stateFilter === state && styles.chipActive]}
                onPress={() => {
                  setStateFilter(state);
                  setPage(1);
                }}
              >
                <Text
                  style={[styles.chipText, stateFilter === state && styles.chipTextActive]}
                >
                  {state}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
        {totalBalance > 0 ? (
          <Text style={styles.total}>Total: ₹{totalBalance.toLocaleString('en-IN')}</Text>
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        <Text style={styles.hint}>Tap a card for all details</Text>
      </View>
    ),
    [
      meta.title,
      startDate,
      endDate,
      draftStart,
      draftEnd,
      loading,
      appClientName,
      searchFields,
      searchField,
      searchDraft,
      pageSize,
      showUserTypeFilter,
      showStateFilter,
      userType,
      stateFilter,
      totalBalance,
      error,
    ],
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
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item, index }) => {
          const value = kind === 'bonus' ? item.bonusBalance : item.balance;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSelected(item)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(item.name)}
                </Text>
                <Text style={styles.cardApp} numberOfLines={1}>
                  {appCodeForName(item.clientName)}
                </Text>
              </View>
              <View style={styles.cardGrid}>
                <View style={styles.cardCell}>
                  <Text style={styles.cardLabel}>Mobile</Text>
                  <Text style={styles.cardValue} numberOfLines={1}>
                    {maskMobile(item.mobile, canShowMobile)}
                  </Text>
                </View>
                <View style={styles.cardCell}>
                  <Text style={styles.cardLabel}>{amountLabel}</Text>
                  <Text style={[styles.cardValue, styles.cardAmount]} numberOfLines={1}>
                    ₹{floorNum(value ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                {item.state || item.city ? (
                  <View style={[styles.cardCell, styles.cardCellWide]}>
                    <Text style={styles.cardLabel}>Location</Text>
                    <Text style={styles.cardValue} numberOfLines={1}>
                      {[item.city, item.state].filter(Boolean).join(', ') || '—'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardHint}>Tap for all details</Text>
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
        actions={sheetActions}
      />
    </>
  );
}

const styles = makeStyles({
  total: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: spacing(2) },
  hint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: spacing(2) },
  filterRow: {
    flexDirection: 'row',
    gap: spacing(2),
    alignItems: 'center',
    marginTop: spacing(2),
    paddingRight: spacing(2),
  },
  filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(2),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  cardIndex: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 28,
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  cardApp: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 72,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  cardCell: {
    width: '47%',
    flexGrow: 1,
    minWidth: '45%',
  },
  cardCellWide: {
    width: '100%',
  },
  cardLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardValue: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  cardAmount: {
    color: colors.primary,
    fontWeight: '700',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(2) },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing(6) },
});
