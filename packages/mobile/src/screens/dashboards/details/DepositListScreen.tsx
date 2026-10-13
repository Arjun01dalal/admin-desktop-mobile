/**
 * Deposit List — port of desktop DepositListPage (route /depositList).
 * depositList.report { itemsPerPage, pageNo, filter:{ name, mobile, city, state,
 * userId, clientName, mid }, startDate?, endDate? } returns a paged per-user
 * deposit/withdrawal summary plus MID-wise totals and grand totals.
 *
 * The main list shows a compact subset; tapping a row opens the detail sheet
 * with every desktop column plus "View Deposit MIDs" / "View Withdrawal MIDs"
 * actions. Those drill into an in-screen sub-view (like FundsScreen) that lists
 * the MID breakdown — this is desktop's /depositList/user-wise route
 * (DepositListUserWisePage), implemented here as a view state rather than a
 * separate route.
 *
 * The desktop page has no mutations. The deposit/ helpers (SettleDialog etc.)
 * belong to a different transaction page and are not used here.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { appCodeForName, pickPageSizes, unpackPayload } from '@astro/shared';
import { colors } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { useRequestGeneration } from '../../../hooks/useRequestGeneration';
import { getSessionUser, hasPermission, Permissions } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { display, maskMobile } from '../../../utils/display';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { styles } from './DepositListScreen.styles';

type MidTotal = { mid?: string; amount?: number | string; count?: number | string };

type DepositListRow = {
  name?: string;
  userId?: string;
  mobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
  activeUser?: string;
  approvedDepositAmount?: number;
  approvedWithdrawalAmount?: number;
  approvedDepositCount?: number;
  approvedWithdrawalCount?: number;
  approvedDepositAmountByMid?: MidTotal[];
  approvedWithdrawalAmountByMid?: MidTotal[];
};

const PAGE_SIZE_OPTIONS = pickPageSizes([25, 50]);

const SEARCH_FIELDS: { key: keyof SearchState; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Name', placeholder: 'Search by Name' },
  { key: 'userId', label: 'DP Id', placeholder: 'Search by DP Id' },
  { key: 'mobile', label: 'Mobile', placeholder: 'Search by Mobile' },
  { key: 'city', label: 'City', placeholder: 'Search by City' },
  { key: 'state', label: 'State', placeholder: 'Search by State' },
  { key: 'clientName', label: 'App Name', placeholder: 'Search by App Name' },
];

type SearchState = {
  name: string;
  userId: string;
  mobile: string;
  city: string;
  state: string;
  clientName: string;
};

const EMPTY_SEARCH: SearchState = {
  name: '',
  userId: '',
  mobile: '',
  city: '',
  state: '',
  clientName: '',
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatAmt(value: unknown): string {
  return num(value).toLocaleString('en-IN');
}

function withdrawalPct(deposit?: number, withdrawal?: number): string {
  if (!deposit) return '0';
  return ((num(withdrawal) / num(deposit)) * 100).toFixed(2);
}

function lastActivity(value?: string): string {
  if (!value) return '—';
  return `${formatDisplayDate(value)} · ${formatDisplayTime(value)}`;
}

function normalizeMids(raw: unknown): MidTotal[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is MidTotal => !!item && typeof item === 'object');
}

export function DepositListScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  // Read once — getSessionUser returns a fresh object each call; using it in
  // hook deps would retrigger load() every render.
  const user = useMemo(() => getSessionUser(), []);
  const canShowMobile = useMemo(
    () =>
      hasPermission(Permissions.show_mobile) ||
      (Array.isArray((user as { Responsibilities?: string[] } | null)?.Responsibilities) &&
        (user as { Responsibilities?: string[] }).Responsibilities!.includes(
          Permissions.show_mobile,
        )),
    [user],
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [appliedStart, setAppliedStart] = useState(today);
  const [appliedEnd, setAppliedEnd] = useState(today);
  const [mid, setMid] = useState('');
  const [midOptions, setMidOptions] = useState<string[]>([]);
  const [midPickerOpen, setMidPickerOpen] = useState(false);
  const [midPickerQuery, setMidPickerQuery] = useState('');
  const [allData, setAllData] = useState(false);

  // Draft (unapplied) search inputs vs applied filter.
  const [searchField, setSearchField] = useState<keyof SearchState>('name');
  const [draftText, setDraftText] = useState('');
  const [applied, setApplied] = useState<SearchState>(EMPTY_SEARCH);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DepositListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totals, setTotals] = useState<Record<string, unknown> | null>(null);
  const [sheetRow, setSheetRow] = useState<DepositListRow | null>(null);
  const midsLoadedRef = useRef(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  // Drill-down: main list → MID breakdown (desktop /depositList/user-wise).
  const [view, setView] = useState<'main' | 'midBreakdown'>('main');
  const [drillTitle, setDrillTitle] = useState('');
  const [drillMids, setDrillMids] = useState<MidTotal[]>([]);

  const load = useCallback(async () => {
    const gen = next();
    begin();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        itemsPerPage: pageSize,
        pageNo: page,
        filter: {
          name: applied.name,
          mobile: applied.mobile,
          city: applied.city,
          state: applied.state,
          userId: applied.userId,
          clientName: applied.clientName,
          mid,
        },
      };
      if (!allData && appliedStart && appliedEnd) {
        body.startDate = appliedStart;
        body.endDate = appliedEnd;
      }
      const res = await secureApi<unknown>('depositList.report', body);
      if (!isCurrent(gen)) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load deposit list');
        setRows([]);
        setTotalPages(1);
        setTotals(null);
        return;
      }
      const payload = unpackPayload(res.data);
      const items = Array.isArray(payload.items) ? (payload.items as DepositListRow[]) : [];
      const sorted = items
        .slice()
        .sort((a, b) => (b?.activeUser || '').localeCompare(a?.activeUser || ''));
      setSheetRow(null);
      setRows(sorted);
      setTotalPages(Math.max(1, num(payload.totalPages) || 1));
      setTotals(
        payload.totals && typeof payload.totals === 'object'
          ? (payload.totals as Record<string, unknown>)
          : null,
      );
      // Populate the MID selector once, from the first response's midWiseTotals.
      if (!midsLoadedRef.current) {
        const midWise = normalizeMids(payload.midWiseTotals);
        const opts = midWise.map((m) => String(m.mid || '')).filter(Boolean);
        if (opts.length) {
          setMidOptions(opts);
          midsLoadedRef.current = true;
        }
      }
    } finally {
      end();
      if (isCurrent(gen)) setLoading(false);
    }
  }, [page, pageSize, appliedStart, appliedEnd, mid, applied, allData, next, isCurrent, begin, end]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    setApplied({ ...EMPTY_SEARCH, [searchField]: draftText.trim() });
    setPage(1);
  }, [searchField, draftText]);

  const applyDates = useCallback(() => {
    setAllData(false);
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPage(1);
  }, [startDate, endDate]);

  const applyAllData = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setAppliedStart('');
    setAppliedEnd('');
    setAllData(true);
    setPage(1);
  }, []);

  const clearDateFilter = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setAppliedStart('');
    setAppliedEnd('');
    setAllData(false);
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    const today = todayIST();
    setStartDate(today);
    setEndDate(today);
    setAppliedStart(today);
    setAppliedEnd(today);
    setAllData(false);
    setMid('');
    setDraftText('');
    setApplied(EMPTY_SEARCH);
    setPage(1);
  }, []);

  const filteredMidOptions = useMemo(() => {
    const q = midPickerQuery.trim().toLowerCase();
    if (!q) return midOptions;
    return midOptions.filter((m) => m.toLowerCase().includes(q));
  }, [midOptions, midPickerQuery]);

  const openMidBreakdown = useCallback((title: string, data?: MidTotal[]) => {
    const mids = normalizeMids(data);
    if (!mids.length) return;
    setDrillTitle(title);
    setDrillMids(mids);
    setSheetRow(null);
    setView('midBreakdown');
  }, []);

  const openUserDetails = useCallback(
    (row: DepositListRow) => {
      const userId = String(row.userId || '').trim();
      if (!userId) {
        Alert.alert('User Details', 'User ID is not available for this row.');
        return;
      }
      setSheetRow(null);
      openPanelTarget(navigation, {
        href: '/user-report',
        state: {
          userId,
          userName: String(row.name || ''),
        },
      });
    },
    [navigation],
  );

  // ---- Detail sheet columns (full field set) ----
  const columns = useMemo<DataTableColumn<DepositListRow>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 34,
        render: (_r, i) => String((page - 1) * pageSize + i + 1),
      },
      { key: 'name', label: 'Name', width: 140, render: (r) => display(r.name) },
      { key: 'userId', label: 'User Id', width: 160, render: (r) => display(r.userId) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 130,
        render: (r) => maskMobile(r.mobile, !!canShowMobile),
      },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 120, render: (r) => display(r.state) },
      {
        key: 'clientName',
        label: 'App Code',
        width: 90,
        render: (r) => appCodeForName(r.clientName),
      },
      {
        key: 'lastActivity',
        label: 'Last Activity',
        width: 160,
        render: (r) => lastActivity(r.activeUser),
      },
      {
        key: 'ratio',
        label: 'Ratio',
        width: 80,
        align: 'right',
        render: (r) => withdrawalPct(r.approvedDepositAmount, r.approvedWithdrawalAmount),
      },
      {
        key: 'dwRatio',
        label: 'Dep-With Ratio',
        width: 120,
        align: 'right',
        render: (r) => formatAmt(num(r.approvedDepositAmount) - num(r.approvedWithdrawalAmount)),
      },
      {
        key: 'deposit',
        label: 'Deposit',
        width: 100,
        align: 'right',
        render: (r) => formatAmt(r.approvedDepositAmount),
      },
      {
        key: 'depositCount',
        label: 'Deposit Count',
        width: 110,
        align: 'right',
        render: (r) => String(num(r.approvedDepositCount)),
      },
      {
        key: 'withdrawal',
        label: 'Refund',
        width: 100,
        align: 'right',
        render: (r) => formatAmt(r.approvedWithdrawalAmount),
      },
      {
        key: 'withdrawalCount',
        label: 'Refund Count',
        width: 120,
        align: 'right',
        render: (r) => String(num(r.approvedWithdrawalCount)),
      },
    ],
    [page, pageSize, canShowMobile],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const fields = columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }));
    fields.push({
      label: 'Deposit MID Count',
      value: String(normalizeMids(sheetRow.approvedDepositAmountByMid).length),
    });
    fields.push({
      label: 'Withdrawal MID Count',
      value: String(normalizeMids(sheetRow.approvedWithdrawalAmountByMid).length),
    });
    return fields;
  }, [sheetRow, columns]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const dep = normalizeMids(sheetRow.approvedDepositAmountByMid);
    const wit = normalizeMids(sheetRow.approvedWithdrawalAmountByMid);
    return [
      {
        label: 'User Details',
        tone: 'primary',
        onPress: () => openUserDetails(sheetRow),
      },
      {
        label: `Deposit MIDs (${dep.length})`,
        tone: 'primary',
        onPress: () =>
          openMidBreakdown(
            `${display(sheetRow.name)} — Deposit MIDs`,
            sheetRow.approvedDepositAmountByMid,
          ),
      },
      {
        label: `Withdrawal MIDs (${wit.length})`,
        tone: 'default',
        onPress: () =>
          openMidBreakdown(
            `${display(sheetRow.name)} — Withdrawal MIDs`,
            sheetRow.approvedWithdrawalAmountByMid,
          ),
      },
    ];
  }, [sheetRow, openMidBreakdown, openUserDetails]);

  // ---------- MID breakdown sub-view (desktop /depositList/user-wise) ----------
  if (view === 'midBreakdown') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => setView('main')}>
          <Text style={styles.backLink}>‹ Back to Deposit List</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{drillTitle}</Text>
        <Text style={styles.sub}>{drillMids.length} MIDs</Text>
        {drillMids.length === 0 ? <Text style={styles.hint}>No MID data</Text> : null}
        <View style={styles.list}>
          {drillMids.map((m, index) => (
            <View key={`${m.mid}-${index}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(m.mid)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Amount: {formatAmt(m.amount)}</Text>
                <Text style={styles.cardSplitRight}>Count: {display(m.count)}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ---------- Main list view ----------
  const keyExtractor = useCallback(
    (row: DepositListRow, index: number) => `row-${index}-${String(row.userId ?? '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<DepositListRow>) => (
      <DepositListCard
        row={row}
        index={index}
        page={page}
        pageSize={pageSize}
        canShowMobile={!!canShowMobile}
        onOpenSheet={() => setSheetRow(row)}
        onOpenReport={() => openUserDetails(row)}
      />
    ),
    [page, pageSize, canShowMobile, openUserDetails],
  );

  const listHeader = (
    <>
      <Text style={styles.title}>Deposit List</Text>

      <View style={styles.totalsRow}>
        <Text style={styles.kpiText} numberOfLines={1}>
          Deposit Amt: {formatAmt(totals?.totalDepositAmount ?? 0)}
        </Text>
        <Text style={styles.kpiText} numberOfLines={1}>
          Withdrawal Amt: {formatAmt(totals?.totalWithdrawalAmount ?? 0)}
        </Text>
      </View>

      <DetailFilterBar
        startDate={startDate}
        endDate={endDate}
        loading={loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={applyDates}
        onAllData={applyAllData}
        onClearDates={clearDateFilter}
        onClearAllFilters={clearFilters}
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={(k) => setSearchField(k as keyof SearchState)}
        searchText={draftText}
        onSearchTextChange={setDraftText}
        onSearchSubmit={search}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        onPageSizeChange={(n) => {
          if (pageSize !== n) {
            setPageSize(n);
            setPage(1);
          }
        }}
      >
        {midOptions.length ? (
          <View style={styles.midSelectWrap}>
            <Text style={styles.chipsLabel}>MID</Text>
            <TouchableOpacity
              style={styles.midSelectBtn}
              onPress={() => {
                setMidPickerQuery('');
                setMidPickerOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Select MID"
            >
              <Text style={styles.midSelectBtnText} numberOfLines={1}>
                {mid || 'All'}
              </Text>
              <Text style={styles.midSelectChevron}>▾</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.applyBtn, loading && styles.btnDisabled]}
          onPress={() => void load()}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          <Text style={styles.applyText}>Refresh</Text>
        </TouchableOpacity>
      </DetailFilterBar>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Details List</Text>
    </>
  );

  const listFooter = (
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
  );

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No data"
        refreshing={loading}
        onRefresh={() => void load()}
        refreshEnabled={!midPickerOpen}
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal
        visible={midPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMidPickerOpen(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select MID</Text>
            <TextInput
              style={styles.pickerSearch}
              value={midPickerQuery}
              onChangeText={setMidPickerQuery}
              placeholder="Search MID…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                style={[styles.pickerRow, !mid && styles.pickerRowActive]}
                onPress={() => {
                  setMid('');
                  setPage(1);
                  setMidPickerOpen(false);
                }}
              >
                <Text style={[styles.pickerRowText, !mid && styles.pickerRowTextActive]}>All</Text>
              </TouchableOpacity>
              {filteredMidOptions.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerRow, mid === m && styles.pickerRowActive]}
                  onPress={() => {
                    setMid(m);
                    setPage(1);
                    setMidPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, mid === m && styles.pickerRowTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setMidPickerOpen(false)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type DepositListCardProps = {
  row: DepositListRow;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  onOpenSheet: () => void;
  onOpenReport: () => void;
};

const DepositListCard = memo(function DepositListCard({
  row,
  index,
  page,
  pageSize,
  canShowMobile,
  onOpenSheet,
  onOpenReport,
}: DepositListCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onOpenSheet}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.name)}
        </Text>
        {row.userId ? (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={onOpenReport}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.reportBtnText}>User Report</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          App Code: {appCodeForName(row.clientName)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          DP: {display(row.userId)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft}>Deposit: {formatAmt(row.approvedDepositAmount)}</Text>
        <Text style={styles.cardSplitRight}>
          Refund: {formatAmt(row.approvedWithdrawalAmount)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Mobile</Text>
        <Text style={styles.cardValue}>{maskMobile(row.mobile, canShowMobile)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Last Activity</Text>
        <Text style={styles.cardValue} numberOfLines={1}>
          {lastActivity(row.activeUser)}
        </Text>
      </View>
      <Text style={styles.cardHint}>Tap card for details & MID breakdown</Text>
    </TouchableOpacity>
  );
});

