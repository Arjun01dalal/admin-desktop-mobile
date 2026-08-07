/**
 * Bonus Wallet Fund Request — port of desktop BonusWalletFundRequestPage
 * (/fund-request-bonus-wallet) plus its linked table page
 * BonusWalletFundRequestTablePage (/fund-request-bonus-wallet-table).
 *
 * Main view: date filter + All Data toggle, three tappable KPI cards
 * (bonusWallet.fundRequestSummary). Tapping a card drills into an in-screen
 * table sub-view listing that type's records
 * (bonusWallet.fundApproved / fundPending / fundTransferIn), paginated with
 * name/mobile search and a compact main column subset; row tap opens the full
 * detail sheet.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { asPaged, unpackPayload } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type NavType = 'approved' | 'pending' | 'totalData';

type FundSummary = {
  pendingCount?: number;
  totalAmountTransferToMainWallet?: number;
  totalBonusWallet?: number;
  totalBonusWalletCount?: number;
  totalCountTransferToMainWallet?: number;
  totalPendingAmount?: number;
};

type FundRow = {
  _id: string;
  name?: string;
  mobile?: string;
  bonusWalletOpenBalance?: number | string;
  amount?: number | string;
  bonusWalletClosingBalance?: number | string;
  referredByName?: string;
  referredByMobile?: string;
  referredToName?: string;
  referredToMobile?: string;
  firstDepositPercentage?: number | string;
  referralPercentage?: number | string;
  status?: string;
  createdOn?: string | number;
  updatedOn?: string | number;
  createdAt?: string | number;
  updatedAt?: string | number;
};

const ITEMS_PER_PAGE = 50;
const MAIN_KEYS = new Set(['idx', 'name', 'mobile', 'amount', 'status']);

const ACTION_BY_TYPE: Record<NavType, string> = {
  pending: 'bonusWallet.fundPending',
  approved: 'bonusWallet.fundApproved',
  totalData: 'bonusWallet.fundTransferIn',
};

const TITLE_BY_TYPE: Record<NavType, string> = {
  pending: 'Pending',
  approved: 'Approved',
  totalData: 'Total Data',
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function formatIN(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function formatDateTime(value?: string | number): string {
  if (value == null || value === '') return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  return [d, t].filter(Boolean).join(' ') || '—';
}

function unpackSummary(data: unknown): FundSummary {
  return unpackPayload(data) as FundSummary;
}

/** Table page unpacker: prefers a `documents` array, else asPaged. */
function unpackDocuments(data: unknown): { rows: FundRow[]; total: number; totalPages: number } {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
        ? (obj.payload as Record<string, unknown>)
        : obj;
    if (Array.isArray(nested.documents)) {
      return {
        rows: nested.documents as FundRow[],
        totalPages: Number(nested.totalPages ?? 1) || 1,
        total: Number(nested.total ?? nested.documents.length) || 0,
      };
    }
  }
  return asPaged<FundRow>(data);
}

export function BonusWalletFundRequestScreen() {
  const canShowMobile = hasPermission('show_mobile');

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [allData, setAllData] = useState(false);
  const [summary, setSummary] = useState<FundSummary>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const summaryGenRef = useRef(0);

  // Drill-down table sub-view.
  const [view, setView] = useState<'main' | 'table'>('main');
  const [tableType, setTableType] = useState<NavType>('pending');
  const [page, setPage] = useState(1);
  const [draftSearch, setDraftSearch] = useState('');
  const [searchField, setSearchField] = useState<string>('name');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'name',
    text: '',
  });
  const [tableRows, setTableRows] = useState<FundRow[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableTotalPages, setTableTotalPages] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<FundRow | null>(null);
  const tableGenRef = useRef(0);

  const loadSummary = useCallback(
    async (opts?: { allData?: boolean; start?: string; end?: string }) => {
      const gen = ++summaryGenRef.current;
      const useAll = opts?.allData ?? false;
      const from = opts?.start ?? startDate;
      const to = opts?.end ?? endDate;
      setLoading(true);
      setError(null);
      try {
        const payload = useAll
          ? { allData: true }
          : {
              startDate: from || todayIST(),
              endDate: to || todayIST(),
              allData: false,
            };
        const res = await secureApi<unknown>('bonusWallet.fundRequestSummary', payload);
        if (gen !== summaryGenRef.current) return;
        if (!res.ok) {
          setError(res.message || 'Failed to load fund request summary');
          setSummary({});
          return;
        }
        setSummary(unpackSummary(res.data));
        setAllData(useAll);
      } finally {
        if (gen === summaryGenRef.current) setLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    void loadSummary({ allData: false, start: startDate, end: endDate });
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTable = useCallback(async () => {
    const gen = ++tableGenRef.current;
    setTableLoading(true);
    setTableError(null);
    try {
      const filter: Record<string, string> = {};
      const text = applied.text.trim();
      if (text) {
        if (applied.field === 'mobile') filter.mobile = text;
        else filter.name = text;
      }
      const base: Record<string, unknown> = {
        itemsPerPage: ITEMS_PER_PAGE,
        pageNo: page,
        filter,
      };
      const payload = allData
        ? { ...base, allData: true }
        : {
            ...base,
            allData: false,
            startDate: startDate || todayIST(),
            endDate: endDate || todayIST(),
          };
      const res = await secureApi<unknown>(ACTION_BY_TYPE[tableType], payload);
      if (gen !== tableGenRef.current) return;
      if (!res.ok) {
        setTableError(res.message || 'Failed to load bonus wallet fund requests');
        setTableRows([]);
        setTableTotal(0);
        setTableTotalPages(1);
        return;
      }
      const unpacked = unpackDocuments(res.data);
      setSheetRow(null);
      setTableRows(unpacked.rows);
      setTableTotal(unpacked.total);
      setTableTotalPages(Math.max(1, unpacked.totalPages));
    } finally {
      if (gen === tableGenRef.current) setTableLoading(false);
    }
  }, [tableType, page, applied, allData, startDate, endDate]);

  useEffect(() => {
    if (view === 'table') void loadTable();
  }, [view, loadTable]);

  const openTable = useCallback((type: NavType) => {
    setTableType(type);
    setPage(1);
    setDraftSearch('');
    setApplied({ field: 'name', text: '' });
    setSearchField('name');
    setTableRows([]);
    setView('table');
  }, []);

  const search = useCallback(() => {
    setApplied({ field: searchField, text: draftSearch });
    setPage(1);
  }, [searchField, draftSearch]);

  const cards = useMemo(
    () => [
      {
        id: 'approved' as const,
        label: 'Amount Transfer to Main Wallet',
        count: summary.totalCountTransferToMainWallet ?? 0,
        amount: summary.totalAmountTransferToMainWallet ?? 0,
      },
      {
        id: 'pending' as const,
        label: 'Pending Requests',
        count: summary.pendingCount ?? 0,
        amount: summary.totalPendingAmount ?? 0,
      },
      {
        id: 'totalData' as const,
        label: 'Total Bonus Wallet',
        count: summary.totalBonusWalletCount ?? 0,
        amount: summary.totalBonusWallet ?? 0,
      },
    ],
    [summary],
  );

  // Fit main columns to phone width (no horizontal scroll for the subset).
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 34;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);
  const w = {
    name: fit(3, 9),
    mobile: fit(2.4, 9),
    amount: fit(1.8, 9),
    status: fit(1.8, 9),
  };

  const columns = useMemo<DataTableColumn<FundRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String((page - 1) * ITEMS_PER_PAGE + i + 1) },
      { key: 'name', label: 'Name', width: w.name, render: (r) => display(r.name) },
      { key: 'mobile', label: 'Mobile', width: w.mobile, render: (r) => maskMobile(r.mobile, canShowMobile) },
      { key: 'openBal', label: 'Opening Balance', width: 130, align: 'right', render: (r) => display(r.bonusWalletOpenBalance) },
      { key: 'amount', label: 'Amount', width: w.amount, align: 'right', render: (r) => display(r.amount) },
      { key: 'closeBal', label: 'Closing Balance', width: 130, align: 'right', render: (r) => display(r.bonusWalletClosingBalance) },
      { key: 'refByName', label: 'Referred By Name', width: 150, render: (r) => display(r.referredByName) },
      { key: 'refByMobile', label: 'Referred By Mobile', width: 150, render: (r) => maskMobile(r.referredByMobile, canShowMobile) },
      { key: 'refToName', label: 'Referred To Name', width: 150, render: (r) => display(r.referredToName) },
      { key: 'refToMobile', label: 'Referred To Mobile', width: 150, render: (r) => maskMobile(r.referredToMobile, canShowMobile) },
      {
        key: 'firstDeposit',
        label: 'First Deposit %',
        width: 120,
        align: 'right',
        render: (r) =>
          r.firstDepositPercentage !== undefined && r.firstDepositPercentage !== ''
            ? `${r.firstDepositPercentage}%`
            : '—',
      },
      {
        key: 'referral',
        label: 'Referral %',
        width: 110,
        align: 'right',
        render: (r) =>
          r.referralPercentage !== undefined && r.referralPercentage !== ''
            ? `${r.referralPercentage}%`
            : '—',
      },
      { key: 'status', label: 'Status', width: w.status, render: (r) => display(r.status) },
      { key: 'created', label: 'Created', width: 110, render: (r) => formatDateTime(r.createdOn ?? r.createdAt) },
      { key: 'updated', label: 'Updated', width: 110, render: (r) => formatDateTime(r.updatedOn ?? r.updatedAt) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, canShowMobile, availableWidth],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }));
  }, [sheetRow, columns]);

  // ---------- Table sub-view ----------
  if (view === 'table') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={tableLoading} onRefresh={() => void loadTable()} tintColor={colors.primary} />
        }
      >
        <TouchableOpacity onPress={() => setView('main')}>
          <Text style={styles.backLink}>‹ Back to Summary</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Fund Requests — {TITLE_BY_TYPE[tableType]}</Text>
        <Text style={styles.sub}>
          {allData ? 'All data' : `${startDate} → ${endDate}`} · Total:{' '}
          {tableTotal.toLocaleString('en-IN')}
        </Text>

        <DetailFilterBar
          startDate={startDate}
          endDate={endDate}
          loading={tableLoading}
          onStartDateChange={() => {}}
          onEndDateChange={() => {}}
          onApply={() => {}}
          searchFields={[
            { key: 'name', label: 'Name' },
            { key: 'mobile', label: 'Mobile' },
          ]}
          searchField={searchField}
          onSearchFieldChange={setSearchField}
          searchText={draftSearch}
          onSearchTextChange={setDraftSearch}
          onSearchSubmit={search}
        />

        {tableError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{tableError}</Text>
          </View>
        ) : null}

        <DataTable
          columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
          rows={tableRows}
          keyFor={(r, i) => String(r._id || i)}
          loading={tableLoading}
          emptyMessage="No records found"
          onRowPress={(row) => setSheetRow(row)}
          hint="Tap a row to see all details"
        />

        <View style={styles.pager}>
          <Text
            style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
            onPress={() => page > 1 && setPage((p) => p - 1)}
          >
            ‹ Prev
          </Text>
          <Text style={styles.pagerLabel}>
            Page {page} / {tableTotalPages}
          </Text>
          <Text
            style={[styles.pagerBtn, page >= tableTotalPages && styles.pagerDisabled]}
            onPress={() => page < tableTotalPages && setPage((p) => p + 1)}
          >
            Next ›
          </Text>
        </View>

        <RowDetailSheet
          visible={sheetRow !== null}
          title={sheetRow ? display(sheetRow.name) : ''}
          fields={sheetFields}
          onClose={() => setSheetRow(null)}
        />
      </ScrollView>
    );
  }

  // ---------- Main (summary cards) view ----------
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void loadSummary({ allData })}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Bonus Wallet Fund Request</Text>
      <Text style={styles.sub}>{allData ? 'All data' : `${startDate} → ${endDate}`}</Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
          void loadSummary({ allData: false, start: draftStart, end: draftEnd });
        }}
      />

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.chip, !allData && styles.chipActive]}
          onPress={() => void loadSummary({ allData: false })}
        >
          <Text style={[styles.chipText, !allData && styles.chipTextActive]}>Date Range</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, allData && styles.chipActive]}
          onPress={() => void loadSummary({ allData: true })}
        >
          <Text style={[styles.chipText, allData && styles.chipTextActive]}>All Data</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.cardsWrap}>
        {cards.map((card) => (
          <TouchableOpacity key={card.id} style={styles.kpiCard} onPress={() => openTable(card.id)}>
            <Text style={styles.kpiLabel}>{card.label}</Text>
            <Text style={styles.kpiValue}>
              ({card.count}) — {formatIN(card.amount)}
            </Text>
            <Text style={styles.kpiHint}>Tap to view records ›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
  toggleRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
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
  cardsWrap: { gap: spacing(3), marginTop: spacing(4) },
  kpiCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  kpiValue: { color: colors.primary, fontSize: 18, fontWeight: '800', marginTop: spacing(2) },
  kpiHint: { color: colors.muted, fontSize: 11, marginTop: spacing(2) },
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
