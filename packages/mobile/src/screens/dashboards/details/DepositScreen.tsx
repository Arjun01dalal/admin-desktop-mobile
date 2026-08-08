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
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { appCodeForName, asList, asPaged, unpackPayload } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import * as ImagePicker from 'expo-image-picker';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { SlipOcrWebView, extractUtrFromText } from './utrOcr';

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
  oldMultipleNames?: string[];
};

// --- Manual settle helpers (desktop deposit/logic.ts parity) ---
const UPI_GATEWAYS = new Set(['upi-payment', 'IMPS', 'NEFT']);
const SETTLE_REASONS = [
  'deposit-uco-trpl',
  'Deposit Failure',
  'instant-deposit-manual',
  'deposit-upi-id',
  'deposit-sapt-rishi',
  'deposit-manual',
];

function defaultSettleReason(row: DepositRow): string {
  const gateway = String(row.paymentGatewayName || '').replace(/\t/g, '');
  if (String(row.status || '').toLowerCase() === 'pending') {
    if (String(row.paymentType || '') === 'instant-deposit-manual') return 'instant-deposit-manual';
    return gateway ? `manual-deposit-${gateway}` : 'deposit-manual';
  }
  return 'deposit-manual';
}

function settleReasonOptions(row: DepositRow): string[] {
  const gateway = String(row.paymentGatewayName || '').replace(/\t/g, '');
  const dynamic = gateway ? `manual-deposit-${gateway}` : '';
  if (dynamic && !SETTLE_REASONS.includes(dynamic)) return [dynamic, ...SETTLE_REASONS];
  return [...SETTLE_REASONS];
}

function isUpiGateway(gateway?: string): boolean {
  return UPI_GATEWAYS.has(String(gateway || ''));
}

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
  const genRef = useRef(0);

  // Manual settle modal state
  const [settleRow, setSettleRow] = useState<DepositRow | null>(null);
  const [mids, setMids] = useState<string[]>([]);
  const [sAmount, setSAmount] = useState('');
  const [sReason, setSReason] = useState('');
  const [sMid, setSMid] = useState('');
  const [sGateway, setSGateway] = useState('');
  const [sDate, setSDate] = useState(todayIST);
  const [sUtr, setSUtr] = useState('');
  const [saving, setSaving] = useState(false);
  const [ocrImage, setOcrImage] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const settleRowRef = useRef<DepositRow | null>(null);
  useEffect(() => {
    settleRowRef.current = settleRow;
  }, [settleRow]);

  const closeSettle = useCallback(() => {
    setOcrImage(null);
    setOcrBusy(false);
    setSettleRow(null);
  }, []);

  // Secondary user name modal state
  const [secRow, setSecRow] = useState<DepositRow | null>(null);
  const [secName, setSecName] = useState('');
  const [secSaving, setSecSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await secureApi<unknown>('deposits.mids', {});
      if (!res.ok) return;
      const body = unpackPayload(res.data) as { items?: unknown };
      const list = Array.isArray(res.data)
        ? (res.data as { mid?: string | number }[])
        : Array.isArray(body.items)
          ? (body.items as { mid?: string | number }[])
          : asList<{ mid?: string | number }>(res.data);
      setMids(
        list
          .filter((m) => m && m.mid != null && m.mid !== '')
          .map((m) => String(m.mid)),
      );
    })();
  }, []);

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

  // Approve → open Manual Settle modal (desktop SettleDialog parity, simplified).
  const openSettle = useCallback((row: DepositRow) => {
    setSheetRow(null);
    setSAmount(String(row.amount ?? ''));
    setSReason(defaultSettleReason(row));
    setSMid(row.mid != null ? String(row.mid) : '');
    setSGateway(row.paymentGatewayName || '');
    setSDate(todayIST());
    setSUtr('');
    setOcrImage(null);
    setOcrBusy(false);
    setSettleRow(row);
  }, []);

  const submitSettle = useCallback((utrOverride?: string) => {
    const row = settleRow;
    if (!row?.orderId || !row.userId) {
      Alert.alert('Missing order / user');
      return;
    }
    const utrValue = (utrOverride ?? sUtr).trim();
    if (!utrValue) {
      Alert.alert('Please enter UTR No');
      return;
    }
    if (utrValue.length <= 10) {
      Alert.alert('UTR No length should be more than 10 characters');
      return;
    }
    if (!sReason.trim()) {
      Alert.alert('Select reason');
      return;
    }
    void (async () => {
      setSaving(true);
      try {
        if (sGateway && sGateway !== row.paymentGatewayName) {
          const gwRes = await secureApi<unknown>('deposits.updateGatewayName', {
            _id: row._id,
            paymentGatewayName: sGateway,
          });
          if (!gwRes.ok || gwRes.success === false) {
            Alert.alert(gwRes.message || 'Failed to update payment gateway name');
            return;
          }
        }
        const payload: Record<string, unknown> = {
          userId: row.userId,
          balance: Number(sAmount) || row.amount,
          updatedBy: { name: admin?.name || '', _id: admin?._id || '' },
          reason: sReason.trim(),
          remark: `Deposite failure of ${row.userName || ''} through ${sGateway || row.paymentGatewayName || ''} pay with order id ${row.orderId} and mobile no ${row.userMobile || row.mobile || ''}`,
          tag: 'credit',
          orderId: row.orderId,
          mid: sMid || row.mid,
          paymentDate: sDate,
          utr: utrValue,
        };
        if (sReason.startsWith('manual-deposit-')) {
          payload.type = 'paymentGatewayManualDeposit';
        }
        const action = isUpiGateway(row.paymentGatewayName)
          ? 'upiPayments.addCoin'
          : 'deposits.addCoin';
        const res = await secureApi<unknown>(action, payload);
        if (!res.ok || res.success === false) {
          Alert.alert(res.message || 'Settle failed');
          return;
        }
        Alert.alert(res.message || 'Settled successfully');
        setSettleRow(null);
        void load();
      } finally {
        setSaving(false);
      }
    })();
  }, [settleRow, sUtr, sReason, sGateway, sAmount, sMid, sDate, admin, load]);

  // Upload slip photo → OCR (WebView tesseract) → extract UTR → auto submit.
  const pickSlip = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    const base64 = result.assets[0].base64;
    if (!base64) {
      Alert.alert('Could not read the selected photo');
      return;
    }
    setOcrBusy(true);
    setOcrImage(base64);
  }, []);

  const onOcrText = useCallback(
    (text: string) => {
      setOcrImage(null);
      setOcrBusy(false);
      const row = settleRow;
      if (!row) return; // modal closed while OCR was running — discard
      const utr = extractUtrFromText(text);
      if (!utr) {
        Alert.alert('Could not read UTR from slip. Please enter manually.');
        return;
      }
      setSUtr(utr);
      Alert.alert('UTR read from slip', utr, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: () => {
            // Guard against the modal switching rows after the alert opened.
            if (settleRowRef.current?.orderId === row.orderId) submitSettle(utr);
          },
        },
      ]);
    },
    [settleRow, submitSettle],
  );

  const onOcrError = useCallback((message: string) => {
    setOcrImage(null);
    setOcrBusy(false);
    Alert.alert(message || 'Failed to read UTR from slip');
  }, []);

  // Secondary user name (desktop SecondaryNameCell parity).
  const submitSecondary = useCallback(() => {
    const row = secRow;
    const trimmed = secName.trim();
    if (!row || !trimmed) return;
    const names = Array.isArray(row.oldMultipleNames) ? row.oldMultipleNames : [];
    if (names.some((n) => n?.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert(`"${trimmed}" already exists in the list!`);
      return;
    }
    void (async () => {
      setSecSaving(true);
      try {
        const res = await secureApi<unknown>('deposits.updateUserOldName', {
          userId: row.userId,
          name: trimmed,
          transactionId: row.orderId,
        });
        if (!res.ok || res.success === false) {
          Alert.alert(res.message || 'Failed to add secondary name');
          return;
        }
        Alert.alert('Secondary user name added successfully!');
        setSecRow(null);
        setSecName('');
        void load();
      } finally {
        setSecSaving(false);
      }
    })();
  }, [secRow, secName, load]);

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
      {
        label: 'Secondary Names',
        value: Array.isArray(r.oldMultipleNames) && r.oldMultipleNames.length
          ? r.oldMultipleNames.join(', ')
          : '—',
        multiline: true,
      },
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
    return [
      {
        label: 'Approve (Manual Settle)',
        tone: 'primary',
        onPress: () => openSettle(sheetRow),
      },
      {
        label: 'Add Secondary Name',
        tone: 'default',
        onPress: () => {
          setSheetRow(null);
          setSecName('');
          setSecRow(sheetRow);
        },
      },
    ];
  }, [sheetRow, openSettle]);

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
              <View style={styles.cardBtnRow}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => openSettle(r)}>
                  <Text style={styles.approveBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setSecName('');
                    setSecRow(r);
                  }}
                >
                  <Text style={styles.secondaryBtnText}>+ Secondary Name</Text>
                </TouchableOpacity>
              </View>
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

      {/* Manual Settle modal */}
      <Modal
        visible={settleRow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && closeSettle()}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Manual Settle Transaction</Text>
              <Text style={styles.modalSub}>
                {display(settleRow?.userName)} · {display(settleRow?.orderId)}
              </Text>

              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                value={sAmount}
                onChangeText={setSAmount}
                keyboardType="numeric"
                placeholder="Amount"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.fieldLabel}>Reason</Text>
              <View style={styles.optionWrap}>
                {(settleRow ? settleReasonOptions(settleRow) : []).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.optionChip, sReason === r && styles.optionChipActive]}
                    onPress={() => setSReason(r)}
                  >
                    <Text
                      style={[styles.optionChipText, sReason === r && styles.optionChipTextActive]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>MID</Text>
              {mids.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionRow}>
                    {mids.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.optionChip, sMid === m && styles.optionChipActive]}
                        onPress={() => setSMid(m)}
                      >
                        <Text
                          style={[styles.optionChipText, sMid === m && styles.optionChipTextActive]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <TextInput
                  style={styles.input}
                  value={sMid}
                  onChangeText={setSMid}
                  placeholder="MID"
                  placeholderTextColor={colors.muted}
                />
              )}

              <Text style={styles.fieldLabel}>Payment Gateway</Text>
              <TextInput
                style={styles.input}
                value={sGateway}
                onChangeText={setSGateway}
                placeholder="Payment gateway"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.fieldLabel}>Payment Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={sDate}
                onChangeText={setSDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />

              <Text style={styles.fieldLabel}>UTR No</Text>
              <TouchableOpacity
                style={[styles.uploadBtn, ocrBusy && styles.btnDisabled]}
                disabled={ocrBusy || saving}
                onPress={() => void pickSlip()}
              >
                <Text style={styles.uploadBtnText}>
                  {ocrBusy ? 'Reading slip…' : '📷 Upload Slip (auto-read UTR)'}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={sUtr}
                onChangeText={setSUtr}
                placeholder="UTR will appear here after upload"
                placeholderTextColor={colors.muted}
              />
              {ocrImage ? (
                <SlipOcrWebView imageBase64={ocrImage} onText={onOcrText} onError={onOcrError} />
              ) : null}

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  disabled={saving}
                  onPress={closeSettle}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.approveBtn, styles.modalSubmitBtn, saving && styles.btnDisabled]}
                  disabled={saving}
                  onPress={() => submitSettle()}
                >
                  <Text style={styles.approveBtnText}>{saving ? 'Settling…' : 'Settle'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Secondary Name modal */}
      <Modal
        visible={secRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !secSaving && setSecRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Secondary Name</Text>
            <Text style={styles.modalSub}>
              {display(secRow?.userName)} · {display(secRow?.orderId)}
            </Text>
            {Array.isArray(secRow?.oldMultipleNames) && secRow.oldMultipleNames.length ? (
              <Text style={styles.modalNote}>
                Existing: {secRow.oldMultipleNames.join(', ')}
              </Text>
            ) : null}
            <Text style={styles.fieldLabel}>Secondary user name</Text>
            <TextInput
              style={styles.input}
              value={secName}
              onChangeText={setSecName}
              placeholder="Secondary name"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={secSaving}
                onPress={() => setSecRow(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.approveBtn,
                  styles.modalSubmitBtn,
                  (secSaving || !secName.trim()) && styles.btnDisabled,
                ]}
                disabled={secSaving || !secName.trim()}
                onPress={submitSecondary}
              >
                <Text style={styles.approveBtnText}>{secSaving ? 'Adding…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
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
  cardBtnRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  approveBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    flex: 1,
  },
  approveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    flex: 1,
  },
  secondaryBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    maxHeight: '88%',
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  modalSub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  modalNote: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: spacing(3),
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 13,
    marginTop: spacing(1.5),
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(1.5),
  },
  optionRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1.5) },
  optionChip: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  optionChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionChipText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  optionChipTextActive: { color: colors.primaryForeground },
  uploadBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginTop: spacing(1.5),
  },
  uploadBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  modalBtnRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(4) },
  cancelBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    flex: 1,
  },
  cancelBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  modalSubmitBtn: { flex: 1 },
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
