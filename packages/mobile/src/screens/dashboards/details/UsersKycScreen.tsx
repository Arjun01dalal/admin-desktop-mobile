/**
 * KYC — card-based mobile page (desktop UsersKycPage /users-kyc, web panel KYC.tsx).
 *
 * Lists users via users.getAll with KYC filters. Each card shows name, mobile,
 * app, account/aadhaar and KYC status. Actions (desktop parity):
 *  - Approve: verify bank (ops.kycApprove) + UPI (ops.kycVerifyUpi) → admin OTP
 *    (ops.kycSendOtp sendOTPToClient:false) → final ops.kycAdminOtp.
 *  - Reject: customer OTP (sendOTPToClient:true) → ops.kycReject.
 *  - Manual KYC: customer OTP → ops.kycManualUpdate with bank details.
 *  - Verify UPI: ops.kycVerifyUpi.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type CheckStamp = { name?: string; date?: string } | undefined;

type KycRow = {
  _id: string;
  name?: string;
  mobile?: string;
  clientName?: string;
  aadhaarNumber?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
  kyc?: boolean;
  createdOn?: string;
  aadhaarImageBase64?: string;
  bankName?: string;
  userBankName?: string;
  kycRejectCheckBy?: CheckStamp;
  kycManualCheckBy?: CheckStamp;
};

function apiFailed(res: { ok: boolean; success?: boolean }): boolean {
  return !res.ok || res.success === false;
}

/** KYC night lock window: 8pm–10am IST (desktop useKycNightLock parity). */
function isKycNightHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  return hour >= 20 || hour < 10;
}

const NIGHT_UNLOCK_MS = 60_000;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (!value) return '—';
  return canShow ? String(value) : '**********';
}

function formatDateTime(value?: string | number): string {
  if (value == null || value === '') return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  return [d, t].filter(Boolean).join(' ') || '—';
}

function stamp(v: CheckStamp): string {
  if (!v?.name) return '—';
  return `${v.name}${v.date ? ` · ${formatDateTime(v.date)}` : ''}`;
}

function aadhaarImageUri(raw?: string): string | null {
  if (!raw) return null;
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw;
  return `data:image/jpeg;base64,${raw}`;
}

type ApproveForm = {
  accountNumber: string;
  ifsc: string;
  aadhaarNumber: string;
  upiId: string;
  comment: string;
  otp: string;
  kycAdminOtp: string;
};

type ManualForm = {
  userBankName: string;
  bankName: string;
  accountNumber: string;
  aadhaarNumber: string;
  upiId: string;
  ifsc: string;
  comment: string;
  otp: string;
  kycAdminOtp: string;
};

const EMPTY_APPROVE: ApproveForm = {
  accountNumber: '',
  ifsc: '',
  aadhaarNumber: '',
  upiId: '',
  comment: '',
  otp: '',
  kycAdminOtp: '',
};

const EMPTY_MANUAL: ManualForm = {
  userBankName: '',
  bankName: '',
  accountNumber: '',
  aadhaarNumber: '',
  upiId: '',
  ifsc: '',
  comment: '',
  otp: '',
  kycAdminOtp: '',
};

export function UsersKycScreen() {
  const canView = hasPermission('View_KYCs');
  const canShowMobile = hasPermission('show_mobile');
  const admin = useMemo(
    () => getSessionUser() as { _id?: string; name?: string; mobile?: string } | null,
    [],
  );
  const updatedBy = useCallback(
    () => ({ _id: admin?._id || '', name: admin?.name || '' }),
    [admin],
  );

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [appClientName, setAppClientName] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draftSearch, setDraftSearch] = useState('');
  const [searchField, setSearchField] = useState('name');
  const [applied, setApplied] = useState<{ field: string; text: string }>({
    field: 'name',
    text: '',
  });

  const [rows, setRows] = useState<KycRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<KycRow | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, string> = {};
      const text = applied.text.trim();
      if (text) filter[applied.field] = text;
      if (appClientName) filter.clientName = appClientName;
      const payload: Record<string, unknown> = {
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
      };
      if (startDate && endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }
      const res = await secureApi<unknown>('users.getAll', payload);
      if (gen !== genRef.current) return;
      if (apiFailed(res)) {
        setError(res.message || 'Failed to load KYC list');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const data = (res.data || {}) as Record<string, unknown>;
      const items = Array.isArray(data.users)
        ? (data.users as KycRow[])
        : Array.isArray(data.items)
          ? (data.items as KycRow[])
          : Array.isArray(res.data)
            ? (res.data as KycRow[])
            : [];
      setSheetRow(null);
      setRows(items);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      setTotal(Number(data.total ?? data.count) || items.length);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [applied, appClientName, page, pageSize, startDate, endDate]);

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

  // ---- Night lock (8pm–10am IST; OTP unlock for 1 min — desktop parity) ----
  const [nightLocked, setNightLocked] = useState(isKycNightHours());
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockOtpSent, setUnlockOtpSent] = useState(false);
  const [unlockOtp, setUnlockOtp] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // While a timed unlock is active, the timer below re-locks; skip checks.
      if (!unlockTimerRef.current) setNightLocked(isKycNightHours());
    }, 60_000);
    return () => {
      clearInterval(interval);
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

  const sendUnlockOtp = useCallback(() => {
    const mobile = admin?.mobile;
    if (!mobile) {
      Alert.alert('Admin mobile not found');
      return;
    }
    void (async () => {
      setUnlockBusy(true);
      try {
        const res = await secureApi<unknown>('users.sendBlockOtp', { mobile });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Failed to send OTP');
          return;
        }
        setUnlockOtpSent(true);
        Alert.alert('OTP sent successfully');
      } finally {
        setUnlockBusy(false);
      }
    })();
  }, [admin]);

  const verifyUnlockOtp = useCallback(() => {
    const mobile = admin?.mobile;
    if (!mobile) {
      Alert.alert('Admin mobile not found');
      return;
    }
    if (unlockOtp.trim().length !== 4) {
      Alert.alert('OTP must be 4 digits');
      return;
    }
    void (async () => {
      setUnlockBusy(true);
      try {
        const res = await secureApi<unknown>('users.verifyBlockOtp', {
          mobile,
          otp: Number(unlockOtp.trim()),
        });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Invalid OTP');
          return;
        }
        setNightLocked(false);
        setUnlockOpen(false);
        setUnlockOtpSent(false);
        setUnlockOtp('');
        if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
        unlockTimerRef.current = setTimeout(() => {
          unlockTimerRef.current = null;
          setNightLocked(isKycNightHours());
        }, NIGHT_UNLOCK_MS);
        Alert.alert('KYC actions unlocked for 1 minute');
      } finally {
        setUnlockBusy(false);
      }
    })();
  }, [admin, unlockOtp]);

  // ---- OTP send (shared) ----
  const sendKycOtp = useCallback(async (row: KycRow, sendOTPToClient: boolean) => {
    const res = await secureApi<unknown>('ops.kycSendOtp', {
      sendOTPToClient,
      mobile: row.mobile,
      clientName: row.clientName,
    });
    if (apiFailed(res)) {
      Alert.alert(res.message || 'Failed to send OTP');
      return false;
    }
    return true;
  }, []);

  // ---- Approve (2-step) ----
  const [approveTarget, setApproveTarget] = useState<KycRow | null>(null);
  const [approveStep, setApproveStep] = useState<'details' | 'otp'>('details');
  const [approveForm, setApproveForm] = useState<ApproveForm>(EMPTY_APPROVE);
  const [busy, setBusy] = useState(false);

  const openApprove = useCallback((row: KycRow) => {
    setSheetRow(null);
    setApproveTarget(row);
    setApproveStep('details');
    setApproveForm({
      ...EMPTY_APPROVE,
      accountNumber: row.accountNumber || '',
      ifsc: row.ifsc || '',
      aadhaarNumber: row.aadhaarNumber || '',
      upiId: row.upiId || '',
    });
  }, []);

  const submitApprove = useCallback(() => {
    const row = approveTarget;
    if (!row?._id) return;
    void (async () => {
      if (approveStep === 'details') {
        const f = approveForm;
        if (!f.accountNumber.trim()) return Alert.alert('Enter Correct Bank Account Number');
        if (!f.aadhaarNumber.trim()) return Alert.alert('Enter Correct Aadhar Number');
        if (!f.ifsc.trim()) return Alert.alert('Enter Correct IFSC Number');
        if (!f.upiId.trim()) return Alert.alert('Enter Correct UPI ID');
        setBusy(true);
        try {
          const bankRes = await secureApi<unknown>('ops.kycApprove', {
            accountNumber: f.accountNumber.trim(),
            ifsc: f.ifsc.trim(),
            aadhaarNumber: f.aadhaarNumber.trim(),
            _clientName: row.clientName,
          });
          if (apiFailed(bankRes)) {
            Alert.alert(bankRes.message || 'KYC bank verification failed');
            return;
          }
          const upiRes = await secureApi<unknown>('ops.kycVerifyUpi', {
            upiId: f.upiId.trim(),
            _clientName: row.clientName,
          });
          if (apiFailed(upiRes)) {
            Alert.alert(upiRes.message || 'UPI verification failed');
            return;
          }
          const otpOk = await sendKycOtp(row, false);
          if (!otpOk) return;
          Alert.alert('OTP sent successfully');
          setApproveStep('otp');
        } finally {
          setBusy(false);
        }
        return;
      }
      // step 'otp'
      const f = approveForm;
      if (!f.otp.trim() || !f.kycAdminOtp.trim()) {
        Alert.alert('Please enter Customer OTP and Admin OTP');
        return;
      }
      if (!/^\d{6}$/.test(f.otp.trim())) {
        Alert.alert('Please enter a valid 6 digit OTP');
        return;
      }
      if (!f.comment.trim()) {
        Alert.alert('Please enter Comment');
        return;
      }
      setBusy(true);
      try {
        const res = await secureApi<unknown>('ops.kycAdminOtp', {
          accountNumber: f.accountNumber.trim(),
          otp: f.otp.trim(),
          aadhaarNumber: f.aadhaarNumber.trim(),
          _id: row._id,
          upiId: f.upiId.trim(),
          kycAdminOtp: f.kycAdminOtp.trim(),
          currentKycNote: f.comment.trim(),
          mobile: row.mobile,
          clientName: row.clientName,
          updatedBy: updatedBy(),
        });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Failed to approve KYC');
          return;
        }
        Alert.alert('KYC approved successfully');
        setApproveTarget(null);
        void load();
      } finally {
        setBusy(false);
      }
    })();
  }, [approveTarget, approveStep, approveForm, sendKycOtp, updatedBy, load]);

  // ---- Reject ----
  const [rejectTarget, setRejectTarget] = useState<KycRow | null>(null);
  const [rejectOtp, setRejectOtp] = useState('');
  const [rejectAdminOtp, setRejectAdminOtp] = useState('');

  const openReject = useCallback(
    (row: KycRow) => {
      void (async () => {
        setBusy(true);
        try {
          const ok = await sendKycOtp(row, true);
          if (!ok) return;
          setSheetRow(null);
          setRejectTarget(row);
          setRejectOtp('');
          setRejectAdminOtp('');
        } finally {
          setBusy(false);
        }
      })();
    },
    [sendKycOtp],
  );

  const submitReject = useCallback(() => {
    const row = rejectTarget;
    if (!row?._id) return;
    if (!rejectOtp.trim() || !rejectAdminOtp.trim()) {
      Alert.alert('Please enter Customer OTP and Admin OTP');
      return;
    }
    if (!/^\d{4}$/.test(rejectOtp.trim())) {
      Alert.alert('Please enter a valid 4 digit OTP');
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        const res = await secureApi<unknown>('ops.kycReject', {
          _id: row._id,
          mobile: row.mobile,
          clientName: row.clientName,
          otp: rejectOtp.trim(),
          kycAdminOtp: rejectAdminOtp.trim(),
          updatedBy: updatedBy(),
        });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Failed to reject KYC');
          return;
        }
        Alert.alert('KYC rejected successfully');
        setRejectTarget(null);
        void load();
      } finally {
        setBusy(false);
      }
    })();
  }, [rejectTarget, rejectOtp, rejectAdminOtp, updatedBy, load]);

  // ---- Manual KYC update ----
  const [manualTarget, setManualTarget] = useState<KycRow | null>(null);
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);

  const openManual = useCallback(
    (row: KycRow) => {
      void (async () => {
        setBusy(true);
        try {
          const ok = await sendKycOtp(row, true);
          if (!ok) return;
          setSheetRow(null);
          setManualTarget(row);
          setManualForm({
            ...EMPTY_MANUAL,
            accountNumber: row.accountNumber || '',
            aadhaarNumber: row.aadhaarNumber || '',
            upiId: row.upiId || '',
            ifsc: row.ifsc || '',
          });
        } finally {
          setBusy(false);
        }
      })();
    },
    [sendKycOtp],
  );

  const submitManual = useCallback(() => {
    const row = manualTarget;
    if (!row?._id) return;
    const f = manualForm;
    if (!f.otp.trim()) return Alert.alert('Please enter OTP');
    if (!f.kycAdminOtp.trim()) return Alert.alert('Please enter Admin OTP');
    if (!/^\d{4}$/.test(f.otp.trim())) return Alert.alert('Please enter a valid 4 digit OTP');
    if (!f.userBankName.trim()) return Alert.alert('Please enter user bank name');
    if (!f.bankName.trim()) return Alert.alert('Please enter bank name');
    if (!f.accountNumber.trim()) return Alert.alert('Please enter account no');
    if (!f.aadhaarNumber.trim()) return Alert.alert('Please enter aadhar no');
    if (!f.upiId.trim()) return Alert.alert('Please enter UPI ID');
    if (!f.ifsc.trim()) return Alert.alert('Please enter ifsc code');
    if (!f.comment.trim()) return Alert.alert('Please enter Comment');
    void (async () => {
      setBusy(true);
      try {
        const res = await secureApi<unknown>('ops.kycManualUpdate', {
          userId: row._id,
          aadhaarNumber: f.aadhaarNumber.trim(),
          upiId: f.upiId.trim(),
          accountNumber: f.accountNumber.trim(),
          ifsc: f.ifsc.trim(),
          bankName: f.bankName.trim(),
          userBankName: f.userBankName.trim(),
          mobile: row.mobile,
          clientName: row.clientName,
          otp: f.otp.trim(),
          kycAdminOtp: f.kycAdminOtp.trim(),
          currentKycNote: f.comment.trim(),
          updatedBy: updatedBy(),
        });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Failed to save manual KYC update');
          return;
        }
        Alert.alert('Manual KYC updated successfully');
        setManualTarget(null);
        void load();
      } finally {
        setBusy(false);
      }
    })();
  }, [manualTarget, manualForm, updatedBy, load]);

  // ---- Call via dialer (web panel connectToDialer parity) ----
  const connectToDialer = useCallback((row: KycRow) => {
    if (!row.mobile) {
      Alert.alert('No mobile number on file for this user');
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        const res = await fetch('https://api2.ganesha999.com/API/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            list_id: '800001',
            list_name: 'KYC UPDATION',
            campaign_id: 'KYC',
            leads: [
              {
                first_name: row.name ?? '',
                last_name: '',
                phone_number: row.mobile,
                city: '',
                state: '',
                email: row.clientName ?? '',
                comments: row.clientName ?? '',
                province: row._id,
              },
            ],
          }),
        });
        if (!res.ok) {
          Alert.alert('Failed to send call request');
          return;
        }
        Alert.alert('Data sent successfully');
      } catch {
        Alert.alert('Failed to send call request');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // ---- Verify UPI ----
  const verifyUpi = useCallback((row: KycRow) => {
    if (!row.upiId) {
      Alert.alert('No UPI ID on file for this user');
      return;
    }
    void (async () => {
      setBusy(true);
      try {
        const res = await secureApi<unknown>('ops.kycVerifyUpi', {
          upiId: row.upiId,
          _clientName: row.clientName,
        });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'UPI verification failed');
          return;
        }
        Alert.alert('UPI verified successfully');
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // ---- Detail sheet ----
  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const r = sheetRow;
    return [
      { label: 'Name', value: display(r.name) },
      { label: 'Dp Id', value: display(r._id), multiline: true },
      { label: 'Mobile', value: maskMobile(r.mobile, canShowMobile) },
      { label: 'App', value: display(appCodeForName(r.clientName) || r.clientName) },
      {
        label: 'KYC Status',
        value: r.kyc ? 'Verified' : 'Not Verified',
        badgeColor: r.kyc ? '#16a34a' : '#d97706',
      },
      { label: 'Account Number', value: display(r.accountNumber) },
      { label: 'IFSC', value: display(r.ifsc) },
      { label: 'Aadhaar Number', value: display(r.aadhaarNumber) },
      { label: 'UPI Id', value: display(r.upiId), multiline: true },
      { label: 'Bank Name', value: display(r.bankName) },
      { label: 'User Bank Name', value: display(r.userBankName) },
      { label: 'Reject Check By', value: stamp(r.kycRejectCheckBy) },
      { label: 'Manual Check By', value: stamp(r.kycManualCheckBy) },
      { label: 'Registered', value: formatDateTime(r.createdOn) },
    ];
  }, [sheetRow, canShowMobile]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    if (nightLocked) {
      return [
        {
          label: '🔒 KYC locked (8pm–10am) — Unlock via OTP',
          tone: 'warning',
          disabled: busy,
          onPress: () => {
            setSheetRow(null);
            setUnlockOtpSent(false);
            setUnlockOtp('');
            setUnlockOpen(true);
          },
        },
      ];
    }
    return [
      { label: '📞 Call Customer', tone: 'default', disabled: busy, onPress: () => connectToDialer(sheetRow) },
      { label: 'Approve KYC', tone: 'primary', disabled: busy, onPress: () => openApprove(sheetRow) },
      { label: 'Reject KYC', tone: 'warning', disabled: busy, onPress: () => openReject(sheetRow) },
      { label: 'Manual KYC Update', tone: 'default', disabled: busy, onPress: () => openManual(sheetRow) },
      { label: 'Verify UPI', tone: 'default', disabled: busy, onPress: () => verifyUpi(sheetRow) },
    ];
  }, [sheetRow, nightLocked, busy, connectToDialer, openApprove, openReject, openManual, verifyUpi]);

  const setA = useCallback(
    (key: keyof ApproveForm) => (v: string) =>
      setApproveForm((prev) => ({ ...prev, [key]: v })),
    [],
  );
  const setM = useCallback(
    (key: keyof ManualForm) => (v: string) =>
      setManualForm((prev) => ({ ...prev, [key]: v })),
    [],
  );

  const sheetImage = sheetRow ? aadhaarImageUri(sheetRow.aadhaarImageBase64) : null;

  if (!canView) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.empty}>You do not have permission to view KYC.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>KYC</Text>
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
        appClientName={appClientName}
        onAppChange={(v) => {
          setAppClientName(v);
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        searchFields={[
          { key: 'name', label: 'Name' },
          { key: '_id', label: 'Dp Id' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'aadhaarNumber', label: 'Aadhaar' },
          { key: 'accountNumber', label: 'Account No' },
        ]}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={draftSearch}
        onSearchTextChange={setDraftSearch}
        onSearchSubmit={search}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !rows.length ? <Text style={styles.empty}>No KYC records found</Text> : null}

      {rows.map((r, i) => (
        <TouchableOpacity
          key={r._id || String(i)}
          style={styles.card}
          activeOpacity={0.75}
          onPress={() => setSheetRow(r)}
        >
          <View style={styles.cardTop}>
            <Text style={styles.cardName} numberOfLines={1}>
              {display(r.name)}
            </Text>
            <View
              style={[styles.statusPill, { backgroundColor: r.kyc ? '#16a34a' : '#d97706' }]}
            >
              <Text style={styles.statusPillText}>{r.kyc ? 'Verified' : 'Pending'}</Text>
            </View>
          </View>
          <View style={styles.cardGrid}>
            <View style={styles.cardCell}>
              <Text style={styles.cardLabel}>Mobile</Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {maskMobile(r.mobile, canShowMobile)}
              </Text>
            </View>
            <View style={styles.cardCell}>
              <Text style={styles.cardLabel}>App</Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {display(appCodeForName(r.clientName) || r.clientName)}
              </Text>
            </View>
            <View style={styles.cardCell}>
              <Text style={styles.cardLabel}>Account No</Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {display(r.accountNumber)}
              </Text>
            </View>
            <View style={styles.cardCell}>
              <Text style={styles.cardLabel}>Aadhaar</Text>
              <Text style={styles.cardValue} numberOfLines={1}>
                {display(r.aadhaarNumber)}
              </Text>
            </View>
          </View>
          <Text style={styles.cardHint}>Tap for details & actions</Text>
        </TouchableOpacity>
      ))}

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
        imageUri={sheetImage || undefined}
        onClose={() => setSheetRow(null)}
      />

      {/* Night-lock unlock modal */}
      <Modal
        visible={unlockOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !unlockBusy && setUnlockOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Unlock KYC Actions</Text>
            <Text style={styles.modalSub}>
              KYC actions are locked from 8pm to 10am IST. Verify admin OTP to unlock for 1 minute.
            </Text>
            {unlockOtpSent ? (
              <Field label="Admin OTP (4 digit)" value={unlockOtp} onChange={setUnlockOtp} keyboard="numeric" />
            ) : null}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={unlockBusy}
                onPress={() => setUnlockOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, unlockBusy && styles.btnDisabled]}
                disabled={unlockBusy}
                onPress={unlockOtpSent ? verifyUnlockOtp : sendUnlockOtp}
              >
                <Text style={styles.primaryBtnText}>
                  {unlockBusy ? 'Please wait…' : unlockOtpSent ? 'Verify & Unlock' : 'Send OTP'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Approve modal (2-step) */}
      <Modal
        visible={approveTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setApproveTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {approveStep === 'details' ? 'Approve KYC — Verify Details' : 'Approve KYC — Enter OTP'}
              </Text>
              <Text style={styles.modalSub}>
                {display(approveTarget?.name)} · {maskMobile(approveTarget?.mobile, canShowMobile)}
              </Text>

              {approveStep === 'details' ? (
                <>
                  <Field label="Account Number" value={approveForm.accountNumber} onChange={setA('accountNumber')} keyboard="numeric" />
                  <Field label="IFSC" value={approveForm.ifsc} onChange={setA('ifsc')} autoCaps />
                  <Field label="Aadhaar Number" value={approveForm.aadhaarNumber} onChange={setA('aadhaarNumber')} keyboard="numeric" />
                  <Field label="UPI ID" value={approveForm.upiId} onChange={setA('upiId')} />
                </>
              ) : (
                <>
                  <Field label="Customer OTP (6 digit)" value={approveForm.otp} onChange={setA('otp')} keyboard="numeric" />
                  <Field label="Admin OTP" value={approveForm.kycAdminOtp} onChange={setA('kycAdminOtp')} keyboard="numeric" />
                  <Field label="Comment" value={approveForm.comment} onChange={setA('comment')} />
                </>
              )}

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  disabled={busy}
                  onPress={() => setApproveTarget(null)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  disabled={busy}
                  onPress={submitApprove}
                >
                  <Text style={styles.primaryBtnText}>
                    {busy ? 'Please wait…' : approveStep === 'details' ? 'Verify & Send OTP' : 'Approve'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reject modal */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setRejectTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reject KYC</Text>
            <Text style={styles.modalSub}>
              {display(rejectTarget?.name)} · {maskMobile(rejectTarget?.mobile, canShowMobile)}
            </Text>
            <Field label="Customer OTP (4 digit)" value={rejectOtp} onChange={setRejectOtp} keyboard="numeric" />
            <Field label="Admin OTP" value={rejectAdminOtp} onChange={setRejectAdminOtp} keyboard="numeric" />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={busy}
                onPress={() => setRejectTarget(null)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.destructiveBtn, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={submitReject}
              >
                <Text style={styles.primaryBtnText}>{busy ? 'Please wait…' : 'Reject'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Manual KYC modal */}
      <Modal
        visible={manualTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setManualTarget(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Manual KYC Update</Text>
              <Text style={styles.modalSub}>
                {display(manualTarget?.name)} · {maskMobile(manualTarget?.mobile, canShowMobile)}
              </Text>
              <Field label="User Bank Name (name on account)" value={manualForm.userBankName} onChange={setM('userBankName')} />
              <Field label="Bank Name" value={manualForm.bankName} onChange={setM('bankName')} />
              <Field label="Account Number" value={manualForm.accountNumber} onChange={setM('accountNumber')} keyboard="numeric" />
              <Field label="Aadhaar Number" value={manualForm.aadhaarNumber} onChange={setM('aadhaarNumber')} keyboard="numeric" />
              <Field label="UPI ID" value={manualForm.upiId} onChange={setM('upiId')} />
              <Field label="IFSC" value={manualForm.ifsc} onChange={setM('ifsc')} autoCaps />
              <Field label="Customer OTP (4 digit)" value={manualForm.otp} onChange={setM('otp')} keyboard="numeric" />
              <Field label="Admin OTP" value={manualForm.kycAdminOtp} onChange={setM('kycAdminOtp')} keyboard="numeric" />
              <Field label="Comment" value={manualForm.comment} onChange={setM('comment')} />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  disabled={busy}
                  onPress={() => setManualTarget(null)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, busy && styles.btnDisabled]}
                  disabled={busy}
                  onPress={submitManual}
                >
                  <Text style={styles.primaryBtnText}>{busy ? 'Please wait…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard,
  autoCaps,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: 'numeric';
  autoCaps?: boolean;
}) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(v) => onChange(autoCaps ? v.toUpperCase() : v)}
        keyboardType={keyboard === 'numeric' ? 'number-pad' : 'default'}
        autoCapitalize={autoCaps ? 'characters' : 'none'}
        placeholder={label}
        placeholderTextColor={colors.muted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
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
    borderRadius: 999,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
  },
  statusPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(2.5) },
  cardCell: { minWidth: '40%', flexGrow: 1 },
  cardLabel: { color: colors.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  cardValue: { color: colors.foreground, fontSize: 13, marginTop: 2 },
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
  aadhaarImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing(3),
  },
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
  primaryBtn: {
    backgroundColor: '#16a34a',
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    flex: 1,
  },
  destructiveBtn: {
    backgroundColor: '#dc2626',
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    flex: 1,
  },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
});
