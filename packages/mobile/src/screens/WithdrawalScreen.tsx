/**
 * Withdrawal — mobile port of desktop WithdrawalPage (route /withdrawal).
 *
 * Read-focused list view:
 *  - Summary chips (Approved / Pending / Rejected / Reverse / On Hold / Cancelled)
 *    from withdrawals.fundRequest — desktop parity.
 *  - List from withdrawals.transactions {type:'withdrawal'} with date range,
 *    status chips, search (userName/mobile/amount/transactionId/dp_id/accountNo)
 *    and pagination.
 *  - Phone: short cards via shared ResponsiveTable; tap a card → full details
 *    in the shared RowDetailSheet. Tablet: regular table.
 *
 * Skipped vs desktop (approval workflow): lock/unlock, check/cross-check,
 * status update, bulk actions, beneficiary dialogs — desktop-only for now.
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
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../api/client';
import { getSessionUser } from '../auth/permissions';
import { colors, radius, spacing } from '../theme';
import { type DataTableColumn } from '../dashboards/ui/DataTable';
import { ResponsiveTable } from '../dashboards/ui/ResponsiveTable';
import {
  DetailFilterBar,
  type SearchFieldOption,
} from './dashboards/details/DetailFilterBar';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../utils/dates';

type Rec = Record<string, unknown>;

const STATUSES = [
  '',
  'Pending',
  'IN PROGRESS',
  'Processing',
  'Approved',
  'Failed',
  'Cancel',
  'Rejected',
  'Reverse',
  'on hold',
] as const;

const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'userName', label: 'User Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'amount', label: 'Amount' },
  { key: 'transactionId', label: 'Transaction Id' },
  { key: 'dp_id', label: 'DP Id' },
  { key: 'accountNo', label: 'Account No' },
];

function display(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtAmount(v: unknown): string {
  return Math.floor(num(v)).toLocaleString('en-IN');
}

function unpack(data: unknown): Rec {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Rec;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Rec;
  }
  return obj;
}

function listOf(data: unknown): Rec[] {
  const obj = unpack(data);
  for (const k of ['items', 'transactions', 'list', 'docs']) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return Array.isArray(data) ? (data as Rec[]) : [];
}

function pagesOf(data: unknown): number {
  const obj = unpack(data);
  const total = num(obj.totalPages ?? obj.total_pages);
  if (total > 0) return total;
  const count = num(obj.total ?? obj.totalCount ?? obj.count);
  const per = num(obj.itemsPerPage ?? obj.perPage) || 10;
  return count > 0 ? Math.max(1, Math.ceil(count / per)) : 1;
}

/** Desktop asWithdrawalSummary parity: flat keys with nested-bucket fallback. */
type Summary = { label: string; count: number; amount: number }[];
function parseSummary(data: unknown): Summary {
  const payload = unpack(data);
  const src =
    payload.WithdrawalData && typeof payload.WithdrawalData === 'object'
      ? (payload.WithdrawalData as Rec)
      : payload;
  const bucket = (obj: unknown) => {
    const b = (obj && typeof obj === 'object' ? obj : {}) as Rec;
    return { count: num(b.count), amount: num(b.totalAmount) };
  };
  const approved = bucket(src.totalApprovedWithdrawalData);
  const pending = bucket(src.totalPendingWithdrawalData);
  const rejected = bucket(src.totalWithdrawalRejected);
  const reverse = bucket(src.totalReverseWithdrawalData);
  const onhold = bucket(src.totalOnholdWithdrawalData);
  return [
    {
      label: 'Approved',
      count: num(src.totalApprovedCount ?? approved.count),
      amount: num(src.totalApprovedAmount ?? approved.amount),
    },
    {
      label: 'Pending',
      count: num(src.totalPendingCount ?? pending.count),
      amount: num(src.totalPendingAmount ?? pending.amount),
    },
    {
      label: 'Rejected',
      count: num(src.totalRejectedCount ?? rejected.count),
      amount: num(src.totalRejectedAmount ?? rejected.amount),
    },
    {
      label: 'Reverse',
      count: num(src.totalReversedCount ?? reverse.count),
      amount: num(src.totalReversedAmount ?? reverse.amount),
    },
    {
      label: 'On Hold',
      count: num(src.totalOnholdCount ?? onhold.count),
      amount: num(src.totalOnholdAmount ?? onhold.amount),
    },
    {
      label: 'Cancelled',
      count: num(src.totalCanceledCount),
      amount: num(src.totalCanceledAmount),
    },
  ];
}

function statusColor(s: unknown): string | undefined {
  const v = String(s || '').toLowerCase();
  if (v === 'approved' || v === 'manual approved') return colors.success;
  if (v === 'rejected' || v === 'failed' || v === 'cancel') return colors.destructive;
  if (v === 'pending' || v === 'in progress' || v === 'processing') return '#f5b942';
  return undefined;
}

export function WithdrawalScreen() {
  // Fresh object per call — read once (infinite-reload guard).
  const admin = useMemo(
    () => getSessionUser() as { clientName?: string; allotedApps?: string } | null,
    [],
  );

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState('userName');
  const [searchDraft, setSearchDraft] = useState('');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'userName',
    text: '',
  });

  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary>([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const filter: Rec = {};
      if (status) filter.status = status;
      if (applied.text.trim()) filter[applied.field] = applied.text.trim();
      const payload: Rec = {
        type: 'withdrawal',
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
        startDate,
        endDate,
      };
      const app = admin?.clientName || admin?.allotedApps;
      if (app) payload.app = app;
      const res = await secureApi('withdrawals.transactions', payload);
      if (!res.ok) {
        setMsg(res.message || 'Failed to load withdrawals');
        setRows([]);
        setTotalPages(1);
        return;
      }
      setRows(listOf(res.data));
      setTotalPages(pagesOf(res.data));
    } finally {
      setLoading(false);
    }
  }, [admin, status, applied, pageSize, page, startDate, endDate]);

  const loadSummary = useCallback(async () => {
    const res = await secureApi('withdrawals.fundRequest', { startDate, endDate });
    if (res.ok) setSummary(parseSummary(res.data));
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      {
        key: 'name',
        label: 'User Name',
        width: 130,
        render: (r) => display(r.accountHolderName ?? r.userName ?? r.name),
      },
      {
        key: 'amount',
        label: 'Amount',
        width: 90,
        render: (r) => fmtAmount(r.amount ?? r.Amount),
      },
      {
        key: 'status',
        label: 'Status',
        width: 100,
        color: (r) => statusColor(r.status),
        render: (r) => display(r.status),
      },
      {
        key: 'app',
        label: 'App',
        width: 80,
        render: (r) => display(appCodeForName(String(r.clientName || '')) || r.clientName),
      },
      { key: 'mobile', label: 'Mobile', width: 110, render: (r) => display(r.userMobile ?? r.mobile) },
      { key: 'state', label: 'State', width: 100, render: (r) => display(r.state) },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      {
        key: 'bank',
        label: 'User Bank',
        width: 120,
        render: (r) => display(r.userBankName ?? r.bankName),
      },
      { key: 'winIn', label: 'Win In', width: 80, render: (r) => display(r.playedGames) },
      {
        key: 'txn',
        label: 'Transaction Id',
        width: 150,
        render: (r) => display(r.orderId ?? r.transactionId),
      },
      { key: 'dp', label: 'DP Id', width: 120, render: (r) => display(r.dp_id) },
      { key: 'accountNo', label: 'Account No', width: 130, render: (r) => display(r.accountNo) },
      { key: 'ifsc', label: 'IFSC', width: 110, render: (r) => display(r.ifscCode ?? r.ifsc) },
      {
        key: 'commission',
        label: 'Commission',
        width: 90,
        render: (r) => fmtAmount(r.commissionAmount),
      },
      {
        key: 'provider',
        label: 'Provider',
        width: 120,
        render: (r) => display(r.withdrewalProviderName ?? r.paymentGatewayName),
      },
      { key: 'mid', label: 'MID', width: 100, render: (r) => display(r.mid) },
      {
        key: 'lockBy',
        label: 'Lock By',
        width: 110,
        render: (r) => {
          const l = r.lockBy as Rec | undefined;
          return l && typeof l === 'object' ? display(l.name) : display(l);
        },
      },
      {
        key: 'updatedBy',
        label: 'Updated By',
        width: 130,
        render: (r) => {
          const a = r.action as Rec | undefined;
          return a && typeof a === 'object'
            ? `${display(a.status)} · ${display(a.name)}`
            : display(a);
        },
      },
      {
        key: 'pnlBefore',
        label: 'PnL Before',
        width: 100,
        render: (r) => display(r.pnl),
      },
      {
        key: 'pnlAfter',
        label: 'PnL After',
        width: 100,
        render: (r) => display(r.afterWithdrawalPnl),
      },
      {
        key: 'date',
        label: 'Date',
        width: 100,
        render: (r) => (r.createdOn ? formatDisplayDate(String(r.createdOn)) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayTime(String(r.createdOn)) : '—'),
      },
    ],
    [],
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
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
      <Text style={styles.title}>Withdrawal</Text>

      {/* Summary chips (desktop parity, not clickable) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryRow}>
        {summary.map((s) => (
          <View key={s.label} style={styles.summaryChip}>
            <Text style={styles.summaryChipLabel}>{s.label}</Text>
            <Text style={styles.summaryChipValue}>
              {s.count} · ₹{fmtAmount(s.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>

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
        pageSize={pageSize}
        onPageSizeChange={(v) => {
          setPageSize(v);
          setPage(1);
        }}
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setApplied({ field: searchField, text: searchDraft });
          setPage(1);
        }}
      />

      {/* Status filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow}>
        {STATUSES.map((s) => (
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
      </ScrollView>

      {msg ? <Text style={styles.muted}>{msg}</Text> : null}

      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? r.transactionId ?? i)}
        loading={loading}
        emptyMessage="No withdrawals"
        hint="Tap a card to see all details"
      />

      {/* Pager */}
      <View style={styles.pagerRow}>
        <TouchableOpacity
          style={[styles.pagerBtn, (page <= 1 || loading) && styles.pagerBtnDisabled]}
          disabled={page <= 1 || loading}
          onPress={() => setPage((p) => Math.max(1, p - 1))}
        >
          <Text style={styles.pagerBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pagerText}>
          Page {page} / {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pagerBtn, (page >= totalPages || loading) && styles.pagerBtnDisabled]}
          disabled={page >= totalPages || loading}
          onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <Text style={styles.pagerBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing(3),
  },
  summaryRow: { marginBottom: spacing(3) },
  summaryChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
  },
  summaryChipLabel: { color: colors.muted, fontSize: 11 },
  summaryChipValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  statusRow: { marginBottom: spacing(3) },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    marginRight: spacing(2),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12 },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 12, marginBottom: spacing(2) },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    marginTop: spacing(3),
  },
  pagerBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 13 },
  pagerText: { color: colors.muted, fontSize: 13 },
});
