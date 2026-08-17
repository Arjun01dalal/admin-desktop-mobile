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
import { useNavigation } from '@react-navigation/native';
import { appCodeForName, pickPageSizes } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { DateField } from '../../../components/DateField';

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

const PAGE_SIZE_OPTIONS = pickPageSizes([25, 50, 100, 200]);

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

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatAmt(value: unknown): string {
  return num(value).toLocaleString('en-IN');
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function withdrawalPct(deposit?: number, withdrawal?: number): string {
  if (!deposit) return '0';
  return ((num(withdrawal) / num(deposit)) * 100).toFixed(2);
}

function lastActivity(value?: string): string {
  if (!value) return '—';
  return `${formatDisplayDate(value)} · ${formatDisplayTime(value)}`;
}

/** Mirror desktop unpackPayload: unwrap a single `.payload` object. */
function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');
  const [mid, setMid] = useState('');
  const [midOptions, setMidOptions] = useState<string[]>([]);

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
  const genRef = useRef(0);
  const midsLoadedRef = useRef(false);

  // Drill-down: main list → MID breakdown (desktop /depositList/user-wise).
  const [view, setView] = useState<'main' | 'midBreakdown'>('main');
  const [drillTitle, setDrillTitle] = useState('');
  const [drillMids, setDrillMids] = useState<MidTotal[]>([]);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
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
      if (appliedStart && appliedEnd) {
        body.startDate = appliedStart;
        body.endDate = appliedEnd;
      }
      const res = await secureApi<unknown>('depositList.report', body);
      if (gen !== genRef.current) return;
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
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, appliedStart, appliedEnd, mid, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    setApplied({ ...EMPTY_SEARCH, [searchField]: draftText.trim() });
    setPage(1);
  }, [searchField, draftText]);

  const applyDates = useCallback(() => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPage(1);
  }, [startDate, endDate]);

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setAppliedStart('');
    setAppliedEnd('');
    setMid('');
    setDraftText('');
    setApplied(EMPTY_SEARCH);
    setPage(1);
  }, []);

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
      { key: 'idx', label: '#', width: 34, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
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
      { key: 'clientName', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'lastActivity', label: 'Last Activity', width: 160, render: (r) => lastActivity(r.activeUser) },
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
        render: (r) =>
          formatAmt(num(r.approvedDepositAmount) - num(r.approvedWithdrawalAmount)),
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
      label: 'Refund MID Count',
      value: String(normalizeMids(sheetRow.approvedWithdrawalAmountByMid).length),
    });
    return fields;
  }, [sheetRow, columns]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const acts: SheetAction[] = [
      {
        label: 'User Details',
        tone: 'primary',
        onPress: () => openUserDetails(sheetRow),
      },
    ];
    const dep = normalizeMids(sheetRow.approvedDepositAmountByMid);
    const wit = normalizeMids(sheetRow.approvedWithdrawalAmountByMid);
    if (dep.length) {
      acts.push({
        label: `Deposit MIDs (${dep.length})`,
        tone: 'primary',
        onPress: () =>
          openMidBreakdown(
            `${display(sheetRow.name)} — Deposit MIDs`,
            sheetRow.approvedDepositAmountByMid,
          ),
      });
    }
    if (wit.length) {
      acts.push({
        label: `Refund MIDs (${wit.length})`,
        tone: 'default',
        onPress: () =>
          openMidBreakdown(
            `${display(sheetRow.name)} — Refund MIDs`,
            sheetRow.approvedWithdrawalAmountByMid,
          ),
      });
    }
    return acts;
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
  const currentField = SEARCH_FIELDS.find((f) => f.key === searchField);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Deposit List</Text>

      <View style={styles.totalsRow}>
        <Text style={styles.kpiText} numberOfLines={1}>
          Deposit Amt: {formatAmt(totals?.totalDepositAmount ?? 0)}
        </Text>
        <Text style={styles.kpiText} numberOfLines={1}>
          Withdrawal Amt: {formatAmt(totals?.totalWithdrawalAmount ?? 0)}
        </Text>
      </View>

      {/* Date range */}
      <View style={styles.filterWrap}>
        <View style={styles.datesRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>From</Text>
            <DateField style={styles.dateInput} value={startDate} onChange={setStartDate} />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>To</Text>
            <DateField style={styles.dateInput} value={endDate} onChange={setEndDate} />
          </View>
        </View>
        <View style={styles.actionBtnsRow}>
          <TouchableOpacity
            style={[styles.applyBtn, styles.actionBtnFlex]}
            onPress={applyDates}
            disabled={loading}
          >
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.clearBtn, styles.actionBtnFlex]}
            onPress={clearFilters}
            disabled={loading}
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyBtn, styles.actionBtnFlex]}
            onPress={() => void load()}
            disabled={loading}
          >
            <Text style={styles.applyText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Search field chips + input */}
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
          <View style={styles.searchInputWrap}>
            <TextInput
              style={styles.searchInput}
              value={draftText}
              onChangeText={setDraftText}
              onSubmitEditing={search}
              returnKeyType="search"
              placeholder={currentField?.placeholder ?? 'Search'}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={searchField === 'mobile' ? 'phone-pad' : 'default'}
            />
            {Boolean(draftText.trim()) ? (
              <TouchableOpacity
                style={styles.clearSearchBtn}
                onPress={() => setDraftText('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.btnDisabled]}
            disabled={loading}
            onPress={search}
          >
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* MID selector */}
        {midOptions.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Text style={styles.chipsLabel}>Mid</Text>
            <TouchableOpacity
              style={[styles.chip, mid === '' && styles.chipActive]}
              onPress={() => {
                setMid('');
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, mid === '' && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {midOptions.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, mid === m && styles.chipActive]}
                onPress={() => {
                  setMid(m);
                  setPage(1);
                }}
              >
                <Text style={[styles.chipText, mid === m && styles.chipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      {/* Per page */}
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

      <Text style={styles.sectionLabel}>Details List</Text>

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No data</Text> : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row.userId ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSheetRow(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
              {row.userId ? (
                <TouchableOpacity
                  style={styles.reportBtn}
                  onPress={() => openUserDetails(row)}
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
              <Text style={styles.cardValue}>{maskMobile(row.mobile, !!canShowMobile)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Last Activity</Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {lastActivity(row.activeUser)}
              </Text>
            </View>
            <Text style={styles.cardHint}>Tap card for details & MID breakdown</Text>
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
        actions={sheetActions}
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
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
  sectionLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  totalsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  kpiText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  filterWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginTop: spacing(3),
  },
  datesRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-end' },
  dateField: { flex: 1, minWidth: 0 },
  dateLabel: { color: colors.muted, fontSize: 11, marginBottom: spacing(1) },
  dateInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  actionBtnFlex: { flex: 1 },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  clearBtnText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
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
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  searchRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingRight: spacing(9),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  clearSearchBtn: {
    position: 'absolute',
    right: spacing(2),
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearSearchText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
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
  perPageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.muted, marginTop: spacing(2), marginBottom: spacing(1) },
  list: { gap: spacing(2), marginTop: spacing(2) },
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
