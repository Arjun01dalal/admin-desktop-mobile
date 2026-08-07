/**
 * Deposit — card-based mobile page (desktop DepositPage /deposit).
 *
 * Lists deposit transactions (deposits.transactions, type 'deposit') as cards
 * instead of a table. Each card shows user name, amount, payment method,
 * mobile, app name and status, plus an Approve button for pending rows
 * (deposits.updateStatus → status 'Approved'). Tapping a card opens the full
 * detail sheet with every field.
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
} from 'react-native';
import { appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type DepositRow = {
  _id: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  mobile?: string;
  clientName?: string;
  amount?: number | string;
  status?: string;
  userState?: string;
  state?: string;
  userCity?: string;
  city?: string;
  userBankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  orderId?: string;
  orderKeyID?: string;
  paymentGatewayName?: string;
  paymentType?: string;
  mid?: string | number;
  createdOn?: string;
  updatedOn?: string;
  reason?: string;
  upiId?: string;
  userUpiId?: string;
  updatedBy?: { name?: string } | string;
};

const STATUS_OPTIONS = ['', 'Pending', 'Approved', 'Rejected'] as const;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatIN(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function statusBadge(status: unknown): string | undefined {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'success' || s === 'approved-clr') return '#16a34a';
  if (s === 'pending') return '#d97706';
  if (s === 'processing') return '#2563eb';
  if (s === 'failed' || s === 'rejected') return '#dc2626';
  return undefined;
}

function formatDateTime(value?: string | number): string {
  if (value == null || value === '') return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  return [d, t].filter(Boolean).join(' ') || '—';
}

export function DepositScreen() {
  const canShowMobile = hasPermission('show_mobile');
  // Read once — getSessionUser returns a fresh object each call.
  const admin = useMemo(
    () => getSessionUser() as { _id?: string; name?: string } | null,
    [],
  );

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [status, setStatus] = useState<string>('Pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [draftSearch, setDraftSearch] = useState('');
  const [searchField, setSearchField] = useState('userName');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'userName',
    text: '',
  });

  const [rows, setRows] = useState<DepositRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<DepositRow | null>(null);
  const [actingId, setActingId] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (status) filter.status = status;
      const text = applied.text.trim();
      if (text) filter[applied.field] = text;
      const payload: Record<string, unknown> = {
        type: 'deposit',
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      const res = await secureApi<unknown>('deposits.transactions', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load deposits');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<DepositRow>(res.data);
      setSheetRow(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [status, applied, page, pageSize, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyDates = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  }, [draftStart, draftEnd]);

  const search = useCallback(() => {
    setApplied({ field: searchField, text: draftSearch });
    setPage(1);
  }, [searchField, draftSearch]);

  const performApprove = useCallback(
    (row: DepositRow) => {
      if (!row.orderId) {
        setError('Missing order id');
        return;
      }
      void (async () => {
        setActingId(row.orderId || row._id);
        try {
          const res = await secureApi<unknown>('deposits.updateStatus', {
            transactionId: row.orderId,
            status: 'Approved',
            reason: '',
            updatedBy: { _id: admin?._id || '', name: admin?.name || '' },
          });
          if (!res.ok || res.success === false) {
            Alert.alert(res.message || 'Failed to approve');
            return;
          }
          Alert.alert(res.message || 'Deposit approved');
          setSheetRow(null);
          void load();
        } finally {
          setActingId('');
        }
      })();
    },
    [admin, load],
  );

  const confirmApprove = useCallback(
    (row: DepositRow) => {
      Alert.alert(
        'Approve deposit',
        `Approve ${display(row.userName)} — ₹${formatIN(row.amount)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve', onPress: () => performApprove(row) },
        ],
      );
    },
    [performApprove],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const r = sheetRow;
    return [
      { label: 'User Name', value: display(r.userName) },
      { label: 'Mobile', value: maskMobile(r.userMobile || r.mobile, canShowMobile) },
      { label: 'App', value: display(appCodeForName(r.clientName) || r.clientName) },
      { label: 'Amount', value: formatIN(r.amount) },
      { label: 'Payment Method', value: display(r.paymentGatewayName || r.paymentType) },
      { label: 'Status', value: display(r.status), badgeColor: statusBadge(r.status) },
      { label: 'Order Id', value: display(r.orderId), multiline: true },
      { label: 'Order Key ID', value: display(r.orderKeyID), multiline: true },
      { label: 'MID', value: display(r.mid) },
      { label: 'UPI Id', value: display(r.upiId || r.userUpiId), multiline: true },
      { label: 'Bank Name', value: display(r.userBankName) },
      { label: 'Account Number', value: display(r.accountNumber) },
      { label: 'IFSC', value: display(r.ifscCode) },
      { label: 'State', value: display(r.userState || r.state) },
      { label: 'City', value: display(r.userCity || r.city) },
      { label: 'Reason', value: display(r.reason), multiline: true },
      { label: 'Created', value: formatDateTime(r.createdOn) },
      { label: 'Updated', value: formatDateTime(r.updatedOn) },
      {
        label: 'Updated By',
        value: display(typeof r.updatedBy === 'string' ? r.updatedBy : r.updatedBy?.name),
      },
    ];
  }, [sheetRow, canShowMobile]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    if (String(sheetRow.status || '').toLowerCase() !== 'pending') return [];
    const busy = Boolean(actingId);
    return [
      {
        label: busy ? 'Approving…' : 'Approve',
        tone: 'primary',
        disabled: busy,
        onPress: () => confirmApprove(sheetRow),
      },
    ];
  }, [sheetRow, actingId, confirmApprove]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Deposit</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total: {total.toLocaleString('en-IN')}
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={applyDates}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        searchFields={[
          { key: 'userName', label: 'User Name' },
          { key: 'userMobile', label: 'Mobile' },
          { key: 'amount', label: 'Amount' },
          { key: 'orderId', label: 'Order Id' },
        ]}
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
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !rows.length ? (
        <Text style={styles.empty}>No deposits found</Text>
      ) : null}

      {rows.map((r, i) => {
        const pending = String(r.status || '').toLowerCase() === 'pending';
        const busy = actingId === (r.orderId || r._id);
        const badge = statusBadge(r.status);
        return (
          <TouchableOpacity
            key={r._id || r.orderId || String(i)}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSheetRow(r)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardName} numberOfLines={1}>
                {display(r.userName)}
              </Text>
              <View style={[styles.statusPill, badge ? { backgroundColor: badge } : null]}>
                <Text style={styles.statusPillText}>{display(r.status)}</Text>
              </View>
            </View>
            <Text style={styles.cardAmount}>₹ {formatIN(r.amount)}</Text>
            <View style={styles.cardGrid}>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Payment Method</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(r.paymentGatewayName || r.paymentType)}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>Mobile</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {maskMobile(r.userMobile || r.mobile, canShowMobile)}
                </Text>
              </View>
              <View style={styles.cardCell}>
                <Text style={styles.cardLabel}>App</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(appCodeForName(r.clientName) || r.clientName)}
                </Text>
              </View>
            </View>
            {pending ? (
              <TouchableOpacity
                style={[styles.approveBtn, busy && styles.approveBtnDisabled]}
                disabled={busy}
                onPress={() => confirmApprove(r)}
              >
                <Text style={styles.approveBtnText}>{busy ? 'Approving…' : 'Approve'}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.cardHint}>Tap for all details</Text>
          </TouchableOpacity>
        );
      })}

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
        title={sheetRow ? display(sheetRow.userName) : ''}
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
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructive,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 12 },
  empty: { color: colors.muted, fontSize: 13, marginTop: spacing(6), textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
    marginTop: spacing(3),
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardName: { color: colors.foreground, fontSize: 15, fontWeight: '700', flex: 1, marginRight: spacing(2) },
  statusPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  statusPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardAmount: { color: colors.foreground, fontSize: 18, fontWeight: '800', marginTop: spacing(1.5) },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(2.5) },
  cardCell: { minWidth: '28%', flexGrow: 1 },
  cardLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  cardValue: { color: colors.foreground, fontSize: 13, marginTop: 2 },
  approveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginTop: spacing(3),
  },
  approveBtnDisabled: { opacity: 0.5 },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(2), textAlign: 'center' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
    marginTop: spacing(4),
  },
  pagerBtn: { color: colors.primary, fontSize: 13, fontWeight: '700', padding: spacing(2) },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.foreground, fontSize: 12 },
});
