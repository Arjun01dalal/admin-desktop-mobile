/**
 * Fund Request — mobile port of desktop FundRequestPage (/fund-request).
 *
 * Shows the KPI summary buckets (deposit/withdrawal/bonus/casino) as tappable
 * cards; tapping a drillable KPI loads the matching transaction list
 * (fundRequests.transactions) as cards with status/user/amount/app filters.
 * Pending deposit rows can have their status changed (deposits.updateStatus)
 * when the admin has the Deposit_Pensil permission.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CLIENT_NAMES, appCodeForName, asPaged, unpackPayload } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar, PAGE_SIZE_OPTIONS } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

// ---- summary payload shapes (desktop transactions/shared.ts parity) ----

type FundSummaryBucket = { count?: number; totalAmount?: number };

type DepositFundSummary = {
  depositData?: {
    depositApprovedCount?: number;
    depositApprovedTotal?: number;
    depositPendingCount?: number;
    depositPendingTotal?: number;
  };
  uniquePendingDetail?: { pendingCount?: number; pendingAmount?: number };
  appDeposit?: { appUserDepositSum?: number; appuserDepositCount?: number };
  depositUserDetail?: {
    oldUserDepositSum?: number;
    oldUserDepositCount?: number;
    newUserDepositSum?: number;
    newUserDepositCount?: number;
  };
  coinScannerData?: { totalscannerDepositCount?: number; totalscannerDepositAmount?: number };
  WithdrawalData?: {
    totalApprovedAmount?: number;
    totalApprovedCount?: number;
    todaysTotalApprovedAmount?: number;
    todaysTotalApprovedCount?: number;
    previousTotalApprovedAmount?: number;
    previousTotalApprovedCount?: number;
    totalPendingAmount?: number;
    totalPendingCount?: number;
    totalRejectedAmount?: number;
    totalRejectedCount?: number;
    totalReversedAmount?: number;
    totalReversedCount?: number;
    totalOnholdAmount?: number;
    totalOnholdCount?: number;
    totalCanceledAmount?: number;
    totalCanceledCount?: number;
  };
  depositePendingData?: FundSummaryBucket;
  totalApprovedWithdrawalData?: FundSummaryBucket;
  totalPendingWithdrawalData?: FundSummaryBucket;
  totalReverseWithdrawalData?: FundSummaryBucket;
  totalWithdrawalRejected?: FundSummaryBucket;
};

type FundRequestCoinSummary = {
  coinData?: {
    totalcasinoCredit?: number;
    totalcasinoCreditCount?: number;
    totalexchangeCredit?: number;
    totalexchangeCreditCount?: number;
    totalscannerDepositCount?: number;
  };
};

type BonusWalletSummary = {
  totalAmountTransferToMainWallet?: number;
  totalCountTransferToMainWallet?: number;
  totalBonusWallet?: number;
  totalBonusWalletCount?: number;
};

type TxnRow = {
  _id?: string;
  userId?: string;
  dp_id?: string;
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
  orderId?: string;
  transactionId?: string;
  paymentGatewayName?: string;
  mid?: string | number;
  reason?: string;
  createdOn?: string;
  userBankName?: string;
  bankName?: string;
  accountNumber?: string;
  accountNo?: string;
  ifsc?: string;
  IfscCode?: string;
  withdrewalProviderName?: string;
};

type DrillType = 'deposit' | 'withdrawal';

const DEPOSIT_STATUSES = ['', 'Pending', 'Approved', 'Rejected', 'Reverse', 'on hold', 'Processing'] as const;
const WITHDRAWAL_STATUSES = [
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

type KpiTone = 'green' | 'blue' | 'yellow' | 'orange' | 'red' | 'gray';
const TONE_COLOR: Record<KpiTone, string> = {
  green: '#16a34a',
  blue: '#2563eb',
  yellow: '#d97706',
  orange: '#ff9f0a',
  red: '#dc2626',
  gray: '#8e8e93',
};

function apiFailed(res: { ok: boolean; success?: boolean }): boolean {
  return !res.ok || res.success === false;
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(mobile: unknown, show: boolean): string {
  const m = mobile == null ? '' : String(mobile);
  if (!m) return '—';
  return show ? m : `${'*'.repeat(Math.max(0, m.length - 4))}${m.slice(-4)}`;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function withdrawalBucket(
  summary: DepositFundSummary,
  countKey: keyof NonNullable<DepositFundSummary['WithdrawalData']>,
  amountKey: keyof NonNullable<DepositFundSummary['WithdrawalData']>,
  nested?: FundSummaryBucket,
): FundSummaryBucket {
  const w = summary.WithdrawalData;
  return {
    count: num(w?.[countKey] ?? nested?.count),
    totalAmount: num(w?.[amountKey] ?? nested?.totalAmount),
  };
}

export function FundRequestScreen() {
  const canViewDeposit =
    hasPermission('View_Fund_Deposit') || hasPermission('View_Deposits') || hasPermission('Fund_Request');
  const canViewWithdrawal = hasPermission('View_Withdrawals') || hasPermission('Fund_Request');
  const canPencil = hasPermission('Deposit_Pensil');
  const canShowMobile = hasPermission('show_mobile');
  const canViewBonusWallet = hasPermission('Bonus_Wallet_Fund_Request');
  const admin = useMemo(() => getSessionUser() as { _id?: string; name?: string } | null, []);

  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allData, setAllData] = useState(false);
  const [summary, setSummary] = useState<DepositFundSummary>({});
  const [coinSummary, setCoinSummary] = useState<FundRequestCoinSummary>({});
  const [bonusSummary, setBonusSummary] = useState<BonusWalletSummary>({});
  const [holdWithdrawal, setHoldWithdrawal] = useState<FundSummaryBucket>({});
  const [depositWithdrawTotal, setDepositWithdrawTotal] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [drillType, setDrillType] = useState<DrillType | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [userNameFilter, setUserNameFilter] = useState('');
  const [amountFilter, setAmountFilter] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tableLoading, setTableLoading] = useState(false);
  const [sheetRow, setSheetRow] = useState<TxnRow | null>(null);
  /** When true, the drill-down transaction list is shown as its own full page. */
  const [drillOpen, setDrillOpen] = useState(false);

  const [editRow, setEditRow] = useState<TxnRow | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  /** Generation guards: discard responses from superseded requests. */
  const summaryGenRef = React.useRef(0);
  const drillGenRef = React.useRef(0);

  const loadSummary = useCallback(
    async (opts?: { allData?: boolean }) => {
      const useAll = opts?.allData ?? allData;
      const gen = ++summaryGenRef.current;
      setSummaryLoading(true);
      try {
        const datePayload = useAll
          ? {}
          : { startDate: startDate || todayIST(), endDate: endDate || todayIST() };
        const bonusPayload = useAll
          ? { allData: true }
          : { startDate: startDate || todayIST(), endDate: endDate || todayIST(), allData: false };

        const [sumRes, coinRes, holdRes, bonusRes, dwRes] = await Promise.all([
          secureApi<unknown>('fundRequests.summary', datePayload),
          secureApi<unknown>('fundRequests.coin', datePayload),
          secureApi<unknown>('fundRequests.withdrawalHold', datePayload),
          canViewBonusWallet
            ? secureApi<unknown>('bonusWallet.fundRequestSummary', bonusPayload)
            : Promise.resolve({ ok: true as const, data: {} as unknown }),
          secureApi<unknown>('fundRequests.depositWithdrawal', datePayload),
        ]);

        if (gen !== summaryGenRef.current) return;

        if (apiFailed(sumRes)) {
          Alert.alert(sumRes.message || 'Failed to load fund request summary');
          setSummary({});
        } else {
          setSummary(unpackPayload(sumRes.data) as DepositFundSummary);
        }
        setCoinSummary(!apiFailed(coinRes) ? (unpackPayload(coinRes.data) as FundRequestCoinSummary) : {});
        if (!apiFailed(holdRes)) {
          const body = unpackPayload(holdRes.data);
          setHoldWithdrawal({
            count: num(body.count ?? body.totalCount),
            totalAmount: num(body.totalAmount),
          });
        } else {
          setHoldWithdrawal({});
        }
        setBonusSummary(!apiFailed(bonusRes) ? (unpackPayload(bonusRes.data) as BonusWalletSummary) : {});
        setDepositWithdrawTotal(!apiFailed(dwRes) ? num(unpackPayload(dwRes.data).totalDeposit) : 0);
        setAllData(useAll);
      } finally {
        if (gen === summaryGenRef.current) setSummaryLoading(false);
      }
    },
    [allData, startDate, endDate, canViewBonusWallet],
  );

  const loadTransactions = useCallback(
    async (opts: {
      type: DrillType;
      status: string;
      userName: string;
      amount: string;
      clientName: string;
      pageNo: number;
      itemsPerPage: number;
      useAll: boolean;
    }) => {
      const gen = ++drillGenRef.current;
      setTableLoading(true);
      try {
        const filter: Record<string, unknown> = {};
        if (opts.status) filter.status = opts.status;
        if (opts.userName.trim()) filter.userName = opts.userName.trim();
        if (opts.amount.trim()) filter.amount = opts.amount.trim();
        if (opts.clientName) filter.clientName = opts.clientName;

        const payload: Record<string, unknown> = {
          type: opts.type,
          itemsPerPage: opts.itemsPerPage,
          pageNo: opts.pageNo,
          filter,
        };
        if (!opts.useAll) {
          payload.startDate = startDate || todayIST();
          payload.endDate = endDate || todayIST();
        }

        const res = await secureApi<unknown>('fundRequests.transactions', payload);
        if (gen !== drillGenRef.current) return;
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Failed to load transactions');
          setRows([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }
        const paged = asPaged<TxnRow>(res.data);
        setRows(paged.rows);
        setTotal(paged.total);
        setTotalPages(Math.max(1, paged.totalPages));
      } finally {
        if (gen === drillGenRef.current) setTableLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    void loadSummary({ allData: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const reloadDrill = useCallback(
    (overrides?: Partial<{ status: string; pageNo: number; itemsPerPage: number; type: DrillType }>) => {
      const type = overrides?.type ?? drillType;
      if (!type) return;
      void loadTransactions({
        type,
        status: overrides?.status ?? statusFilter,
        userName: userNameFilter,
        amount: amountFilter,
        clientName: type === 'deposit' ? appFilter : '',
        pageNo: overrides?.pageNo ?? page,
        itemsPerPage: overrides?.itemsPerPage ?? pageSize,
        useAll: allData,
      });
    },
    [drillType, statusFilter, userNameFilter, amountFilter, appFilter, page, pageSize, allData, loadTransactions],
  );

  const openDrill = useCallback(
    (type: DrillType, status: string) => {
      setDrillType(type);
      setStatusFilter(status);
      setUserNameFilter('');
      setAmountFilter('');
      setAppFilter('');
      setPage(1);
      setDrillOpen(true);
      void loadTransactions({
        type,
        status,
        userName: '',
        amount: '',
        clientName: '',
        pageNo: 1,
        itemsPerPage: pageSize,
        useAll: allData,
      });
    },
    [pageSize, allData, loadTransactions],
  );

  const goPage = useCallback(
    (next: number) => {
      setPage(next);
      reloadDrill({ pageNo: next });
    },
    [reloadDrill],
  );

  // ---- KPI buckets ----
  const scannerCount = num(
    summary.coinScannerData?.totalscannerDepositCount ?? coinSummary.coinData?.totalscannerDepositCount,
  );
  const depositApproved: FundSummaryBucket = {
    count: num(summary.depositData?.depositApprovedCount) + scannerCount,
    totalAmount: depositWithdrawTotal || num(summary.depositData?.depositApprovedTotal),
  };
  const depositPending: FundSummaryBucket = summary.depositePendingData &&
    (summary.depositePendingData.count != null || summary.depositePendingData.totalAmount != null)
    ? summary.depositePendingData
    : {
        count: num(summary.depositData?.depositPendingCount),
        totalAmount: num(summary.depositData?.depositPendingTotal),
      };
  const uniquePending: FundSummaryBucket = {
    count: num(summary.uniquePendingDetail?.pendingCount),
    totalAmount: num(summary.uniquePendingDetail?.pendingAmount),
  };
  const appDeposit: FundSummaryBucket = {
    count: num(summary.appDeposit?.appuserDepositCount),
    totalAmount: Math.round(num(summary.appDeposit?.appUserDepositSum)),
  };
  const newUserDeposit: FundSummaryBucket = {
    count: num(summary.depositUserDetail?.newUserDepositCount),
    totalAmount: Math.round(num(summary.depositUserDetail?.newUserDepositSum)),
  };
  const oldUserDeposit: FundSummaryBucket = {
    count: num(summary.depositUserDetail?.oldUserDepositCount),
    totalAmount: Math.round(num(summary.depositUserDetail?.oldUserDepositSum)),
  };
  const transferMainWallet: FundSummaryBucket = {
    count: num(bonusSummary.totalCountTransferToMainWallet),
    totalAmount: Math.round(num(bonusSummary.totalAmountTransferToMainWallet)),
  };
  const totalBonusWallet: FundSummaryBucket = {
    count: num(bonusSummary.totalBonusWalletCount),
    totalAmount: Math.round(num(bonusSummary.totalBonusWallet)),
  };
  const wApproved = withdrawalBucket(summary, 'totalApprovedCount', 'totalApprovedAmount', summary.totalApprovedWithdrawalData);
  const wTodayApproved = withdrawalBucket(summary, 'todaysTotalApprovedCount', 'todaysTotalApprovedAmount');
  const wOldApproved = withdrawalBucket(summary, 'previousTotalApprovedCount', 'previousTotalApprovedAmount');
  const wPending = withdrawalBucket(summary, 'totalPendingCount', 'totalPendingAmount', summary.totalPendingWithdrawalData);
  const wRejected = withdrawalBucket(summary, 'totalRejectedCount', 'totalRejectedAmount', summary.totalWithdrawalRejected);
  const wReverse = withdrawalBucket(summary, 'totalReversedCount', 'totalReversedAmount', summary.totalReverseWithdrawalData);
  const wCanceled = withdrawalBucket(summary, 'totalCanceledCount', 'totalCanceledAmount');
  const wOnHold: FundSummaryBucket = {
    count: holdWithdrawal.count ?? num(summary.WithdrawalData?.totalOnholdCount),
    totalAmount: holdWithdrawal.totalAmount ?? num(summary.WithdrawalData?.totalOnholdAmount),
  };
  const casinoDeposit: FundSummaryBucket = {
    count: num(coinSummary.coinData?.totalcasinoCreditCount),
    totalAmount: num(coinSummary.coinData?.totalcasinoCredit),
  };
  const jetfairDeposit: FundSummaryBucket = {
    count: num(coinSummary.coinData?.totalexchangeCreditCount),
    totalAmount: num(coinSummary.coinData?.totalexchangeCredit),
  };

  type KpiItem = {
    key: string;
    label: string;
    bucket: FundSummaryBucket;
    tone: KpiTone;
    show?: boolean;
    active?: boolean;
    onPress?: () => void;
  };

  const kpiItems: KpiItem[] = [
    { key: 'dep-approved', label: 'Deposit Approved', bucket: depositApproved, tone: 'green', show: canViewDeposit, active: drillType === 'deposit' && statusFilter === 'Approved', onPress: () => openDrill('deposit', 'Approved') },
    { key: 'app-dep', label: 'App Deposit Approved', bucket: appDeposit, tone: 'green', show: canViewDeposit },
    { key: 'new-user', label: 'New User Deposit', bucket: newUserDeposit, tone: 'green', show: canViewDeposit },
    { key: 'old-user', label: 'Old User Deposit', bucket: oldUserDeposit, tone: 'green', show: canViewDeposit },
    { key: 'transfer-main', label: 'Transfer to Main Wallet', bucket: transferMainWallet, tone: 'green', show: canViewBonusWallet },
    { key: 'w-hold', label: 'Withdrawal on Hold', bucket: wOnHold, tone: 'blue', show: canViewWithdrawal, active: drillType === 'withdrawal' && statusFilter === 'on hold', onPress: () => openDrill('withdrawal', 'on hold') },
    { key: 'w-approved', label: 'Withdrawal Approved', bucket: wApproved, tone: 'blue', show: canViewWithdrawal, active: drillType === 'withdrawal' && statusFilter === 'Approved', onPress: () => openDrill('withdrawal', 'Approved') },
    { key: 'w-today', label: "Today's Withdrawal Approved", bucket: wTodayApproved, tone: 'blue', show: canViewWithdrawal, onPress: () => openDrill('withdrawal', 'Approved') },
    { key: 'w-old', label: 'Old Withdrawal Approved', bucket: wOldApproved, tone: 'blue', show: canViewWithdrawal, onPress: () => openDrill('withdrawal', 'Approved') },
    { key: 'unique', label: 'Unique Deposit Pending', bucket: uniquePending, tone: 'yellow', show: canViewDeposit },
    { key: 'dep-pending', label: 'Total Deposit Pending', bucket: depositPending, tone: 'yellow', show: canViewDeposit, active: drillType === 'deposit' && statusFilter === 'Pending', onPress: () => openDrill('deposit', 'Pending') },
    { key: 'w-pending', label: 'Withdrawal Pending', bucket: wPending, tone: 'yellow', show: canViewWithdrawal, active: drillType === 'withdrawal' && statusFilter === 'Pending', onPress: () => openDrill('withdrawal', 'Pending') },
    { key: 'bonus', label: 'Total Bonus Wallet', bucket: totalBonusWallet, tone: 'orange', show: canViewBonusWallet },
    { key: 'w-reverse', label: 'Withdrawal Reverse', bucket: wReverse, tone: 'orange', show: canViewWithdrawal, active: drillType === 'withdrawal' && statusFilter === 'Reverse', onPress: () => openDrill('withdrawal', 'Reverse') },
    { key: 'w-rejected', label: 'Withdrawal Rejected', bucket: wRejected, tone: 'red', show: canViewWithdrawal, active: drillType === 'withdrawal' && statusFilter === 'Rejected', onPress: () => openDrill('withdrawal', 'Rejected') },
    { key: 'w-cancel', label: 'Withdrawal Cancelled', bucket: wCanceled, tone: 'red', show: canViewWithdrawal, active: drillType === 'withdrawal' && statusFilter === 'Cancel', onPress: () => openDrill('withdrawal', 'Cancel') },
    { key: 'casino', label: 'Total Casino Deposit', bucket: casinoDeposit, tone: 'gray', show: canViewDeposit },
    { key: 'jetfair', label: 'Total Jetfair Deposit', bucket: jetfairDeposit, tone: 'gray', show: canViewDeposit },
  ];

  const statusOptions = drillType === 'withdrawal' ? WITHDRAWAL_STATUSES : DEPOSIT_STATUSES;

  // ---- edit deposit status ----
  const submitEdit = useCallback(() => {
    if (!editRow) return;
    if (!editStatus.trim()) {
      Alert.alert('Select a status');
      return;
    }
    void (async () => {
      setEditSaving(true);
      try {
        const res = await secureApi<unknown>('deposits.updateStatus', {
          orderId: editRow.orderId,
          status: editStatus.trim(),
          reason: editRemark.trim(),
          updatedBy: { name: admin?.name || '', _id: admin?._id || '' },
        });
        if (apiFailed(res)) {
          Alert.alert(res.message || 'Failed to update status');
          return;
        }
        Alert.alert(res.message || 'Status updated');
        setEditRow(null);
        reloadDrill();
        void loadSummary();
      } finally {
        setEditSaving(false);
      }
    })();
  }, [editRow, editStatus, editRemark, admin, reloadDrill, loadSummary]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const r = sheetRow;
    const gw = display(r.paymentGatewayName);
    const mid = r.mid != null && r.mid !== '' ? String(r.mid) : '';
    const base: SheetField[] = [
      { label: 'User', value: display(r.userName) },
      { label: 'Mobile', value: maskMobile(r.userMobile || r.mobile, canShowMobile) },
      { label: 'App', value: display(appCodeForName(r.clientName) || r.clientName) },
      { label: 'Amount', value: display(r.amount) },
      {
        label: 'Status',
        value: display(r.status),
        badgeColor:
          String(r.status || '').toLowerCase() === 'approved'
            ? '#16a34a'
            : String(r.status || '').toLowerCase() === 'pending'
              ? '#d97706'
              : String(r.status || '').toLowerCase() === 'rejected'
                ? '#dc2626'
                : '#2563eb',
      },
      { label: 'State', value: display(r.userState || r.state) },
      { label: 'City', value: display(r.userCity || r.city) },
      { label: 'Txn Id', value: display(r.orderId || r.transactionId), multiline: true },
      { label: 'Date', value: `${formatDisplayDate(r.createdOn) || '—'} ${formatDisplayTime(r.createdOn) || ''}` },
    ];
    if (drillType === 'withdrawal') {
      base.push(
        { label: 'Bank', value: display(r.userBankName || r.bankName) },
        { label: 'DP Id', value: display(r.userId || r.dp_id), multiline: true },
        { label: 'Account', value: display(r.accountNumber || r.accountNo) },
        { label: 'IFSC', value: display(r.ifsc || r.IfscCode) },
        { label: 'Provider', value: display(r.withdrewalProviderName) },
      );
    } else {
      base.push(
        { label: 'Gateway-Mid', value: gw === '—' && !mid ? '—' : mid ? `${gw}-${mid}` : gw },
        { label: 'Reason', value: display(r.reason), multiline: true },
      );
    }
    return base;
  }, [sheetRow, drillType, canShowMobile]);

  if (!canViewDeposit && !canViewWithdrawal) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.empty}>You do not have permission to view Fund Requests.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing(3), paddingBottom: spacing(10) }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={summaryLoading}
          onRefresh={() => {
            void loadSummary({ allData });
            reloadDrill();
          }}
        />
      }
    >
      {!drillOpen ? (
        <>
          <DetailFilterBar
            startDate={startDate}
            endDate={endDate}
            loading={summaryLoading}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onApply={() => {
              void loadSummary({ allData: false });
              reloadDrill();
            }}
          />
          <TouchableOpacity
            style={styles.allDataBtn}
            disabled={summaryLoading}
            onPress={() => void loadSummary({ allData: true })}
          >
            <Text style={styles.allDataText}>{allData ? '✓ All Data (active)' : 'All Data'}</Text>
          </TouchableOpacity>

          <View style={styles.kpiGrid}>
            {kpiItems
              .filter((c) => c.show !== false)
              .map((c) => {
                const color = TONE_COLOR[c.tone];
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.kpiCard, { borderColor: c.active ? color : colors.border }]}
                    activeOpacity={c.onPress ? 0.7 : 1}
                    onPress={c.onPress}
                    disabled={!c.onPress || summaryLoading}
                  >
                    <Text style={[styles.kpiLabel, { color }]} numberOfLines={2}>
                      {c.label}
                    </Text>
                    <Text style={styles.kpiValue}>
                      ({c.bucket.count ?? 0}) : {c.bucket.totalAmount ?? 0}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        </>
      ) : null}

      {drillOpen && drillType ? (
        <View>
          <TouchableOpacity onPress={() => setDrillOpen(false)}>
            <Text style={styles.backLink}>‹ Back to Fund Requests</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>
            {drillType === 'deposit' ? 'Deposit' : 'Withdrawal'} Transactions ({total})
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing(2) }}>
            {statusOptions.map((s) => (
              <TouchableOpacity
                key={s || 'all'}
                style={[styles.chip, statusFilter === s && styles.chipActive]}
                onPress={() => {
                  setStatusFilter(s);
                  setPage(1);
                  reloadDrill({ status: s, pageNo: 1 });
                }}
              >
                <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s || 'All'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.filterRow}>
            <TextInput
              style={styles.input}
              placeholder="User Name"
              placeholderTextColor={colors.muted}
              value={userNameFilter}
              onChangeText={setUserNameFilter}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={amountFilter}
              onChangeText={setAmountFilter}
            />
          </View>
          {drillType === 'deposit' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing(2) }}>
              <TouchableOpacity
                style={[styles.chip, appFilter === '' && styles.chipActive]}
                onPress={() => setAppFilter('')}
              >
                <Text style={[styles.chipText, appFilter === '' && styles.chipTextActive]}>All Apps</Text>
              </TouchableOpacity>
              {CLIENT_NAMES.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.chip, appFilter === name && styles.chipActive]}
                  onPress={() => setAppFilter(name)}
                >
                  <Text style={[styles.chipText, appFilter === name && styles.chipTextActive]}>
                    {appCodeForName(name)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, pageSize === n && styles.chipActive]}
                  onPress={() => {
                    setPageSize(n);
                    setPage(1);
                    reloadDrill({ itemsPerPage: n, pageNo: 1 });
                  }}
                >
                  <Text style={[styles.chipText, pageSize === n && styles.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.applyBtn}
              disabled={tableLoading}
              onPress={() => {
                setPage(1);
                reloadDrill({ pageNo: 1 });
              }}
            >
              <Text style={styles.applyBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>

          {tableLoading ? <Text style={styles.empty}>Loading…</Text> : null}
          {!tableLoading && rows.length === 0 ? <Text style={styles.empty}>No transactions found</Text> : null}

          {rows.map((r, i) => {
            const st = String(r.status || '').toLowerCase();
            const stColor =
              st === 'approved' ? '#16a34a' : st === 'pending' ? '#d97706' : st === 'rejected' || st === 'failed' ? '#dc2626' : '#2563eb';
            return (
              <TouchableOpacity
                key={r._id || r.orderId || String(i)}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => setSheetRow(r)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {display(r.userName)}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: `${stColor}22` }]}>
                    <Text style={[styles.pillText, { color: stColor }]}>{display(r.status)}</Text>
                  </View>
                </View>
                <View style={styles.cardGrid}>
                  <View style={styles.cardCell}>
                    <Text style={styles.cardLabel}>Amount</Text>
                    <Text style={styles.cardValue}>{display(r.amount)}</Text>
                  </View>
                  <View style={styles.cardCell}>
                    <Text style={styles.cardLabel}>App</Text>
                    <Text style={styles.cardValue}>{display(appCodeForName(r.clientName) || r.clientName)}</Text>
                  </View>
                  <View style={styles.cardCell}>
                    <Text style={styles.cardLabel}>Mobile</Text>
                    <Text style={styles.cardValue}>{maskMobile(r.userMobile || r.mobile, canShowMobile)}</Text>
                  </View>
                  <View style={styles.cardCell}>
                    <Text style={styles.cardLabel}>Date</Text>
                    <Text style={styles.cardValue}>{formatDisplayDate(r.createdOn) || '—'}</Text>
                  </View>
                </View>
                {drillType === 'deposit' && st === 'pending' && canPencil ? (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => {
                      setEditRow(r);
                      setEditStatus('');
                      setEditRemark('');
                    }}
                  >
                    <Text style={styles.editBtnText}>✏️ Change Status</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {rows.length > 0 ? (
            <View style={styles.pager}>
              <Text
                style={[styles.pagerBtn, (page <= 1 || tableLoading) && styles.pagerDisabled]}
                onPress={() => page > 1 && !tableLoading && goPage(page - 1)}
              >
                ‹ Prev
              </Text>
              <Text style={styles.pagerLabel}>
                Page {page} / {totalPages}
              </Text>
              <Text
                style={[styles.pagerBtn, (page >= totalPages || tableLoading) && styles.pagerDisabled]}
                onPress={() => page < totalPages && !tableLoading && goPage(page + 1)}
              >
                Next ›
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {!drillOpen ? (
        <Text style={styles.hint}>Kisi bhi card par tap karke uski transactions dekhein.</Text>
      ) : null}

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.userName) : ''}
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />

      {/* Change Deposit Status modal */}
      <Modal
        visible={editRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !editSaving && setEditRow(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Deposit Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing(2) }}>
              {DEPOSIT_STATUSES.filter(Boolean).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, editStatus === s && styles.chipActive]}
                  onPress={() => setEditStatus(s)}
                >
                  <Text style={[styles.chipText, editStatus === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[styles.input, { minHeight: 60 }]}
              placeholder="Remark"
              placeholderTextColor={colors.muted}
              multiline
              value={editRemark}
              onChangeText={setEditRemark}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} disabled={editSaving} onPress={() => setEditRow(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.applyBtn, editSaving && { opacity: 0.6 }]}
                disabled={editSaving}
                onPress={submitEdit}
              >
                <Text style={styles.applyBtnText}>{editSaving ? 'Please wait…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(4) },
  hint: { color: colors.muted, textAlign: 'center', marginTop: spacing(4), fontSize: 12 },
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
  allDataBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginTop: spacing(3),
    marginBottom: spacing(3),
  },
  allDataText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  kpiCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(2.5),
  },
  kpiLabel: { fontSize: 12, fontWeight: '800' },
  kpiValue: { color: colors.foreground, fontSize: 14, fontWeight: '700', marginTop: spacing(1) },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: spacing(2) },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.25),
    marginRight: spacing(1.5),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12 },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(2), alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 13,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  applyBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing(2) },
  cardName: { color: colors.foreground, fontSize: 15, fontWeight: '700', flex: 1, marginRight: spacing(2) },
  pill: { borderRadius: 999, paddingHorizontal: spacing(2.5), paddingVertical: spacing(0.75) },
  pillText: { fontSize: 11, fontWeight: '700' },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  cardCell: { width: '50%', marginBottom: spacing(1.5) },
  cardLabel: { color: colors.muted, fontSize: 11 },
  cardValue: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  editBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#d9770622',
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginTop: spacing(1),
  },
  editBtnText: { color: '#d97706', fontSize: 12, fontWeight: '700' },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(2) },
  pagerBtn: { color: colors.primary, fontWeight: '700', padding: spacing(2) },
  pagerDisabled: { color: colors.muted },
  pagerLabel: { color: colors.foreground, fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(4),
    paddingBottom: spacing(6),
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: spacing(3) },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(2), marginTop: spacing(3) },
  cancelBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  cancelBtnText: { color: colors.foreground, fontSize: 13 },
});
