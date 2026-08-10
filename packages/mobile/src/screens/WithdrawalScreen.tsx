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
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../api/client';
import { getSessionUser, hasPermission, Permissions } from '../auth/permissions';
import { colors, radius, spacing } from '../theme';
import { type DataTableColumn } from '../dashboards/ui/DataTable';
import { ResponsiveTable } from '../dashboards/ui/ResponsiveTable';
import {
  DetailFilterBar,
  type SearchFieldOption,
} from './dashboards/details/DetailFilterBar';
import {
  RowDetailSheet,
  type SheetAction,
  type SheetField,
} from './dashboards/details/RowDetailSheet';
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

/** Desktop parity: fixed gateway list used in the Manual Approved / QR popups. */
const GATEWAY_OPTIONS: { value: string; label: string }[] = [
  { value: 'bramhadev', label: 'Bramhadev' },
  { value: 'jk Bank', label: 'J&K Bank' },
  { value: 'personal', label: 'Personal' },
  { value: 'kotak', label: 'Kotak' },
  { value: 'OFS-HDFC', label: 'OFS-HDFC' },
  { value: 'OFS-AXIS', label: 'OFS-AXIS' },
  { value: 'axis', label: 'Axis' },
  { value: 'payok', label: 'Pay Ok' },
  { value: 'uco', label: 'Uco' },
  { value: 'ansin-ecommerce-JK', label: 'Ansin-Ecommerce-JK' },
  { value: 'OFS-ansin', label: 'OFS-ansin' },
  { value: 'digitech', label: 'Digitech' },
  { value: 'rpf', label: 'Royal Pets' },
  { value: 'shyam-trading', label: 'SHYAM-TRADING' },
];

/** Desktop UPIQR parity: build the UPI payment query string. */
function buildUpiQuery(r: Rec): string {
  const params = new URLSearchParams();
  params.set('pa', String(r.upiId ?? ''));
  if (r.amount !== undefined && r.amount !== null) params.set('am', String(r.amount));
  params.set('cu', 'INR');
  params.set(
    'tn',
    `Note:${String(r.accountHolderName ?? '').slice(0, 6)}-${String(r.dp_id ?? '').slice(-6)}`,
  );
  params.set('tr', `ORD-${Date.now()}`);
  return params.toString();
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

/* ------------------------- desktop gating helpers ------------------------- */

const TERMINAL_STATUSES = new Set(['Approved', 'Rejected', 'Reverse', 'Cancel', 'Failed']);

type CheckMark = { status?: string | boolean; name?: string; date?: string };

function checkOf(r: Rec, key: 'checkBy' | 'crossCheckBy'): CheckMark | null {
  const v = r[key];
  return v && typeof v === 'object' ? (v as CheckMark) : null;
}

function bothChecksOk(r: Rec): boolean {
  return Boolean(checkOf(r, 'checkBy')?.status && checkOf(r, 'crossCheckBy')?.status);
}

function isTerminal(r: Rec): boolean {
  return TERMINAL_STATUSES.has(String(r.status || ''));
}

function canLockRow(r: Rec): boolean {
  if (isTerminal(r)) return false;
  if (r.status === 'IN PROGRESS') return false;
  return bothChecksOk(r);
}

function canUnlockRow(r: Rec): boolean {
  return r.status === 'IN PROGRESS' || r.status === 'Lock';
}

function canShowApproveAction(r: Rec): boolean {
  if (isTerminal(r)) return false;
  if (r.status === 'IN PROGRESS') return true;
  if ((r.status === 'Lock' || r.status === 'Pending') && bothChecksOk(r)) return true;
  return bothChecksOk(r) || ['on hold', 'Processing', 'IN PROGRESS'].includes(String(r.status || ''));
}

function canRejectRow(r: Rec): boolean {
  if (r.status === 'Approved' || r.status === 'Rejected' || r.status === 'Reverse') return false;
  if (r.status === 'on hold') return true;
  return (
    bothChecksOk(r) ||
    Boolean(checkOf(r, 'checkBy')?.status) ||
    Boolean(checkOf(r, 'crossCheckBy')?.status)
  );
}

type Geo = { city: string; state: string; lat: string; long: string };

/**
 * Never call Alert.alert while a Modal is open/animating — RN freezes all
 * touches (the "cards stop responding" bug). Always close sheets first and
 * show alerts after a short delay.
 */
function notify(title: string, message?: string): void {
  setTimeout(() => Alert.alert(title, message), 450);
}

/** Desktop requireWithdrawalGeo parity: lat/long + city/state or abort (no alert here). */
async function requireGeo(): Promise<Geo | null> {
  try {
    if (Platform.OS === 'web') throw new Error('unsupported');
    const pos =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const { latitude, longitude } = pos.coords;
    let city = '';
    let state = '';
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = places[0];
      city = p?.city || p?.subregion || p?.district || '';
      state = p?.region || '';
    } catch {
      /* fall through */
    }
    if (!city || !state) return null;
    return { city, state, lat: String(latitude), long: String(longitude) };
  } catch {
    return null;
  }
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
    () =>
      getSessionUser() as {
        _id?: string;
        userId?: string;
        name?: string;
        clientName?: string;
        allotedApps?: string;
      } | null,
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

  // Row detail sheet + action state.
  const [selected, setSelected] = useState<Rec | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  // Status-change modal (Rejected / on hold / Reverse need remark; some need gateway+MID).
  const [statusModal, setStatusModal] = useState<{ row: Rec; status: string } | null>(null);
  const [modalErr, setModalErr] = useState('');
  const [remark, setRemark] = useState('');
  const [gateway, setGateway] = useState('');
  const [mid, setMid] = useState('');
  const [gateways, setGateways] = useState<string[]>([]);
  const [mids, setMids] = useState<{ label: string; mid: string; gateway: string }[]>([]);
  // Bot validation results modal (desktop ValidationModal parity).
  const [validationRow, setValidationRow] = useState<Rec | null>(null);
  // Bulk selection mode (desktop bulk lock/unlock/approve/manual approve).
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSel, setBulkSel] = useState<Record<string, Rec>>({});
  const [bulkManualOpen, setBulkManualOpen] = useState(false);
  // QR Code approve modal (desktop UPIQR popup parity).
  const [qrRow, setQrRow] = useState<Rec | null>(null);
  const qrQuery = useMemo(() => (qrRow ? buildUpiQuery(qrRow) : ''), [qrRow]);
  const qrUrl = qrQuery ? `upi://pay?${qrQuery}` : '';
  const qrRef = React.useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  // Desktop parity: default withdrawal provider = first active payout account.
  const [defaultGateway, setDefaultGateway] = useState('');
  // Manual Approved / QR gateway list: desktop's fixed options + any extra API gateways.
  const gatewayOptions = useMemo(() => {
    const known = new Set(GATEWAY_OPTIONS.map((g) => g.value.toLowerCase()));
    // User request: never show Zappay or Wasabi in this list.
    const excluded = ['zappay', 'wasabi'];
    return [
      ...GATEWAY_OPTIONS,
      ...gateways
        .filter(
          (g) =>
            !known.has(g.toLowerCase()) &&
            !excluded.some((x) => g.toLowerCase().includes(x)),
        )
        .map((g) => ({ value: g, label: g })),
    ];
  }, [gateways]);
  // Approve modal with withdrawal-provider selection (desktop per-row gateway dropdown parity).
  const [approveTarget, setApproveTarget] = useState<{ row: Rec | null; bulk: boolean } | null>(
    null,
  );
  const [provider, setProvider] = useState('');
  // Collapsible tools section (keeps the list visible without scrolling).
  const [toolsOpen, setToolsOpen] = useState(false);
  // Desktop toolbar parity: Sort checkbox, Bank Amount + Mid Name filters.
  const [sortChecked, setSortChecked] = useState(false);
  const [bankAmtDraft, setBankAmtDraft] = useState('');
  const [bankAmt, setBankAmt] = useState('');
  const [midFilter, setMidFilter] = useState('');
  const [midFilterOpen, setMidFilterOpen] = useState(false);
  // Add Bene List modal (desktop BeneModal parity — manage available banks).
  const [beneOpen, setBeneOpen] = useState(false);
  const [beneBanks, setBeneBanks] = useState<string[]>([]);
  const [beneInitial, setBeneInitial] = useState<string[]>([]);
  const [beneInput, setBeneInput] = useState('');
  const [beneBusy, setBeneBusy] = useState(false);

  // Desktop permission parity (login Responsibilities).
  const perms = useMemo(
    () => ({
      actions: hasPermission(Permissions.withdrawals_button),
      checksDisabled: hasPermission(Permissions.Disable_Withdrawals_Check),
      reject: hasPermission(Permissions.View_Reject),
      reverse: hasPermission(Permissions.View_Reverse),
      showAll: hasPermission(Permissions.show_all_withdrawal),
      showMobile: hasPermission(Permissions.show_mobile) && !hasPermission('contact_visibility_none'),
      download: hasPermission(Permissions.Download_Withdrawal),
    }),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const filter: Rec = {};
      if (status) filter.status = status;
      // Desktop IN PROGRESS isolation: without show_all_withdrawal, only own locked rows.
      if (status === 'IN PROGRESS' && !perms.showAll && admin?.name) filter.name = admin.name;
      if (applied.text.trim()) filter[applied.field] = applied.text.trim();
      // Desktop toolbar filters: sort checkbox, bank amount, mid name.
      if (sortChecked) filter.sort = true;
      if (bankAmt.trim()) filter.bankAmt = bankAmt.trim();
      if (midFilter) filter.mid = midFilter;
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
  }, [
    admin,
    status,
    applied,
    pageSize,
    page,
    startDate,
    endDate,
    perms.showAll,
    sortChecked,
    bankAmt,
    midFilter,
  ]);

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

  // Refresh whenever the screen regains focus (e.g. after actions elsewhere).
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadSummary();
    }, [load, loadSummary]),
  );

  // Gateway + MID lookups (desktop loadLookups parity).
  useEffect(() => {
    void (async () => {
      const [midRes, gwRes] = await Promise.all([
        secureApi('withdrawals.mids', {}),
        secureApi('withdrawals.payoutAccounts', {}),
      ]);
      if (midRes.ok) {
        const list = listOf(midRes.data) as {
          mid?: string | number;
          name?: string;
          paymentGatewayName?: string;
        }[];
        setMids(
          list
            .filter((m) => m.mid !== undefined && m.mid !== null)
            .map((m) => ({
              label: `${m.paymentGatewayName || m.name || '—'} - ${m.mid}`,
              mid: String(m.mid),
              gateway: String(m.paymentGatewayName || m.name || ''),
            })),
        );
      }
      if (gwRes.ok) {
        const list = listOf(gwRes.data) as { name?: string }[];
        setGateways(
          Array.from(new Set(list.map((g) => g?.name).filter((n): n is string => Boolean(n)))),
        );
        // Desktop parity: paymentGateway defaults to the first active payout account.
        if (list[0]?.name) setDefaultGateway(list[0].name);
      }
    })();
  }, []);

  /* ------------------------------ row actions ------------------------------ */

  const txnIdOf = (r: Rec) => String(r.transactionId ?? r.orderId ?? '');

  const afterAction = useCallback(() => {
    setSelected(null);
    setStatusModal(null);
    setQrRow(null);
    setApproveTarget(null);
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  const doLock = useCallback(
    async (r: Rec, lock: boolean) => {
      // Close the sheet first — alerts over an open Modal freeze touches.
      setSelected(null);
      setActionBusy(true);
      try {
        let res;
        if (lock) {
          const geo = await requireGeo();
          if (!geo) {
            notify('Location Information Missing');
            return;
          }
          res = await secureApi('withdrawals.lock', {
            transactionId: txnIdOf(r),
            updatedBy: {
              name: admin?.name || '',
              userId: admin?.userId || admin?._id || '',
              status: 'true',
              date: new Date().toISOString(),
              ...geo,
            },
          });
        } else {
          res = await secureApi('withdrawals.unlock', { transactionId: txnIdOf(r) });
        }
        if (!res.ok) {
          notify(res.message || 'Action failed');
          return;
        }
        notify(lock ? 'Locked' : 'Unlocked');
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, afterAction],
  );

  const doCheck = useCallback(
    async (r: Rec, check: 'first' | 'second', ok: boolean) => {
      // Close the sheet first — alerts over an open Modal freeze touches.
      setSelected(null);
      setActionBusy(true);
      try {
        const geo = await requireGeo();
        if (!geo) {
          notify('Location Information Missing');
          return;
        }
        const res = await secureApi('withdrawals.check', {
          transactionId: txnIdOf(r),
          check,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?.userId || admin?._id || '',
            status: String(ok),
            ...geo,
          },
        });
        if (!res.ok) {
          notify(res.message || 'Check failed');
          return;
        }
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, afterAction],
  );

  const doStatusUpdate = useCallback(
    async (
      r: Rec,
      newStatus: string,
      reasonText: string,
      gw: string,
      midSel: string,
      providerSel?: string,
    ) => {
      // Desktop parity: only Approved and Reverse are exempt from gateway/MID;
      // non-Approved statuses need a remark.
      const needsRemark = newStatus !== 'Approved';
      const needsGateway = !['Approved', 'Reverse'].includes(newStatus);
      if (needsRemark && !reasonText.trim()) {
        setModalErr('Remark is required');
        return;
      }
      if (needsGateway && (!gw || !midSel)) {
        setModalErr('Gateway and MID are required');
        return;
      }
      setModalErr('');
      // Close modals before any alert can fire (touch-freeze guard).
      setStatusModal(null);
      setSelected(null);
      setActionBusy(true);
      try {
        const geo = await requireGeo();
        if (!geo) {
          notify('Location Information Missing');
          return;
        }
        const payload: Rec = {
          transactionId: txnIdOf(r),
          reason: newStatus === 'Approved' ? reasonText.trim() || 'Approved' : reasonText.trim(),
          dp_id: r.dp_id,
          updatedBy: {
            name: admin?.name || '',
            _id: admin?._id || admin?.userId || '',
            status: newStatus,
            ...geo,
          },
        };
        // Desktop parity: Approve without an explicit gateway still sends the
        // default payout-account provider as withdrewalProviderName.
        const providerName = gw || providerSel || defaultGateway;
        if (providerName) payload.withdrewalProviderName = providerName;
        if (gw) payload.gatewayName = gw;
        if (midSel) payload.mid = midSel;
        const res = await secureApi('withdrawals.statusUpdate', payload);
        if (!res.ok) {
          notify(res.message || 'Status update failed');
          return;
        }
        notify(`Status updated: ${newStatus}`);
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, defaultGateway, afterAction],
  );

  /** Open the payment in PhonePe / GPay with the same UPI params as the QR. */
  const openUpiApp = useCallback(
    async (app: 'phonepe' | 'gpay') => {
      if (!qrQuery) return;
      const url =
        app === 'phonepe' ? `phonepe://pay?${qrQuery}` : `tez://upi/pay?${qrQuery}`;
      try {
        await Linking.openURL(url);
      } catch {
        notify(app === 'phonepe' ? 'PhonePe app not found' : 'GPay app not found');
      }
    },
    [qrQuery],
  );

  /** Save/share the QR image (PNG) via the system share sheet. */
  const downloadQr = useCallback(() => {
    const svg = qrRef.current;
    if (!svg) return;
    svg.toDataURL((base64: string) => {
      void (async () => {
        try {
          const uri = `${FileSystem.cacheDirectory}refund-qr-${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(uri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save QR' });
          } else {
            notify('Sharing not available on this device');
          }
        } catch {
          notify('Could not save QR');
        }
      })();
    });
  }, []);

  /* --------------------------- excel/csv downloads --------------------------- */

  /** Build a CSV file from the current rows and open the system share sheet. */
  const shareCsv = useCallback(async (fileName: string, headers: string[], data: string[][]) => {
    try {
      const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [headers, ...data].map((line) => line.map(esc).join(',')).join('\n');
      const uri = `${FileSystem.cacheDirectory}${fileName}-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: fileName });
      } else {
        notify('Sharing not available on this device');
      }
    } catch {
      notify('Could not create file');
    }
  }, []);

  const cell = (v: unknown) => (v === undefined || v === null ? '' : String(v));

  /** Desktop "Download Data" (Withdrawal_Data sheet). */
  const downloadData = useCallback(() => {
    void shareCsv(
      'Withdrawal_Data',
      ['Sr No', 'Date', 'accountHolderName', 'Name (send to bank)', 'bankName', 'city', 'state', 'status', 'dp_id', 'transactionId', 'Acc No', 'Amount', 'userBankName', 'ifscCode'],
      rows.map((r, i) => [
        String(i + 1),
        r.createdOn ? formatDisplayDate(String(r.createdOn)) : '',
        cell(r.accountHolderName),
        cell(r.beneficiaryAccount ?? r.accountHolderName),
        cell(r.bankName),
        cell(r.city),
        cell(r.state),
        cell(r.status),
        cell(r.dp_id),
        cell(r.transactionId),
        cell(r.accountNo),
        cell(r.amount),
        cell(r.userBankName),
        cell(r.ifscCode),
      ]),
    );
  }, [rows, shareCsv]);

  /** Desktop "Pay OK Data" (pay_ok_sheet). */
  const downloadPayok = useCallback(() => {
    void shareCsv(
      'pay_ok_sheet',
      ['Bank Name (IFSC)', 'Bank Account', 'Amount(INR)', 'Phone Number', 'AccountName', 'Email'],
      rows.map((r) => [
        cell(r.ifscCode),
        cell(r.accountNo),
        cell(r.amount),
        cell(r.userMobile ?? r.mobile),
        cell(r.accountHolderName),
        cell(r.email),
      ]),
    );
  }, [rows, shareCsv]);

  /** Desktop "Yes Bank Data" (yes_bank_sheet). */
  const downloadYesBank = useCallback(() => {
    void shareCsv(
      'yes_bank_sheet',
      ['Sr No', 'Name', 'Transfer Type', 'Acc No', 'Amount', 'IFSC', 'Phone No', 'Remarks'],
      rows.map((r, i) => [
        String(i + 1),
        cell(r.accountHolderName),
        'NEFT',
        cell(r.accountNo),
        cell(r.amount),
        cell(r.ifscCode),
        cell(r.userMobile ?? r.mobile),
        cell(r.transactionId),
      ]),
    );
  }, [rows, shareCsv]);

  /* --------------------------- add bene list (banks) --------------------------- */

  const openBeneModal = useCallback(async () => {
    setBeneBusy(true);
    setBeneOpen(true);
    setBeneInput('');
    try {
      const res = await secureApi('withdrawals.availableBanks', {});
      const obj = res.ok ? unpack(res.data) : {};
      const banks = Array.isArray(obj.availableBanks)
        ? (obj.availableBanks as string[]).filter(Boolean)
        : [];
      setBeneBanks(banks);
      setBeneInitial(banks);
    } finally {
      setBeneBusy(false);
    }
  }, []);

  const saveBeneBanks = useCallback(async () => {
    const norm = (s: string) => s.trim().toLowerCase();
    setBeneBusy(true);
    try {
      if (beneInitial.length === 0) {
        // Desktop BeneModal "create" mode.
        const res = await secureApi('withdrawals.createAvailableBanks', {
          availableBanks: beneBanks,
        });
        if (!res.ok) {
          notify(res.message || 'Failed to create banks');
          return;
        }
      } else {
        const added = beneBanks.filter((b) => !beneInitial.some((i) => norm(i) === norm(b)));
        const removed = beneInitial.filter((b) => !beneBanks.some((c) => norm(c) === norm(b)));
        if (!added.length && !removed.length) {
          setBeneOpen(false);
          notify('No changes to save');
          return;
        }
        if (added.length) {
          const res = await secureApi('withdrawals.updateAvailableBanks', {
            action: 'add',
            names: added,
          });
          if (!res.ok) {
            notify(res.message || 'Failed to add banks');
            return;
          }
        }
        if (removed.length) {
          const res = await secureApi('withdrawals.updateAvailableBanks', {
            action: 'remove',
            names: removed,
          });
          if (!res.ok) {
            notify(res.message || 'Failed to remove banks');
            return;
          }
        }
      }
      setBeneOpen(false);
      notify('Available banks updated successfully');
    } finally {
      setBeneBusy(false);
    }
  }, [beneBanks, beneInitial]);

  /* ------------------------------ bulk actions ------------------------------ */

  const bulkIds = useMemo(() => Object.keys(bulkSel), [bulkSel]);

  const clearBulk = useCallback(() => {
    setBulkSel({});
    setBulkMode(false);
  }, []);

  const doBulk = useCallback(
    async (kind: 'lock' | 'unlock' | 'approve', providerSel?: string) => {
      const rowsSel = Object.values(bulkSel);
      if (rowsSel.length === 0) {
        notify('No refunds selected');
        return;
      }
      setActionBusy(true);
      try {
        let res;
        if (kind === 'unlock') {
          res = await secureApi('withdrawals.bulkUnlock', {
            transactionId: rowsSel.map((r) => txnIdOf(r)),
          });
        } else {
          const geo = await requireGeo();
          if (!geo) {
            notify('Location Information Missing');
            return;
          }
          if (kind === 'lock') {
            res = await secureApi('withdrawals.bulkLock', {
              transactionId: rowsSel.map((r) => txnIdOf(r)),
              updatedBy: {
                name: admin?.name || '',
                userId: admin?._id || admin?.userId || '',
                status: 'true',
                date: new Date().toISOString(),
                ...geo,
              },
            });
          } else {
            // Desktop bulk-Approve payload shape.
            res = await secureApi('withdrawals.bulkApprove', {
              transactionId: rowsSel.map((r) => ({
                transactionId: txnIdOf(r),
                updatedBy: {
                  name: admin?.name || '',
                  status: 'Approved',
                  _id: admin?._id || '',
                },
              })),
              withdrewalProviderName: providerSel || gateway || defaultGateway,
              state: geo.state,
              city: geo.city,
              lat: geo.lat,
              long: geo.long,
            });
          }
        }
        if (!res.ok) {
          notify(res.message || 'Bulk action failed');
          return;
        }
        notify(
          kind === 'lock'
            ? 'Bulk Lock successfully'
            : kind === 'unlock'
              ? 'Bulk UnLock successfully'
              : 'Bulk Approved successfully',
        );
        clearBulk();
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, bulkSel, gateway, defaultGateway, afterAction, clearBulk],
  );

  const doBulkManual = useCallback(async () => {
    const rowsSel = Object.values(bulkSel);
    if (rowsSel.length === 0) {
      notify('No refunds selected');
      return;
    }
    if (!gateway || !mid) {
      setModalErr('Gateway and MID are required');
      return;
    }
    setModalErr('');
    setBulkManualOpen(false);
    setActionBusy(true);
    try {
      const geo = await requireGeo();
      if (!geo) {
        notify('Location Information Missing');
        return;
      }
      // Desktop bulk-manual-approved payload shape.
      const res = await secureApi('withdrawals.bulkManualApprove', {
        state: geo.state,
        city: geo.city,
        lat: geo.lat,
        long: geo.long,
        gatewayName: gateway,
        mid,
        transactionId: rowsSel.map((r) => ({
          transactionId: txnIdOf(r),
          name: admin?.name || '',
          _id: admin?._id || '',
        })),
      });
      if (!res.ok) {
        notify(res.message || 'Bulk manual approve failed');
        return;
      }
      notify('Bulk Manual Approved successfully');
      clearBulk();
      afterAction();
    } finally {
      setActionBusy(false);
    }
  }, [admin, bulkSel, gateway, mid, afterAction, clearBulk]);

  const confirmBulk = (kind: 'lock' | 'unlock' | 'approve') => {
    const n = bulkIds.length;
    if (n === 0) {
      Alert.alert('No refunds selected', 'Bulk mode me cards pe tap karke select karo.');
      return;
    }
    if (kind === 'approve') {
      // Provider must be chosen before bulk approve (desktop paymentGateway parity).
      setProvider(defaultGateway);
      setModalErr('');
      setApproveTarget({ row: null, bulk: true });
      return;
    }
    const label = kind === 'lock' ? 'Lock' : 'Unlock';
    Alert.alert(`Bulk ${label}?`, `You are about to ${label.toLowerCase()} ${n} refund(s).`, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, onPress: () => void doBulk(kind) },
    ]);
  };

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
      {
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => (perms.showMobile ? display(r.userMobile ?? r.mobile) : '••••••••'),
      },
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
        key: 'checkBot',
        label: 'Check By Bot',
        width: 100,
        render: (r) =>
          r.validationCheckedAt ? `${num(r.passedPoints)}/${num(r.totalPoints)}` : '—',
        // Desktop threshold: >= 13 passed points is a good bot score.
        color: (r) =>
          r.validationCheckedAt
            ? Number(r.passedPoints) >= 13
              ? colors.success
              : colors.destructive
            : undefined,
      },
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
        key: 'checkBy',
        label: 'Check By',
        width: 120,
        render: (r) => {
          const c = checkOf(r, 'checkBy');
          return c ? `${c.status === 'true' || c.status === true ? 'OK' : 'Not OK'} · ${display(c.name)}` : '—';
        },
      },
      {
        key: 'crossCheckBy',
        label: 'Cross Check By',
        width: 130,
        render: (r) => {
          const c = checkOf(r, 'crossCheckBy');
          return c ? `${c.status === 'true' || c.status === true ? 'OK' : 'Not OK'} · ${display(c.name)}` : '—';
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
    [perms.showMobile],
  );

  /** Confirm before lock/unlock (sheet closed first — touch-freeze guard). */
  const confirmLock = (r: Rec, lock: boolean) => {
    setSelected(null);
    setTimeout(
      () =>
        Alert.alert(
          lock ? 'Lock refund?' : 'Unlock refund?',
          `You are ${lock ? 'locking' : 'unlocking'} this refund of ₹${fmtAmount(r.amount)}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: lock ? 'Lock' : 'Unlock', onPress: () => void doLock(r, lock) },
          ],
        ),
      450,
    );
  };

  /** Close the sheet, then open the status modal (touch-freeze guard). */
  const openStatusModal = (r: Rec, statusName: string) => {
    setRemark('');
    setGateway('');
    setMid('');
    setModalErr('');
    setSelected(null);
    setTimeout(() => setStatusModal({ row: r, status: statusName }), 350);
  };

  /** Desktop row-action parity: lock/unlock, checks, status changes. */
  const sheetActions = (r: Rec): SheetAction[] => {
    const acts: SheetAction[] = [];
    if (r.validationCheckedAt) {
      acts.push({
        label: `Bot Validation (${num(r.passedPoints)}/${num(r.totalPoints)})`,
        tone: 'default',
        onPress: () => {
          // Close the sheet before opening another Modal (touch-freeze guard).
          setSelected(null);
          setTimeout(() => setValidationRow(r), 350);
        },
      });
    }
    const checkFirst = checkOf(r, 'checkBy');
    const checkSecond = checkOf(r, 'crossCheckBy');
    // Desktop: check column hidden only for Cancel/Rejected/Reverse/Failed,
    // and checks are NOT behind withdrawals_button.
    const checksAllowed =
      !perms.checksDisabled &&
      !['Cancel', 'Rejected', 'Reverse', 'Failed'].includes(String(r.status || ''));
    if (!checkFirst && checksAllowed) {
      acts.push(
        { label: 'Check: OK', tone: 'primary', onPress: () => void doCheck(r, 'first', true) },
        { label: 'Check: Not OK', tone: 'warning', onPress: () => void doCheck(r, 'first', false) },
      );
    }
    // Desktop: cross-check buttons appear only after first check is OK.
    if (!checkSecond && checksAllowed && Boolean(checkFirst?.status)) {
      acts.push(
        { label: 'Cross Check: OK', tone: 'primary', onPress: () => void doCheck(r, 'second', true) },
        { label: 'Cross Check: Not OK', tone: 'warning', onPress: () => void doCheck(r, 'second', false) },
      );
    }
    // Lock/Unlock + status buttons live behind withdrawals_button (desktop).
    if (!perms.actions) return acts;
    // Desktop: lock/unlock toggle shown only when both checks are OK.
    if (bothChecksOk(r)) {
      if (r.status === 'Lock' || r.status === 'IN PROGRESS') {
        acts.push({ label: 'Unlock', tone: 'warning', onPress: () => confirmLock(r, false) });
      } else if (!isTerminal(r)) {
        acts.push({ label: 'Lock', tone: 'primary', onPress: () => confirmLock(r, true) });
      }
    }
    if (canShowApproveAction(r)) {
      acts.push({
        label: 'Approve',
        tone: 'primary',
        onPress: () => {
          // Close the sheet before opening the provider-select modal (touch-freeze guard).
          setProvider(defaultGateway);
          setModalErr('');
          setSelected(null);
          setTimeout(() => setApproveTarget({ row: r, bulk: false }), 350);
        },
      });
      acts.push({
        label: 'Manual Approved',
        tone: 'primary',
        onPress: () => openStatusModal(r, 'Manual Approved'),
      });
      acts.push({
        label: 'QR Code',
        tone: 'primary',
        onPress: () => {
          // Close the sheet before opening another Modal (touch-freeze guard).
          setGateway('');
          setMid('');
          setModalErr('');
          setSelected(null);
          setTimeout(() => setQrRow(r), 350);
        },
      });
      acts.push({
        label: 'On Hold',
        tone: 'warning',
        onPress: () => openStatusModal(r, 'on hold'),
      });
    }
    if (canRejectRow(r)) {
      if (perms.reject) {
        acts.push({
          label: 'Reject',
          tone: 'warning',
          onPress: () => openStatusModal(r, 'Rejected'),
        });
      }
      if (perms.reverse) {
        acts.push({
          label: 'Reverse',
          tone: 'warning',
          onPress: () => openStatusModal(r, 'Reverse'),
        });
      }
    }
    return acts;
  };

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
      <Text style={styles.title}>Refund</Text>

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

      {/* Collapsible tools: Sort, Bank Amount, Mid Name, downloads, Add Bene List */}
      <View style={[styles.toolsRow, { justifyContent: 'flex-end' }]}>
        <TouchableOpacity
          style={[styles.chip, toolsOpen && styles.chipActive]}
          onPress={() => setToolsOpen((v) => !v)}
        >
          <Text style={[styles.chipText, toolsOpen && styles.chipTextActive]}>
            Tools {toolsOpen ? '▲' : '▼'}
            {!toolsOpen && (sortChecked || bankAmt || midFilter) ? ' •' : ''}
          </Text>
        </TouchableOpacity>
      </View>
      {toolsOpen ? (
        <View style={styles.toolsRow}>
        <TouchableOpacity
          style={[styles.chip, sortChecked && styles.chipActive]}
          onPress={() => {
            setSortChecked((v) => !v);
            setPage(1);
          }}
        >
          <Text style={[styles.chipText, sortChecked && styles.chipTextActive]}>
            Sort {sortChecked ? '✓' : ''}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={styles.toolInput}
          value={bankAmtDraft}
          onChangeText={setBankAmtDraft}
          placeholder="Bank Amount"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
          maxLength={6}
          returnKeyType="search"
          onSubmitEditing={() => {
            setBankAmt(bankAmtDraft);
            setPage(1);
          }}
          onBlur={() => {
            if (bankAmtDraft !== bankAmt) {
              setBankAmt(bankAmtDraft);
              setPage(1);
            }
          }}
        />
        <TouchableOpacity
          style={[styles.chip, midFilter !== '' && styles.chipActive]}
          onPress={() => setMidFilterOpen((v) => !v)}
        >
          <Text style={[styles.chipText, midFilter !== '' && styles.chipTextActive]}>
            {midFilter ? `Mid: ${midFilter}` : 'Mid Name'}
          </Text>
        </TouchableOpacity>
        {perms.actions ? (
          <TouchableOpacity style={styles.chip} onPress={() => void openBeneModal()}>
            <Text style={styles.chipText}>Add Bene List</Text>
          </TouchableOpacity>
        ) : null}
        </View>
      ) : null}
      {toolsOpen && midFilterOpen ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.chip, midFilter === '' && styles.chipActive]}
            onPress={() => {
              setMidFilter('');
              setMidFilterOpen(false);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, midFilter === '' && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {mids.map((m) => (
            <TouchableOpacity
              key={m.label}
              style={[styles.chip, midFilter === m.mid && styles.chipActive]}
              onPress={() => {
                setMidFilter(m.mid);
                setMidFilterOpen(false);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, midFilter === m.mid && styles.chipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
      {toolsOpen && perms.download ? (
        <View style={styles.toolsRow}>
          <TouchableOpacity style={styles.bulkBtn} onPress={downloadData}>
            <Text style={styles.bulkBtnText}>Download Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} onPress={downloadPayok}>
            <Text style={styles.bulkBtnText}>Pay OK Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bulkBtn} onPress={downloadYesBank}>
            <Text style={styles.bulkBtnText}>Yes Bank Data</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {msg ? <Text style={styles.muted}>{msg}</Text> : null}

      {/* Bulk actions (desktop Bulk Lock/UnLock/Approve/Manual Approve) */}
      {perms.actions ? (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={[styles.chip, bulkMode && styles.chipActive]}
            onPress={() => (bulkMode ? clearBulk() : setBulkMode(true))}
          >
            <Text style={[styles.chipText, bulkMode && styles.chipTextActive]}>
              {bulkMode ? `Bulk: ${bulkIds.length} selected ✕` : 'Bulk Select'}
            </Text>
          </TouchableOpacity>
          {bulkMode ? (
            <>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => confirmBulk('lock')}>
                <Text style={styles.bulkBtnText}>Bulk Lock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => confirmBulk('unlock')}>
                <Text style={styles.bulkBtnText}>Bulk UnLock</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkBtn} onPress={() => confirmBulk('approve')}>
                <Text style={styles.bulkBtnText}>Bulk Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bulkBtn}
                onPress={() => {
                  if (bulkIds.length === 0) {
                    Alert.alert('No refunds selected', 'Cards pe tap karke select karo.');
                    return;
                  }
                  setModalErr('');
                  setBulkManualOpen(true);
                }}
              >
                <Text style={styles.bulkBtnText}>Bulk Manual Approve</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
      {bulkMode && bulkIds.length > 0 ? (
        <Text style={styles.muted}>
          Selected:{' '}
          {Object.values(bulkSel)
            .map((r) => display(r.accountHolderName ?? r.userName))
            .join(', ')}
        </Text>
      ) : null}

      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? r.transactionId ?? i)}
        loading={loading}
        emptyMessage="No withdrawals"
        hint={bulkMode ? 'Tap cards to select/deselect for bulk actions' : 'Tap a card for details & actions'}
        onRowPress={(r) => {
          if (bulkMode) {
            const id = txnIdOf(r);
            if (!id) return;
            setBulkSel((prev) => {
              const next = { ...prev };
              if (next[id]) delete next[id];
              else next[id] = r;
              return next;
            });
          } else {
            setSelected(r);
          }
        }}
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.accountHolderName ?? selected.userName) : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected, 0),
                color: c.color?.(selected),
              }))
            : []
        }
        onClose={() => (actionBusy ? undefined : setSelected(null))}
        actions={selected ? sheetActions(selected) : undefined}
        note={actionBusy ? 'Working…' : undefined}
      />

      {/* Bot validation results (desktop ValidationModal parity) */}
      <Modal
        visible={validationRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setValidationRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.validationCard]}>
            <Text style={styles.modalTitle}>
              Validation Results ({num(validationRow?.passedPoints)}/{num(validationRow?.totalPoints)})
            </Text>
            <ScrollView style={styles.validationList}>
              {(Array.isArray(validationRow?.validationResults)
                ? (validationRow?.validationResults as Rec[])
                : []
              ).map((v, i) => (
                <View key={String(v._id ?? i)} style={styles.validationItem}>
                  <View style={styles.validationHead}>
                    <Text style={styles.validationName}>
                      {display(v.point)} · {display(v.name)}
                    </Text>
                    <Text
                      style={[
                        styles.validationStatus,
                        { color: v.passed ? colors.success : colors.destructive },
                      ]}
                    >
                      {v.passed ? 'Passed' : 'Failed'}
                    </Text>
                  </View>
                  {v.reason ? <Text style={styles.validationReason}>{display(v.reason)}</Text> : null}
                  {v.details && typeof v.details === 'object' ? (
                    <Text style={styles.validationDetails}>
                      {Object.entries(v.details as Rec)
                        .map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`)
                        .join('\n')}
                    </Text>
                  ) : null}
                </View>
              ))}
              {!Array.isArray(validationRow?.validationResults) ||
              (validationRow?.validationResults as Rec[]).length === 0 ? (
                <Text style={styles.validationReason}>No validation details available.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.pagerBtn} onPress={() => setValidationRow(null)}>
                <Text style={styles.pagerBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Manual Approve modal (gateway + MID) */}
      <Modal
        visible={bulkManualOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setBulkManualOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bulk Manual Approve ({bulkIds.length})</Text>
            <Text style={styles.modalSub}>Gateway</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gateways.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gateway === g && styles.chipActive]}
                  onPress={() => setGateway(g)}
                >
                  <Text style={[styles.chipText, gateway === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalSub}>MID</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mids.map((m) => (
                <TouchableOpacity
                  key={m.label}
                  style={[styles.chip, mid === m.mid && styles.chipActive]}
                  onPress={() => {
                    setMid(m.mid);
                    if (!gateway && m.gateway) setGateway(m.gateway);
                  }}
                >
                  <Text style={[styles.chipText, mid === m.mid && styles.chipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setBulkManualOpen(false)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() => void doBulkManual()}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Bene List modal (desktop BeneModal parity — manage available banks) */}
      <Modal
        visible={beneOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !beneBusy && setBeneOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Bene List</Text>
            <View style={{ flexDirection: 'row', gap: spacing(2) }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginTop: 0 }]}
                value={beneInput}
                onChangeText={setBeneInput}
                placeholder="Bank / account name…"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  const v = beneInput.trim();
                  if (!v) return;
                  if (beneBanks.some((b) => b.trim().toLowerCase() === v.toLowerCase())) {
                    setBeneInput('');
                    return;
                  }
                  setBeneBanks((prev) => [...prev, v]);
                  setBeneInput('');
                }}
              >
                <Text style={styles.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 260, marginTop: spacing(2) }}>
              {beneBusy && beneBanks.length === 0 ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : beneBanks.length === 0 ? (
                <Text style={styles.muted}>No banks yet — add one above.</Text>
              ) : (
                beneBanks.map((b) => (
                  <View key={b} style={styles.beneRow}>
                    <Text style={styles.beneText}>{b}</Text>
                    <TouchableOpacity
                      onPress={() => setBeneBanks((prev) => prev.filter((x) => x !== b))}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={18}
                        color={colors.destructive}
                      />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setBeneOpen(false)}
                disabled={beneBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, beneBusy && styles.pagerBtnDisabled]}
                disabled={beneBusy}
                onPress={() => void saveBeneBanks()}
              >
                {beneBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approve modal with withdrawal-provider selection (desktop gateway dropdown parity) */}
      <Modal
        visible={approveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setApproveTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {approveTarget?.bulk
                ? `Bulk Approve (${bulkIds.length})`
                : `Approve — ₹${fmtAmount(approveTarget?.row?.amount)}`}
            </Text>
            <Text style={styles.modalSub}>Withdrawal Provider</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gateways.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, provider === g && styles.chipActive]}
                  onPress={() => setProvider(g)}
                >
                  <Text style={[styles.chipText, provider === g && styles.chipTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setApproveTarget(null)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() => {
                  if (!approveTarget) return;
                  if (!provider) {
                    setModalErr('Select a withdrawal provider');
                    return;
                  }
                  const t = approveTarget;
                  setApproveTarget(null);
                  if (t.bulk) {
                    void doBulk('approve', provider);
                  } else if (t.row) {
                    void doStatusUpdate(t.row, 'Approved', '', '', '', provider);
                  }
                }}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code approve modal (desktop UPIQR popup parity) */}
      <Modal
        visible={qrRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setQrRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>QR Code — ₹{fmtAmount(qrRow?.amount)}</Text>
            <View style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
              {qrUrl ? (
                <View style={{ backgroundColor: '#fff', padding: spacing(3), borderRadius: radius.md }}>
                  <QRCode value={qrUrl} size={180} getRef={(c) => (qrRef.current = c)} />
                </View>
              ) : null}
              <Text style={[styles.modalSub, { textAlign: 'center' }]}>
                {String(qrRow?.upiId ?? '')}
              </Text>
              <View style={styles.qrIconRow}>
                <TouchableOpacity
                  style={[styles.qrIconBtn, { backgroundColor: '#5f259f' }]}
                  onPress={() => void openUpiApp('phonepe')}
                >
                  <Text style={styles.qrIconText}>Pe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qrIconBtn, { backgroundColor: '#1a73e8' }]}
                  onPress={() => void openUpiApp('gpay')}
                >
                  <Text style={styles.qrIconText}>G</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qrIconBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={downloadQr}
                >
                  <MaterialCommunityIcons name="download" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.modalSub}>Gateway</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gatewayOptions.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.chip, gateway === g.value && styles.chipActive]}
                  onPress={() => {
                    // Desktop parity: changing gateway resets the MID selection.
                    if (g.value !== gateway) setMid('');
                    setGateway(g.value);
                  }}
                >
                  <Text style={[styles.chipText, gateway === g.value && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalSub}>MID</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mids.map((m) => (
                <TouchableOpacity
                  key={m.label}
                  style={[styles.chip, mid === m.mid && styles.chipActive]}
                  onPress={() => setMid(m.mid)}
                >
                  <Text style={[styles.chipText, mid === m.mid && styles.chipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setQrRow(null)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() => {
                  if (!qrRow) return;
                  // Desktop QR popup requires gateway + MID before approving.
                  if (!gateway || !mid) {
                    setModalErr('Gateway and MID are required');
                    return;
                  }
                  const r = qrRow;
                  setQrRow(null);
                  // Desktop QR parity: reason marks the approval as done via UPI QR.
                  void doStatusUpdate(r, 'Approved', 'By UPI ID', gateway, mid);
                }}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Submit to Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status-change modal (remark + gateway/MID when required) */}
      <Modal
        visible={statusModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setStatusModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{statusModal?.status}</Text>
            <Text style={styles.modalSub}>Remark (required)</Text>
            <TextInput
              style={styles.modalInput}
              value={remark}
              onChangeText={setRemark}
              placeholder="Reason…"
              placeholderTextColor={colors.muted}
              multiline
            />
            {statusModal && !['Approved', 'Reverse', 'on hold'].includes(statusModal.status) ? (
              <>
                <Text style={styles.modalSub}>Gateway</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {gatewayOptions.map((g) => (
                    <TouchableOpacity
                      key={g.value}
                      style={[styles.chip, gateway === g.value && styles.chipActive]}
                      onPress={() => {
                        // Desktop parity: changing gateway resets the MID selection.
                        if (g.value !== gateway) setMid('');
                        setGateway(g.value);
                      }}
                    >
                      <Text style={[styles.chipText, gateway === g.value && styles.chipTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.modalSub}>MID</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mids.map((m) => (
                    <TouchableOpacity
                      key={m.label}
                      style={[styles.chip, mid === m.mid && styles.chipActive]}
                      onPress={() => setMid(m.mid)}
                    >
                      <Text style={[styles.chipText, mid === m.mid && styles.chipTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setStatusModal(null)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() =>
                  statusModal &&
                  void doStatusUpdate(statusModal.row, statusModal.status, remark, gateway, mid)
                }
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  statusRow: { marginTop: spacing(3), marginBottom: spacing(3) },
  bulkBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  bulkBtn: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
  bulkBtnText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(5),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  modalSub: { color: colors.muted, fontSize: 12, marginTop: spacing(2), marginBottom: spacing(1) },
  modalErr: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  qrIconRow: { flexDirection: 'row', gap: spacing(3), marginTop: spacing(2) },
  qrIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qrIconText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  toolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(2),
  },
  toolInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    minWidth: 110,
    fontSize: 13,
  },
  beneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  beneText: { color: colors.foreground, fontSize: 13 },
  modalInput: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.foreground,
    padding: spacing(2),
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  validationCard: { maxHeight: '85%' },
  validationList: { marginTop: spacing(2) },
  validationItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing(2),
  },
  validationHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
  },
  validationName: { color: colors.foreground, fontSize: 13, fontWeight: '600', flex: 1 },
  validationStatus: { fontSize: 12, fontWeight: '700' },
  validationReason: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  validationDetails: { color: colors.muted, fontSize: 11, marginTop: spacing(1) },
});
