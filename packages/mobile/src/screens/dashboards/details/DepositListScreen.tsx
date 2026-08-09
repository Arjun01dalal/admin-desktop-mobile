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
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
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

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

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
      if (startDate && endDate) {
        body.startDate = startDate;
        body.endDate = endDate;
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
  }, [page, pageSize, startDate, endDate, mid, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    setApplied({ ...EMPTY_SEARCH, [searchField]: draftText.trim() });
    setPage(1);
  }, [searchField, draftText]);

  const clearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
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

  // ---- Fit main columns to the phone width (no horizontal scroll). ----
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 30;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);
  const mainW = {
    name: fit(3, 10),
    userId: fit(3.2, 10),
    deposit: fit(1.9, 10),
    withdrawal: fit(1.9, 10),
  };

  const columns = useMemo<DataTableColumn<DepositListRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: mainW.name, render: (r) => display(r.name) },
      { key: 'userId', label: 'User Id', width: mainW.userId, render: (r) => display(r.userId) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 130,
        render: (r) => maskMobile(r.mobile, !!canShowMobile),
      },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 120, render: (r) => display(r.state) },
      { key: 'clientName', label: 'Client Name', width: 130, render: (r) => display(r.clientName) },
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
        width: mainW.deposit,
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
        label: 'Withdrawal',
        width: mainW.withdrawal,
        align: 'right',
        render: (r) => formatAmt(r.approvedWithdrawalAmount),
      },
      {
        key: 'withdrawalCount',
        label: 'Withdrawal Count',
        width: 120,
        align: 'right',
        render: (r) => String(num(r.approvedWithdrawalCount)),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, canShowMobile, availableWidth],
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
    const acts: SheetAction[] = [];
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
        label: `Withdrawal MIDs (${wit.length})`,
        tone: 'default',
        onPress: () =>
          openMidBreakdown(
            `${display(sheetRow.name)} — Withdrawal MIDs`,
            sheetRow.approvedWithdrawalAmountByMid,
          ),
      });
    }
    return acts;
  }, [sheetRow, openMidBreakdown]);

  const midColumns = useMemo<DataTableColumn<MidTotal>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'mid', label: 'Mid', width: 200, color: () => colors.primary, render: (r) => display(r.mid) },
      { key: 'amount', label: 'Amount', width: 130, align: 'right', render: (r) => formatAmt(r.amount) },
      { key: 'count', label: 'Count', width: 100, align: 'right', render: (r) => display(r.count) },
    ],
    [],
  );

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
        <DataTable
          columns={midColumns}
          rows={drillMids}
          keyFor={(r, i) => `${r.mid}-${i}`}
          emptyMessage="No MID data"
        />
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
        <View style={styles.kpiBox}>
          <Text style={styles.kpiText}>Deposit Amt: {formatAmt(totals?.totalDepositAmount ?? 0)}</Text>
        </View>
        <View style={styles.kpiBox}>
          <Text style={styles.kpiText}>
            Withdrawal Amt: {formatAmt(totals?.totalWithdrawalAmount ?? 0)}
          </Text>
        </View>
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
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => setPage(1)}
          >
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.applyBtn, styles.clearBtn]} onPress={clearFilters}>
            <Text style={styles.applyText}>Clear</Text>
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

      <DataTable
        columns={columns.filter((c) =>
          ['idx', 'name', 'userId', 'deposit', 'withdrawal'].includes(c.key),
        )}
        rows={rows}
        keyFor={(r, i) => String(r.userId || i)}
        loading={loading}
        emptyMessage="No data"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details & MID breakdown"
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
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  kpiBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    flexGrow: 1,
  },
  kpiText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  filterWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginTop: spacing(3),
  },
  datesRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-end', flexWrap: 'wrap' },
  dateField: { flex: 1, minWidth: 110 },
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
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
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
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
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
