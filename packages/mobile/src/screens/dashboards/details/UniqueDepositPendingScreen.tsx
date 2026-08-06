/**
 * Unique Deposit Pending — port of desktop UniqueDepositPendingPage
 * (/unique_deposit_pending). Lists pending unique deposits (uniquePending.list)
 * with date filter, app-code chips, DP-id search, per-page chips and a pending
 * summary chip (uniquePending.fundRequest). Row tap opens the detail sheet with:
 *   - Comment: add a note (uniquePending.message) when the row has none yet,
 *   - WhatsApp: open a state-aware WhatsApp message to the user (whatsapp_icon),
 *   - Change Status: submit a remark (uniquePending.statusChange) (change_status).
 * The header "Download Data" runs the OTP flow (users.sendBlockOtp /
 * users.verifyBlockOtp + reports.sheetDownloadAuditCreate) gated by
 * show_download_botton; the actual CSV is exported via the share sheet.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { appCodeForName, asPaged, unpackPayload } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type UniquePendingRow = {
  _id: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  mobile?: string;
  orderId?: string;
  amount?: number | string;
  paymentGatewayName?: string;
  mid?: string | number;
  status?: string;
  createdOn?: string;
  clientName?: string;
  userState?: string;
  state?: string;
  userCity?: string;
  city?: string;
  transactionId?: string;
  uniquePendingReason?: { reason?: string; name?: string; _id?: string };
};

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const MAIN_KEYS = new Set(['idx', 'userName', 'amount', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatIN(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function paymentMethod(gw: unknown, mid: unknown): string {
  const g = gw === null || gw === undefined || gw === '' ? '' : String(gw);
  const m = mid != null && mid !== '' ? String(mid) : '';
  if (!g && !m) return '—';
  return m ? `${g} - ${m}` : g;
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  return lines.join('\r\n');
}

/** State-aware WhatsApp greeting (desktop parity). */
function whatsAppMessage(row: UniquePendingRow): string {
  const state = row.userState || row.state || '';
  const client = row.clientName || '';
  const template =
    state === 'Karnataka'
      ? `Hello {USER_NAME} Sir,\nWelcome to ${client} Games.\nನೀವು ಠೇವಣಿ ಮಾಡಲು ಪ್ರಯತ್ನಿಸುತ್ತಿರುವಿರಿ ಎಂದು ಕಾಣುತ್ತದೆ. ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?`
      : ['Telangana', 'Andhra Pradesh'].includes(state)
        ? `Hello {USER_NAME} Sir,\nWelcome to ${client} Games.\nమీరు డిపాజిట్ చేయడానికి ప్రయత్నిస్తున్నారని నేను చూస్తున్నాను. నేను ఈ రోజు మీకు ఎలా సహాయం చేయగలను?`
        : ['Tamil Nadu', 'Tiruchirappalli'].includes(state)
          ? `Hello {USER_NAME} Sir,\nWelcome to ${client} Games.\nநீங்கள் டெப்பாசிட் செய்ய முயற்சிக்கிறீர்கள் என்று பார்க்கிறேன். இன்று நான் உங்களுக்கு எப்படி உதவலாம்?`
          : `Hello {USER_NAME} Sir,\nWelcome to ${client} Games.\nI see you're trying to make a deposit. How can I assist you today?`;
  return template.replace('{USER_NAME}', (row.userName || '').split(' ')[0] || '');
}

export function UniqueDepositPendingScreen() {
  // Read once — getSessionUser returns a fresh object each call.
  const admin = useMemo(
    () => getSessionUser() as { _id?: string; name?: string; mobile?: string } | null,
    [],
  );
  const canChangeStatus = hasPermission('change_status');
  const canDownload = hasPermission('show_download_botton');
  const canWhatsApp = hasPermission('whatsapp_icon');

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [clientName, setClientName] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [rows, setRows] = useState<UniquePendingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [sheetRow, setSheetRow] = useState<UniquePendingRow | null>(null);
  const [busy, setBusy] = useState(false);
  const genRef = useRef(0);
  const summaryGenRef = useRef(0);

  // Remark/comment input modal.
  const [inputOpen, setInputOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'comment' | 'status'>('comment');
  const [inputRow, setInputRow] = useState<UniquePendingRow | null>(null);
  const [inputText, setInputText] = useState('');

  // OTP download modal.
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadOtp, setDownloadOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (clientName) filter.clientName = clientName;
      if (appliedSearch.trim()) filter.userId = appliedSearch.trim();
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemsPerPage: pageSize,
        filter,
      };
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      const res = await secureApi<unknown>('uniquePending.list', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load unique pending deposits');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<UniquePendingRow>(res.data);
      setSheetRow(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [clientName, appliedSearch, page, pageSize, startDate, endDate]);

  const loadSummary = useCallback(async () => {
    const gen = ++summaryGenRef.current;
    try {
      const res = await secureApi<unknown>('uniquePending.fundRequest', {
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== summaryGenRef.current) return;
      if (!res.ok) return;
      const body = unpackPayload(res.data);
      const detail =
        body.uniquePendingDetail && typeof body.uniquePendingDetail === 'object'
          ? (body.uniquePendingDetail as Record<string, unknown>)
          : body;
      setPendingCount(Number(detail.pendingCount) || 0);
      setPendingAmount(Number(detail.pendingAmount) || 0);
    } catch {
      /* ignore */
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const applyDates = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  }, [draftStart, draftEnd]);

  const search = useCallback(() => {
    setAppliedSearch(draftSearch);
    setPage(1);
  }, [draftSearch]);

  const openInput = useCallback((mode: 'comment' | 'status', row: UniquePendingRow) => {
    if (!row.orderId) {
      setError('Missing order id');
      return;
    }
    setInputMode(mode);
    setInputRow(row);
    setInputText('');
    setSheetRow(null);
    setInputOpen(true);
  }, []);

  const submitInput = useCallback(async () => {
    const row = inputRow;
    const reason = inputText.trim();
    if (!row?.orderId) return;
    if (!reason) {
      Alert.alert(inputMode === 'comment' ? 'Enter a comment' : 'Remark is required');
      return;
    }
    setBusy(true);
    try {
      const action = inputMode === 'comment' ? 'uniquePending.message' : 'uniquePending.statusChange';
      const res = await secureApi<unknown>(action, {
        orderId: row.orderId,
        uniquePendingReason: {
          name: admin?.name || '',
          _id: admin?._id || '',
          reason,
        },
      });
      if (!res.ok) {
        setError(res.message || 'Request failed');
        return;
      }
      setInputOpen(false);
      setInputRow(null);
      setInputText('');
      void load();
      if (inputMode === 'status') void loadSummary();
    } finally {
      setBusy(false);
    }
  }, [inputRow, inputText, inputMode, admin, load, loadSummary]);

  const openWhatsApp = useCallback((row: UniquePendingRow) => {
    const rawMobile = row.userMobile || row.mobile;
    if (!rawMobile) {
      Alert.alert('No mobile number for this user');
      return;
    }
    let formatted = String(rawMobile).replace(/\D/g, '');
    if (formatted.length === 10) formatted = `91${formatted}`;
    const encoded = encodeURIComponent(whatsAppMessage(row));
    const appUrl = `whatsapp://send?phone=${formatted}&text=${encoded}`;
    const webUrl = `https://wa.me/${formatted}?text=${encoded}`;
    void Linking.openURL(appUrl).catch(() => {
      void Linking.openURL(webUrl).catch(() => Alert.alert('Unable to open WhatsApp'));
    });
  }, []);

  const downloadCsv = useCallback(async () => {
    if (!rows.length) {
      setError('No data to export');
      return;
    }
    try {
      const csv = toCsv(rows as unknown as Record<string, unknown>[]);
      const fileUri = `${FileSystem.cacheDirectory}unique_pending_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Unique Pending Deposit',
        });
      } else {
        setError('Sharing is not available on this device');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export sheet');
    }
  }, [rows]);

  const sendDownloadOtp = useCallback(async () => {
    const mobile = admin?.mobile;
    if (!mobile) {
      Alert.alert('Admin mobile not found');
      return;
    }
    setOtpBusy(true);
    try {
      const res = await secureApi<unknown>('users.sendBlockOtp', { mobile });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to send OTP');
        return;
      }
      setOtpSent(true);
    } finally {
      setOtpBusy(false);
    }
  }, [admin?.mobile]);

  const verifyDownloadOtp = useCallback(async () => {
    const mobile = admin?.mobile;
    if (!mobile) {
      Alert.alert('Admin mobile not found');
      return;
    }
    const otp = downloadOtp.trim();
    if (otp.length !== 4) {
      Alert.alert('OTP must be 4 digits');
      return;
    }
    setOtpBusy(true);
    try {
      const verify = await secureApi<unknown>('users.verifyBlockOtp', {
        mobile,
        otp: Number.parseInt(otp, 10),
      });
      if (!verify.ok) {
        Alert.alert(verify.message || 'Invalid OTP');
        return;
      }
      // Fire-and-forget audit log (desktop parity).
      void secureApi<unknown>('reports.sheetDownloadAuditCreate', {
        downloadedBy: { name: admin?.name || '', userId: admin?._id || '' },
        filter: { mid: 'All', type: 'Unique Pending Deposit' },
      });
      setDownloadOpen(false);
      setDownloadOtp('');
      setOtpSent(false);
      await downloadCsv();
    } finally {
      setOtpBusy(false);
    }
  }, [admin, downloadOtp, downloadCsv]);

  // Fit main columns to phone width.
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 34;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);
  const w = { userName: fit(3.5, 8), amount: fit(2.2, 8), status: fit(2.3, 8) };

  const columns = useMemo<DataTableColumn<UniquePendingRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'userName', label: 'User Name', width: w.userName, render: (r) => display(r.userName) },
      { key: 'clientName', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'userId', label: 'DP ID', width: 180, render: (r) => display(r.userId) },
      { key: 'amount', label: 'Amount', width: w.amount, align: 'right', render: (r) => formatIN(r.amount) },
      { key: 'state', label: 'State', width: 130, render: (r) => display(r.userState || r.state) },
      { key: 'city', label: 'City', width: 120, render: (r) => display(r.userCity || r.city) },
      { key: 'orderId', label: 'Transaction Id', width: 200, render: (r) => display(r.orderId || r.transactionId) },
      { key: 'paymentMethod', label: 'Payment Method', width: 180, render: (r) => paymentMethod(r.paymentGatewayName, r.mid) },
      { key: 'date', label: 'Date', width: 110, render: (r) => formatDisplayDate(r.createdOn) || '—' },
      { key: 'time', label: 'Time', width: 100, render: (r) => formatDisplayTime(r.createdOn) || '—' },
      { key: 'status', label: 'Status', width: w.status, render: (r) => display(r.status) },
      { key: 'comment', label: 'Comment', width: 200, render: (r) => display(r.uniquePendingReason?.reason) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page, pageSize, availableWidth],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(sheetRow, 0),
        multiline: c.key === 'orderId' || c.key === 'comment',
      }));
  }, [sheetRow, columns]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const acts: SheetAction[] = [];
    const isPending = String(sheetRow.status || '').toLowerCase() === 'pending';
    if (!sheetRow.uniquePendingReason?.reason) {
      acts.push({ label: 'Add Comment', tone: 'default', onPress: () => openInput('comment', sheetRow) });
    }
    if (canWhatsApp && isPending) {
      acts.push({ label: 'WhatsApp', tone: 'primary', onPress: () => openWhatsApp(sheetRow) });
    }
    if (canChangeStatus) {
      acts.push({ label: 'Change Status', tone: 'warning', onPress: () => openInput('status', sheetRow) });
    }
    return acts;
  }, [sheetRow, canWhatsApp, canChangeStatus, openInput, openWhatsApp]);

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
      <Text style={styles.title}>Unique Deposit Pending User</Text>
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
        appClientName={clientName}
        onAppChange={(v) => {
          setClientName(v);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        searchFields={[{ key: 'userId', label: 'DP Id' }]}
        searchField="userId"
        onSearchFieldChange={() => {}}
        searchText={draftSearch}
        onSearchTextChange={setDraftSearch}
        onSearchSubmit={search}
      />

      <View style={styles.summaryRow}>
        <View style={styles.summaryChip}>
          <Text style={styles.summaryText}>
            Pending: ({pendingCount}) : {formatIN(pendingAmount)}
          </Text>
        </View>
        {canDownload ? (
          <TouchableOpacity
            style={styles.downloadChip}
            onPress={() => {
              setDownloadOtp('');
              setOtpSent(false);
              setDownloadOpen(true);
            }}
          >
            <Text style={styles.downloadChipText}>⬇ Download Data</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || r.orderId || i)}
        loading={loading}
        emptyMessage="No unique pending deposits found"
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
        title={sheetRow ? display(sheetRow.userName) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Comment / Change-status input modal */}
      <Modal
        visible={inputOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInputOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setInputOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {inputMode === 'comment' ? 'Add Comment' : 'Change Status'}
              </Text>
              <TouchableOpacity
                onPress={() => setInputOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>{inputMode === 'comment' ? 'Comment' : 'Remark'}</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={inputMode === 'comment' ? 'Enter comment' : 'Enter remark'}
              placeholderTextColor={colors.muted}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void submitInput()}
            >
              <Text style={styles.submitBtnText}>{busy ? 'Submitting…' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* OTP download modal */}
      <Modal
        visible={downloadOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDownloadOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setDownloadOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Verify OTP to Download
              </Text>
              <TouchableOpacity
                onPress={() => setDownloadOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>
              OTP will be sent to your registered mobile
              {admin?.mobile ? ` (${admin.mobile})` : ''}.
            </Text>
            {otpSent ? (
              <>
                <TextInput
                  style={styles.modalInput}
                  value={downloadOtp}
                  onChangeText={(v) => setDownloadOtp(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="Enter 4-digit OTP"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, otpBusy && styles.btnDisabled]}
                  disabled={otpBusy}
                  onPress={() => void verifyDownloadOtp()}
                >
                  <Text style={styles.submitBtnText}>{otpBusy ? 'Verifying…' : 'Verify & Download'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.submitBtn, otpBusy && styles.btnDisabled]}
                disabled={otpBusy}
                onPress={() => void sendDownloadOtp()}
              >
                <Text style={styles.submitBtnText}>{otpBusy ? 'Sending…' : 'Send OTP'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  summaryChip: {
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  summaryText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  downloadChip: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  downloadChipText: { color: colors.primaryForeground, fontSize: 12, fontWeight: '700' },
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(6),
    gap: spacing(2),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', flex: 1 },
  modalClose: { color: colors.muted, fontSize: 18, paddingHorizontal: spacing(2) },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  modalInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(3),
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
