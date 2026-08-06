/**
 * Bonus Wallet Requests — port of desktop BonusWalletRequestsPage (/bonus-wallet).
 * Lists transfer requests (bonusWallet.transferRequests) with date filter,
 * status chips, name/mobile/transaction-id search, per-page chips and summary
 * chips (bonusWallet.fundRequestSummary). Row tap opens the detail sheet; when
 * the request is pending, Approve / Reject / Remove actions
 * (bonusWallet.updateTransferRequest) are available in the sheet.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type BonusRow = {
  _id: string;
  name?: string;
  mobile?: string;
  amount?: number | string;
  userId?: string;
  status?: string;
  updatedOn?: string;
  updatedBy?: { name?: string; _id?: string; date?: string };
};

type Summary = {
  approvedCount: number;
  walletBalance: number;
  pendingCount: number;
};

type ActionStatus = 'approve' | 'reject' | 'remove';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const STATUS_OPTIONS = ['', 'pending', 'approve', 'reject', 'remove'] as const;
const MAIN_KEYS = new Set(['idx', 'name', 'amount', 'status']);

const SEARCH_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'transactionId', label: 'Transaction Id' },
  { key: 'mobile', label: 'Mobile' },
] as const;

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

export function BonusWalletRequestsScreen() {
  // Read once — getSessionUser returns a fresh object each call.
  const admin = useMemo(
    () => getSessionUser() as { _id?: string; name?: string } | null,
    [],
  );
  const canShowMobile = hasPermission('show_mobile');

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [allData, setAllData] = useState(false);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchField, setSearchField] = useState<string>('name');
  const [draftSearch, setDraftSearch] = useState('');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'name',
    text: '',
  });

  const [rows, setRows] = useState<BonusRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({
    approvedCount: 0,
    walletBalance: 0,
    pendingCount: 0,
  });
  const [sheetRow, setSheetRow] = useState<BonusRow | null>(null);
  const [actingId, setActingId] = useState('');
  const genRef = useRef(0);
  const summaryGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      const text = applied.text.trim();
      if (text) {
        if (applied.field === 'mobile') filter.mobile = text;
        else if (applied.field === 'transactionId') filter._id = text;
        else filter.name = text;
      }
      const payload: Record<string, unknown> = {
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      if (!allData) {
        payload.startDate = startDate || todayIST();
        payload.endDate = endDate || todayIST();
      }
      const res = await secureApi<unknown>('bonusWallet.transferRequests', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load bonus wallet requests');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<BonusRow>(res.data);
      setSheetRow(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [status, applied, pageSize, page, allData, startDate, endDate]);

  const loadSummary = useCallback(async () => {
    const gen = ++summaryGenRef.current;
    try {
      let payload: Record<string, unknown>;
      if (allData) {
        payload = { allData: true };
      } else if (startDate && endDate) {
        payload = { startDate, endDate, allData: false };
      } else {
        const d = todayIST();
        payload = { startDate: d, endDate: d, allData: false };
      }
      const res = await secureApi<unknown>('bonusWallet.fundRequestSummary', payload);
      if (gen !== summaryGenRef.current) return;
      if (!res.ok) return;
      const body = unpackPayload(res.data);
      setSummary({
        approvedCount: Number(body.totalCountTransferToMainWallet) || 0,
        walletBalance: Number(body.totalAmountTransferToMainWallet) || 0,
        pendingCount: Number(body.pendingCount) || 0,
      });
    } catch {
      /* ignore */
    }
  }, [allData, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const search = useCallback(() => {
    setApplied({ field: searchField, text: draftSearch });
    setPage(1);
  }, [searchField, draftSearch]);

  const performAction = useCallback(
    (row: BonusRow, actionStatus: ActionStatus) => {
      if (!row._id || !row.userId) {
        setError('Missing request id');
        return;
      }
      void (async () => {
        setActingId(`${row._id}:${actionStatus}`);
        try {
          const res = await secureApi<unknown>('bonusWallet.updateTransferRequest', {
            userId: row.userId,
            _id: row._id,
            amount: row.amount,
            status: actionStatus,
            updatedBy: {
              name: admin?.name || '',
              _id: admin?._id || '',
              status: actionStatus,
            },
          });
          if (!res.ok) {
            setError(res.message || `Failed to ${actionStatus}`);
            return;
          }
          setSheetRow(null);
          void load();
          void loadSummary();
        } finally {
          setActingId('');
        }
      })();
    },
    [admin, load, loadSummary],
  );

  const handleAction = useCallback(
    (row: BonusRow, actionStatus: ActionStatus) => {
      Alert.alert(
        `${actionStatus[0].toUpperCase()}${actionStatus.slice(1)} request`,
        `${actionStatus} the request for ${display(row.name)} (${formatIN(row.amount)})?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: actionStatus,
            style: actionStatus === 'approve' ? 'default' : 'destructive',
            onPress: () => performAction(row, actionStatus),
          },
        ],
      );
    },
    [performAction],
  );

  // Fit main columns to phone width.
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 34;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);
  const w = {
    name: fit(3.5, 8),
    amount: fit(2.2, 8),
    status: fit(2.3, 8),
  };

  const columns = useMemo<DataTableColumn<BonusRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'User Name', width: w.name, render: (r) => display(r.name) },
      { key: 'transactionId', label: 'Transaction Id', width: 200, render: (r) => display(r._id) },
      { key: 'amount', label: 'Amount', width: w.amount, align: 'right', render: (r) => formatIN(r.amount) },
      { key: 'mobile', label: 'Mobile', width: 130, render: (r) => maskMobile(r.mobile, canShowMobile) },
      { key: 'status', label: 'Status', width: w.status, render: (r) => display(r.status) },
      { key: 'date', label: 'Date', width: 110, render: (r) => formatDisplayDate(r.updatedOn) || '—' },
      { key: 'time', label: 'Time', width: 100, render: (r) => formatDisplayTime(r.updatedOn) || '—' },
      {
        key: 'updatedBy',
        label: 'Updated By',
        width: 180,
        render: (r) =>
          r.updatedBy?.name ? `${display(r.status)} by ${display(r.updatedBy.name)}` : '—',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, canShowMobile, availableWidth],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(sheetRow, 0),
        multiline: c.key === 'transactionId' || c.key === 'updatedBy',
      }));
  }, [sheetRow, columns]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const pending = String(sheetRow.status || '').trim().toLowerCase() === 'pending';
    if (!pending) return [];
    const busy = Boolean(actingId);
    return (['approve', 'reject', 'remove'] as ActionStatus[]).map((a) => ({
      label: actingId === `${sheetRow._id}:${a}` ? '…' : a[0].toUpperCase() + a.slice(1),
      tone: a === 'approve' ? 'primary' : a === 'reject' ? 'warning' : 'default',
      disabled: busy,
      onPress: () => handleAction(sheetRow, a),
    }));
  }, [sheetRow, actingId, handleAction]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            void load();
            void loadSummary();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Bonus Wallet Requests</Text>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setAllData(false);
          setStartDate(draftStart);
          setEndDate(draftEnd);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={draftSearch}
        onSearchTextChange={setDraftSearch}
        onSearchSubmit={search}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Text style={styles.chipsLabel}>Status</Text>
        {STATUS_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s || 'all'}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
              {s || 'All'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, allData && styles.chipActive]}
          onPress={() => {
            setAllData((prev) => !prev);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, allData && styles.chipTextActive]}>All Data</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryText}>Approved: {summary.approvedCount}</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryText}>Wallet Balance: {formatIN(summary.walletBalance)}</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryText}>Pending: {summary.pendingCount}</Text>
        </View>
      </View>

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
        emptyMessage="No bonus wallet requests found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row for details and actions"
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  chipsRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'center', marginTop: spacing(3) },
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
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
  summaryChip: {
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  summaryText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
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
