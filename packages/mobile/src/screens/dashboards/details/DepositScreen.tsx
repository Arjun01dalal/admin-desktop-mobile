/**
 * Deposit — card-based mobile page (desktop DepositPage /deposit).
 *
 * Lists deposit transactions (deposits.transactions, type 'deposit') as cards
 * instead of a table. Each card shows user name, amount, payment method,
 * mobile, app name and status, plus an Approve button for pending rows
 * (deposits.updateStatus → status 'Approved'). Pending rows with
 * whatsapp_icon show WhatsApp / Telegram buttons inside the detail sheet
 * (Laxmi parity). Tapping a card opens the full detail sheet with every field.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  appCodeForName,
  asPaged,
  buildDepositWhatsAppMessage,
  canEditDeposit,
  canShowCheckAction,
  defaultSettleReason,
  isUpiGateway,
  settleReasonOptions,
  parseDistinctMidOptions,
  sanitizeGtelPhone,
} from '@astro/shared';
import { colors } from '../../../theme';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import {
  canShowGtelC2c,
  GtelClick2CallModal,
  type GtelC2cTarget,
} from '../../../components/GtelClick2CallModal';
import { GtelC2cCallButton } from '../../../components/GtelC2cCallButton';
import { DateField } from '../../../components/DateField';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { display, maskMobile } from '../../../utils/display';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '../../../utils/empCodeNameCache';
import * as ImagePicker from 'expo-image-picker';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { SlipOcrWebView, extractUtrFromText } from './utrOcr';
import { styles } from './DepositScreen.styles';

type CheckPerson = { name?: string; city?: string; state?: string; date?: string };

type DepositRow = {
  _id: string;
  userId?: string;
  userName?: string;
  empCode?: string;
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
  checkBy?: CheckPerson;
  crossCheckBy?: CheckPerson;
};

function formatCheckPerson(p?: CheckPerson): string {
  if (!p?.name) return '—';
  const bits = [p.name, p.city, p.state].filter(Boolean);
  const when = p.date ? `${formatDisplayDate(p.date)} ${formatDisplayTime(p.date)}`.trim() : '';
  return when ? `${bits.join(' · ')} · ${when}` : bits.join(' · ') || '—';
}

const STATUS_OPTIONS = ['', 'Pending', 'Approved', 'Rejected'] as const;

function formatIN(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
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

function formatPhone(raw?: string): string {
  let n = String(raw || '').replace(/\D/g, '');
  if (n.length === 10) n = `91${n}`;
  return n;
}

async function openWhatsApp(row: DepositRow): Promise<void> {
  const raw = row.userMobile || row.mobile;
  if (!raw) {
    Alert.alert('No mobile number for this user');
    return;
  }
  const formatted = formatPhone(raw);
  const encoded = encodeURIComponent(buildDepositWhatsAppMessage(row));
  const appUrl = `whatsapp://send?phone=${formatted}&text=${encoded}`;
  const webUrl = `https://wa.me/${formatted}?text=${encoded}`;
  try {
    await Linking.openURL(appUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('Unable to open WhatsApp');
    }
  }
}

async function openTelegram(row: DepositRow): Promise<void> {
  const raw = row.userMobile || row.mobile;
  if (!raw) {
    Alert.alert('No mobile number for this user');
    return;
  }
  const formatted = formatPhone(raw);
  const appUrl = `tg://resolve?phone=${formatted}`;
  const webUrl = `https://t.me/+${formatted}`;
  try {
    await Linking.openURL(appUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert('Unable to open Telegram');
    }
  }
}

export function DepositScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const canShowMobile = hasPermission('show_mobile');
  const canWhatsApp = hasPermission('whatsapp_icon');
  const canPencil = hasPermission('Deposit_Pensil');
  // Read once — getSessionUser returns a fresh object each call.
  const admin = useMemo(() => getSessionUser() as { _id?: string; name?: string } | null, []);
  const canShowC2c = canShowGtelC2c(admin);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);

  const openC2cCall = useCallback((row: DepositRow) => {
    const mobile = String(row.userMobile || row.mobile || '');
    if (!sanitizeGtelPhone(mobile)) return;
    setC2cTarget({
      phoneNumber: mobile,
      userId: String(row.userId || row._id || ''),
      userName: String(row.userName || ''),
      appName: String(row.clientName || ''),
      source: 'Manual',
    });
  }, []);

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [allData, setAllData] = useState(false);
  const [midPickerOpen, setMidPickerOpen] = useState(false);
  const [midPickerQuery, setMidPickerQuery] = useState('');
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
  const [checkingId, setCheckingId] = useState('');
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
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  useEffect(() => {
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await secureApi<unknown>('deposits.mids', {});
      if (!res.ok) return;
      setMids(parseDistinctMidOptions(res.data));
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
      if (!allData) {
        if (startDate && endDate) {
          payload.startDate = startDate;
          payload.endDate = endDate;
        } else {
          const today = todayIST();
          payload.startDate = today;
          payload.endDate = today;
        }
      }
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
  }, [status, applied, page, pageSize, startDate, endDate, allData]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyDates = useCallback(() => {
    setAllData(false);
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setPage(1);
  }, [draftStart, draftEnd]);

  const applyAllData = useCallback(() => {
    setDraftStart('');
    setDraftEnd('');
    setStartDate('');
    setEndDate('');
    setAllData(true);
    setPage(1);
  }, []);

  const clearDates = useCallback(() => {
    setDraftStart('');
    setDraftEnd('');
    setAllData(false);
  }, []);

  const search = useCallback(() => {
    setApplied({ field: searchField, text: draftSearch });
    setPage(1);
  }, [searchField, draftSearch]);

  const filteredMids = useMemo(() => {
    const q = midPickerQuery.trim().toLowerCase();
    if (!q) return mids;
    return mids.filter((m) => m.toLowerCase().includes(q));
  }, [mids, midPickerQuery]);

  // Approve → open Manual Settle modal (desktop SettleDialog parity, simplified).
  const openSettle = useCallback(
    (row: DepositRow) => {
      if (!canEditDeposit(row, canPencil)) {
        Alert.alert('Complete Check and Cross Check before Approve');
        return;
      }
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
    },
    [canPencil],
  );

  const markChecked = useCallback(
    async (row: DepositRow, check: 'first' | 'second') => {
      const orderId = String(row.orderId || '').trim();
      if (!orderId) {
        Alert.alert('Missing order id');
        return;
      }
      setCheckingId(`${orderId}-${check}`);
      try {
        const res = await secureApi<unknown>('deposits.check', {
          transactionId: orderId,
          check,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?._id || '',
            status: check === 'first' ? 'true' : 'false',
          },
        });
        if (!res.ok || res.success === false) {
          Alert.alert(res.message || 'Check failed');
          return;
        }
        Alert.alert(res.message || 'Updated');
        setSheetRow(null);
        void load();
      } finally {
        setCheckingId('');
      }
    },
    [admin, load],
  );

  const submitSettle = useCallback(
    (utrOverride?: string) => {
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
            remark: `Deposit failure of ${row.userName || ''} through ${sGateway || row.paymentGatewayName || ''} pay with order id ${row.orderId} and mobile no ${row.userMobile || row.mobile || ''}`,
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
    },
    [settleRow, sUtr, sReason, sGateway, sAmount, sMid, sDate, admin, load],
  );

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
      {
        label: 'Emp Code',
        value: (() => {
          const code = String(r.empCode || '').trim();
          const name = code ? empCodeNameMap[code] : '';
          return name ? `${code || '—'} (${name})` : display(r.empCode);
        })(),
      },
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
        value:
          Array.isArray(r.oldMultipleNames) && r.oldMultipleNames.length
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
      { label: 'Check By', value: formatCheckPerson(r.checkBy), multiline: true },
      { label: 'Cross Check By', value: formatCheckPerson(r.crossCheckBy), multiline: true },
    ];
  }, [sheetRow, canShowMobile, empCodeNameMap]);

  const openUserDetails = useCallback(
    (row: DepositRow) => {
      const userId = String(row.userId || '').trim();
      if (!userId) {
        Alert.alert('User Details', 'User ID is not available for this deposit.');
        return;
      }
      setSheetRow(null);
      openPanelTarget(navigation, {
        href: '/user-report',
        state: {
          userId,
          userName: String(row.userName || ''),
        },
      });
    },
    [navigation],
  );

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const acts: SheetAction[] = [];
    if (canShowC2c && sanitizeGtelPhone(String(sheetRow.userMobile || sheetRow.mobile || ''))) {
      acts.push({
        label: 'C2C Call',
        tone: 'primary',
        onPress: () => {
          const row = sheetRow;
          setSheetRow(null);
          openC2cCall(row);
        },
      });
    }
    acts.push({
      label: 'User Details',
      tone: 'primary',
      onPress: () => openUserDetails(sheetRow),
    });
    const pending = String(sheetRow.status || '').toLowerCase() === 'pending';
    if (canShowCheckAction(sheetRow, canPencil)) {
      if (!sheetRow.checkBy) {
        acts.push({
          label: checkingId === `${sheetRow.orderId}-first` ? 'Checking…' : 'Check',
          tone: 'primary',
          disabled: !!checkingId,
          onPress: () => void markChecked(sheetRow, 'first'),
        });
      }
      if (!sheetRow.crossCheckBy) {
        acts.push({
          label: checkingId === `${sheetRow.orderId}-second` ? 'Checking…' : 'Cross Check',
          tone: 'default',
          disabled: !!checkingId,
          onPress: () => void markChecked(sheetRow, 'second'),
        });
      }
    }
    if (canEditDeposit(sheetRow, canPencil)) {
      acts.push(
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
      );
    } else if (pending) {
      acts.push({
        label: 'Add Secondary Name',
        tone: 'default',
        onPress: () => {
          setSheetRow(null);
          setSecName('');
          setSecRow(sheetRow);
        },
      });
    }
    return acts;
  }, [
    sheetRow,
    openSettle,
    openUserDetails,
    openC2cCall,
    canShowC2c,
    canPencil,
    checkingId,
    markChecked,
  ]);

  const sheetChatFooter = useMemo(() => {
    if (!sheetRow) return null;
    const pending = String(sheetRow.status || '').toLowerCase() === 'pending';
    if (!canWhatsApp || !canShowMobile || !pending) return null;
    if (!(sheetRow.userMobile || sheetRow.mobile)) return null;
    return (
      <View style={styles.sheetChatRow}>
        <TouchableOpacity
          style={[styles.sheetChatIconBtn, styles.sheetChatWa]}
          onPress={() => void openWhatsApp(sheetRow)}
          activeOpacity={0.8}
          accessibilityLabel="Open WhatsApp"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <FontAwesome5 name="whatsapp" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sheetChatIconBtn, styles.sheetChatTg]}
          onPress={() => void openTelegram(sheetRow)}
          activeOpacity={0.8}
          accessibilityLabel="Open Telegram"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <FontAwesome5 name="telegram-plane" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }, [sheetRow, canWhatsApp, canShowMobile]);

  const keyExtractor = useCallback(
    (r: DepositRow, i: number) => `row-${i}-${String(r._id || r.orderId || '')}`,
    [],
  );

  const openSecondary = useCallback((r: DepositRow) => {
    setSecName('');
    setSecRow(r);
  }, []);

  const renderItem = useCallback(
    ({ item: r }: ListRenderItemInfo<DepositRow>) => (
      <DepositCard
        row={r}
        canPencil={canPencil}
        canShowMobile={canShowMobile}
        canShowC2c={canShowC2c}
        checkingId={checkingId}
        empCodeName={(() => {
          const code = String(r.empCode || '').trim();
          return code ? empCodeNameMap[code] || '' : '';
        })()}
        onOpenSheet={() => setSheetRow(r)}
        onApprove={() => openSettle(r)}
        onSecondary={() => openSecondary(r)}
        onCheck={(check) => void markChecked(r, check)}
        onC2cCall={() => openC2cCall(r)}
      />
    ),
    [
      canPencil,
      canShowMobile,
      canShowC2c,
      checkingId,
      empCodeNameMap,
      openSettle,
      openSecondary,
      openC2cCall,
      markChecked,
    ],
  );

  const listHeader = (
    <>
      <Text style={styles.title}>Deposit</Text>
      <Text style={styles.sub}>
        {allData ? 'All data' : `${startDate} → ${endDate}`} · Total:{' '}
        {total.toLocaleString('en-IN')}
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={applyDates}
        onAllData={applyAllData}
        onClearDates={clearDates}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        searchFields={[
          { key: 'userName', label: 'User Name' },
          { key: 'userMobile', label: 'Mobile' },
          { key: 'empCode', label: 'Emp Code' },
          { key: 'amount', label: 'Amount' },
          { key: 'orderId', label: 'Order Id' },
        ]}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={draftSearch}
        onSearchTextChange={setDraftSearch}
        onSearchSubmit={search}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
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
        emptyMessage="No deposits found"
        refreshing={loading}
        onRefresh={() => void load()}
        refreshEnabled={!midPickerOpen}
        extraData={checkingId}
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.userName) : ''}
        fields={sheetFields}
        actions={sheetActions}
        footer={sheetChatFooter}
        onClose={() => setSheetRow(null)}
      />

      <GtelClick2CallModal
        target={c2cTarget}
        onClose={() => setC2cTarget(null)}
        canShowMobile={!!canShowMobile}
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                    {sMid || 'Select MID'}
                  </Text>
                  <Text style={styles.midSelectChevron}>▾</Text>
                </TouchableOpacity>
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
              <DateField style={styles.input} value={sDate} onChange={setSDate} />

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
                <TouchableOpacity style={styles.cancelBtn} disabled={saving} onPress={closeSettle}>
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
              <Text style={styles.modalNote}>Existing: {secRow.oldMultipleNames.join(', ')}</Text>
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
              {filteredMids.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerRow, sMid === m && styles.pickerRowActive]}
                  onPress={() => {
                    setSMid(m);
                    setMidPickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerRowText, sMid === m && styles.pickerRowTextActive]}>
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

type DepositCardProps = {
  row: DepositRow;
  canPencil: boolean;
  canShowMobile: boolean;
  canShowC2c: boolean;
  checkingId: string;
  empCodeName: string;
  onOpenSheet: () => void;
  onApprove: () => void;
  onSecondary: () => void;
  onCheck: (check: 'first' | 'second') => void;
  onC2cCall: () => void;
};

const DepositCard = memo(function DepositCard({
  row: r,
  canPencil,
  canShowMobile,
  canShowC2c,
  checkingId,
  empCodeName,
  onOpenSheet,
  onApprove,
  onSecondary,
  onCheck,
  onC2cCall,
}: DepositCardProps) {
  const pending = String(r.status || '').toLowerCase() === 'pending';
  const canApprove = canEditDeposit(r, canPencil);
  const badge = statusBadge(r.status);
  const showChecks = canShowCheckAction(r, canPencil);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onOpenSheet}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>
          {display(r.userName)}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusPill, badge ? { backgroundColor: badge } : null]}>
            <Text style={styles.statusPillText}>{display(r.status)}</Text>
          </View>
          {canApprove ? (
            <TouchableOpacity
              style={styles.approveIconBtn}
              onPress={onApprove}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Approve deposit"
            >
              <MaterialCommunityIcons name="check-circle" size={22} color="#16a34a" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <Text style={styles.cardAmount}>₹ {formatIN(r.amount)}</Text>
      <View style={styles.cardGrid}>
        <View style={styles.cardCell}>
          <Text style={styles.cardLabel}>Emp Code</Text>
          <Text style={styles.cardValue} numberOfLines={1}>
            {display(r.empCode)}
          </Text>
          {empCodeName ? (
            <Text style={styles.cardEmpName} numberOfLines={1}>
              {empCodeName}
            </Text>
          ) : null}
        </View>
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
          {canShowC2c && sanitizeGtelPhone(String(r.userMobile || r.mobile || '')) ? (
            <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
              <GtelC2cCallButton onPress={onC2cCall} />
            </View>
          ) : null}
        </View>
        <View style={styles.cardCell}>
          <Text style={styles.cardLabel}>App</Text>
          <View style={styles.appRow}>
            <Text style={[styles.cardValue, styles.appValue]} numberOfLines={1}>
              {display(appCodeForName(r.clientName) || r.clientName)}
            </Text>
            {pending || canApprove ? (
              <TouchableOpacity
                style={styles.secondaryChip}
                onPress={onSecondary}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={styles.secondaryChipText}>+ Secondary</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
      {showChecks ? (
        <View style={styles.cardBtnRow}>
          {r.checkBy ? (
            <Text style={styles.checkDone} numberOfLines={1}>
              ✓ {display(r.checkBy.name)}
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.checkBtn, checkingId === `${r.orderId}-first` && styles.btnDisabled]}
              disabled={!!checkingId}
              onPress={() => onCheck('first')}
            >
              <Text style={styles.checkBtnText}>
                {checkingId === `${r.orderId}-first` ? '…' : 'Check'}
              </Text>
            </TouchableOpacity>
          )}
          {r.crossCheckBy ? (
            <Text style={styles.checkDone} numberOfLines={1}>
              ✓✓ {display(r.crossCheckBy.name)}
            </Text>
          ) : (
            <TouchableOpacity
              style={[styles.checkBtn, checkingId === `${r.orderId}-second` && styles.btnDisabled]}
              disabled={!!checkingId}
              onPress={() => onCheck('second')}
            >
              <Text style={styles.checkBtnText}>
                {checkingId === `${r.orderId}-second` ? '…' : 'Cross Check'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {pending && !canApprove && showChecks ? (
        <Text style={styles.checkHint}>Approve after Check + Cross Check</Text>
      ) : null}
      <Text style={styles.cardHint}>Tap for all details</Text>
    </TouchableOpacity>
  );
});

