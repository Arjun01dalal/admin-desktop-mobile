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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { pickPageSizes, appCodeForName, asPaged, unpackPayload } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { buildBotDialoutSetting } from '../../../utils/dialerHelpers';
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

const PAGE_SIZE_OPTIONS = pickPageSizes([25, 50, 100, 200]);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === null || value === undefined || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function rowMobile(row: UniquePendingRow): string {
  return String(row.userMobile || row.mobile || '').trim();
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

function statusBadge(status: unknown): string | undefined {
  const s = String(status || '').toLowerCase();
  if (s === 'approve' || s === 'approved' || s === 'success') return '#16a34a';
  if (s === 'pending') return '#d97706';
  if (s === 'failed' || s === 'reject' || s === 'rejected') return '#dc2626';
  return undefined;
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
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  // Read once — getSessionUser returns a fresh object each call.
  const admin = useMemo(
    () => getSessionUser() as { _id?: string; name?: string; mobile?: string } | null,
    [],
  );
  const canChangeStatus = hasPermission('change_status');
  const canDownload = hasPermission('show_download_botton');
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canShowMobile = hasPermission('show_mobile');

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [clientName, setClientName] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [searchField, setSearchField] = useState('userId');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'userId',
    text: '',
  });

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
      const text = applied.text.trim();
      if (text) filter[applied.field] = text;
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
  }, [clientName, applied, page, pageSize, startDate, endDate]);

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
    setApplied({ field: searchField, text: draftSearch });
    setPage(1);
  }, [searchField, draftSearch]);

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

  /** Manual Call — open the phone dialer (mobile adaptation of desktop's external dialer). */
  const openDialer = useCallback((row: UniquePendingRow) => {
    const rawMobile = row.userMobile || row.mobile;
    if (!rawMobile) {
      Alert.alert('No mobile number for this user');
      return;
    }
    void Linking.openURL(`tel:${String(rawMobile).replace(/\D/g, '')}`).catch(() =>
      Alert.alert('Unable to open the dialer'),
    );
  }, []);

  /** Bot Call — SubAdmin/add-to-dialer (desktop CallingBtn initiateBotCall parity). */
  const initiateBotCall = useCallback(
    (row: UniquePendingRow) => {
      const mobile = String(row.userMobile || row.mobile || '');
      if (!mobile) {
        Alert.alert('No mobile number for this user');
        return;
      }
      void (async () => {
        setBusy(true);
        try {
          const res = await secureApi<unknown>('callLogs.addToBotDialer', {
            userId: admin?._id,
            created_by: admin?.name,
            dialout_settings: [
              buildBotDialoutSetting(
                {
                  ...row,
                  _id: row._id || row.userId,
                  name: row.userName,
                },
                1,
                'Unique Pending Deposit',
              ),
            ],
          });
          if (!res.ok || res.success === false) {
            Alert.alert(res.message || 'Bot call failed');
            return;
          }
          Alert.alert(res.message || 'Call Initiated.');
        } finally {
          setBusy(false);
        }
      })();
    },
    [admin],
  );

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

  const openUserReport = useCallback(
    (row: UniquePendingRow) => {
      if (!row.userId) return;
      setSheetRow(null);
      navigation.navigate('/user-report', {
        userId: String(row.userId),
        userName: String(row.userName || ''),
      });
    },
    [navigation],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return [
      { label: 'User Name', value: display(sheetRow.userName) },
      { label: 'Mobile No', value: maskMobile(rowMobile(sheetRow), canShowMobile) },
      { label: 'App Code', value: appCodeForName(sheetRow.clientName) },
      { label: 'DP ID', value: display(sheetRow.userId) },
      { label: 'Amount', value: formatIN(sheetRow.amount) },
      { label: 'State', value: display(sheetRow.userState || sheetRow.state) },
      { label: 'City', value: display(sheetRow.userCity || sheetRow.city) },
      {
        label: 'Transaction Id',
        value: display(sheetRow.orderId || sheetRow.transactionId),
        multiline: true,
      },
      {
        label: 'Payment Method',
        value: paymentMethod(sheetRow.paymentGatewayName, sheetRow.mid),
      },
      { label: 'Date', value: formatDisplayDate(sheetRow.createdOn) || '—' },
      { label: 'Time', value: formatDisplayTime(sheetRow.createdOn) || '—' },
      {
        label: 'Status',
        value: display(sheetRow.status),
        badgeColor: statusBadge(sheetRow.status),
      },
      {
        label: 'Comment',
        value: display(sheetRow.uniquePendingReason?.reason),
        multiline: true,
      },
    ];
  }, [sheetRow, canShowMobile]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const acts: SheetAction[] = [];
    if (sheetRow.userId) {
      acts.push({
        label: 'User Report',
        tone: 'primary',
        onPress: () => openUserReport(sheetRow),
      });
    }
    const isPending = String(sheetRow.status || '').toLowerCase() === 'pending';
    if (!sheetRow.uniquePendingReason?.reason) {
      acts.push({ label: 'Add Comment', tone: 'default', onPress: () => openInput('comment', sheetRow) });
    }
    if (canWhatsApp && isPending) {
      acts.push({ label: 'WhatsApp', tone: 'primary', onPress: () => openWhatsApp(sheetRow) });
    }
    const hasMobile = Boolean(sheetRow.userMobile || sheetRow.mobile);
    acts.push({
      label: 'Call',
      tone: 'default',
      disabled: !hasMobile || busy,
      onPress: () => openDialer(sheetRow),
    });
    acts.push({
      label: busy ? 'Calling…' : 'Bot Call',
      tone: 'primary',
      disabled: !hasMobile || busy,
      onPress: () => initiateBotCall(sheetRow),
    });
    if (canChangeStatus) {
      acts.push({ label: 'Change Status', tone: 'warning', onPress: () => openInput('status', sheetRow) });
    }
    return acts;
  }, [
    sheetRow,
    canWhatsApp,
    canChangeStatus,
    busy,
    openInput,
    openWhatsApp,
    openDialer,
    initiateBotCall,
    openUserReport,
  ]);

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
        searchFields={[
          { key: 'userId', label: 'DP Id' },
          { key: 'amount', label: 'Amount' },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
        ]}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
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

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No unique pending deposits found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const badge = statusBadge(row.status);
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id || row.orderId || '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.userName)}
                </Text>
                {row.userId ? (
                  <TouchableOpacity
                    style={styles.reportBtn}
                    onPress={() => openUserReport(row)}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text style={styles.reportBtnText}>User Report</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Mobile</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {maskMobile(rowMobile(row), canShowMobile)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Amount</Text>
                <Text style={styles.cardValue}>{formatIN(row.amount)}</Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  App Code: {appCodeForName(row.clientName)}
                </Text>
                <Text
                  style={[styles.cardSplitRight, badge ? { color: badge } : null]}
                  numberOfLines={1}
                >
                  Status: {display(row.status)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>DP ID</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.userId)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Date</Text>
                <Text style={styles.cardValue}>
                  {[formatDisplayDate(row.createdOn), formatDisplayTime(row.createdOn)]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details & actions</Text>
            </TouchableOpacity>
          );
        })}
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
  screen: { flex: 1, backgroundColor: 'transparent' },
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
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(3) },
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
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
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: { color: colors.foreground, fontSize: 11, fontWeight: '600', flex: 1, textAlign: 'right' },
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
