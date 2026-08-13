/**
 * Funds — port of desktop FundsPage with full drill-down:
 * main list (funds.upiPaymentApproved) → row popup "View MID" → MID list
 * (desktop FundsMidPage) → tap a MID → transaction list (desktop FundsPayinPage,
 * funds.allPayment { mid, startDate, endDate }) with KPIs and the
 * Automatic / Scanner Add / Scanner Remove selector.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  name: string;
  totalFinalAmount?: number;
  totalTransactionAmount?: number;
  totalCoinRemove?: number;
  mids?: unknown;
  [key: string]: unknown;
};

type MidRow = {
  mid?: string;
  finalAmount?: number;
  transactionAmount?: number;
  coinAdd?: number;
  coinRemove?: number;
  netCoin?: number;
  paymentGatewayCompany?: string;
  [key: string]: unknown;
};

type TxnRow = Record<string, unknown>;

type RequestType = 'automaticDeposit' | 'scanner add' | 'scanner remove';

type SummaryData = {
  totalAmount?: number;
  transactionAmount?: number;
  creditAmount?: number;
  debitAmount?: number;
};

const MAIN_KEYS = new Set(['idx', 'name', 'totalFinalAmount', 'totalTransactionAmount']);

const REQUEST_TYPES: { key: RequestType; label: string }[] = [
  { key: 'automaticDeposit', label: 'Automatic Deposit' },
  { key: 'scanner add', label: 'Scanner Add' },
  { key: 'scanner remove', label: 'Scanner Remove' },
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function roundAmt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return 0;
  return Math.round(num);
}

function formatAmt(value: unknown): string {
  return roundAmt(value).toLocaleString('en-IN');
}

function dt(value: unknown): string {
  if (value == null || value === '') return '—';
  try {
    return `${formatDisplayDate(String(value))} ${formatDisplayTime(String(value))}`;
  } catch {
    return display(value);
  }
}

function getCreatedOn(row: Record<string, unknown>): string {
  return String(row.createdOn ?? row.createdAt ?? row.createAt ?? '');
}

function getUpdatedOn(row: Record<string, unknown>): string {
  return String(row.updatedOn ?? row.updatedAt ?? '');
}

/** Convert a timestamp to its IST calendar day (YYYY-MM-DD), '' if invalid. */
function toIstYmd(value?: string): string {
  if (!value) return '';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  const ist = new Date(time + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

/** Mirror desktop unpackPayload: unwrap a single `.payload` object. */
function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

function formatFundRows(payload: unknown): Row[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).map(([name, data]) =>
    typeof data === 'object' && data !== null
      ? { name, ...(data as Record<string, unknown>) }
      : { name },
  );
}

function normalizeMids(raw: unknown): MidRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is MidRow => !!item && typeof item === 'object');
}

function asRowList(value: unknown): TxnRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TxnRow => !!item && typeof item === 'object' && !Array.isArray(item),
  );
}

export function FundsScreen() {
  // Read once — getSessionUser returns a fresh object each call; using it directly
  // in hook deps retriggers load() every render (infinite API polling).
  const navigation = useNavigation();
  const user = useMemo(() => getSessionUser(), []);
  const canShowTotal = hasPermission(Permissions.show_gateway_and_total);
  const gatewayOnly = hasPermission(Permissions.show_gateway_only);
  const canShowMobile = hasPermission('show_mobile');

  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  // Drill-down state: main → mids → payin.
  const [view, setView] = useState<'main' | 'mids' | 'payin'>('main');
  const [drillName, setDrillName] = useState('');
  const [drillMids, setDrillMids] = useState<MidRow[]>([]);
  const [selectedMid, setSelectedMid] = useState('');

  // Payin (transaction list) state.
  const [payinLoading, setPayinLoading] = useState(false);
  const [payinError, setPayinError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [coins, setCoins] = useState<TxnRow[]>([]);
  const [debitCoins, setDebitCoins] = useState<TxnRow[]>([]);
  const [txnCount, setTxnCount] = useState(0);
  const [creditCount, setCreditCount] = useState(0);
  const [debitCount, setDebitCount] = useState(0);
  const [requestType, setRequestType] = useState<RequestType>('automaticDeposit');
  const [txnSheet, setTxnSheet] = useState<TxnRow | null>(null);
  const payinGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const [fundsRes, depositRes] = await Promise.all([
        secureApi<unknown>('funds.upiPaymentApproved', {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
        }),
        secureApi<unknown>('fundRequests.depositWithdrawal', {
          startDate: startDate || todayIST(),
          endDate: endDate || todayIST(),
        }),
      ]);
      if (gen !== genRef.current) return;

      if (!fundsRes.ok) {
        setError(fundsRes.message || 'Failed to load funds');
        setRows([]);
      } else {
        const payload = unpackPayload(fundsRes.data);
        const formatted = formatFundRows(payload);
        const canShowGateway =
          hasPermission(Permissions.show_gateway_and_total) ||
          hasPermission(Permissions.show_gateway_only);
        const gateways = Array.isArray((user as { gateway?: unknown })?.gateway)
          ? ((user as { gateway?: string[] }).gateway as string[])
          : [];

        let filtered = formatted;
        if (gateways.length > 0) {
          filtered = formatted.filter((item) => gateways.includes(item.name));
        } else if (!canShowGateway) {
          filtered = formatted.filter((item) => item.name !== 'gateway');
        }
        setSheetRow(null);
        setRows(filtered);
      }

      if (depositRes.ok) {
        const dw = unpackPayload(depositRes.data);
        setTotalDeposit(Number(dw.totalDeposit ?? 0));
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPayin = useCallback(
    async (mid: string) => {
      const gen = ++payinGenRef.current;
      setPayinLoading(true);
      setPayinError(null);
      try {
        const requestOnce = () =>
          secureApi<unknown>('funds.allPayment', {
            mid,
            startDate: startDate || todayIST(),
            endDate: endDate || todayIST(),
          });
        let res = await requestOnce();
        // Desktop retries once on timeouts (the report is slow server-side).
        if (
          !res.ok &&
          /timeout|etimedout|econnaborted|abort/i.test(String(res.message || ''))
        ) {
          res = await requestOnce();
        }
        if (gen !== payinGenRef.current) return;
        if (!res.ok) {
          setPayinError(
            res.message || 'Failed to load transactions. Try a shorter date range.',
          );
          setSummary(null);
          setTransactions([]);
          setCoins([]);
          setDebitCoins([]);
          setTxnCount(0);
          setCreditCount(0);
          setDebitCount(0);
          return;
        }
        const payload = unpackPayload(res.data);
        // Diagnostic: surfaces the response shape in tunnel logs.
        console.log(
          `[funds.allPayment] mid=${mid} keys=${JSON.stringify(Object.keys(payload))} ` +
            `dataKeys=${
              res.data && typeof res.data === 'object'
                ? JSON.stringify(Object.keys(res.data as object))
                : typeof res.data
            }`,
        );
        // Tables are nested under payload.data ({ data: {...}, summary: {...} }).
        const inner =
          payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
            ? (payload.data as Record<string, unknown>)
            : payload;
        const txnData =
          inner.transactionData && typeof inner.transactionData === 'object'
            ? (inner.transactionData as Record<string, unknown>)
            : {};
        const coinData =
          inner.coinData && typeof inner.coinData === 'object'
            ? (inner.coinData as Record<string, unknown>)
            : {};
        const debitData =
          inner.debitCoinsData && typeof inner.debitCoinsData === 'object'
            ? (inner.debitCoinsData as Record<string, unknown>)
            : {};
        setSummary(
          payload.summary && typeof payload.summary === 'object'
            ? (payload.summary as SummaryData)
            : null,
        );
        setTransactions(asRowList(txnData.transactions));
        setCoins(asRowList(coinData.coins));
        setDebitCoins(asRowList(debitData.debitCoins));
        setTxnCount(Number(txnData.transactionCount ?? 0) || 0);
        setCreditCount(Number(coinData.creditCount ?? 0) || 0);
        setDebitCount(Number(debitData.debitCount ?? 0) || 0);
      } finally {
        if (gen === payinGenRef.current) setPayinLoading(false);
      }
    },
    [startDate, endDate],
  );

  const openMids = useCallback(
    (row: Row) => {
      const all = normalizeMids(row.mids);
      // Desktop FundsMidPage filters by the user's allowed MIDs.
      const allowed = Array.isArray((user as { mid?: unknown })?.mid)
        ? ((user as { mid?: string[] }).mid as string[])
        : [];
      const mids = allowed.length ? all.filter((m) => allowed.includes(String(m.mid))) : all;
      setDrillName(row.name === 'coinRemove' ? 'Other Removal' : row.name);
      setDrillMids(mids);
      setSheetRow(null);
      setView('mids');
    },
    [user],
  );

  const openPayin = useCallback(
    (mid: string) => {
      setSelectedMid(mid);
      setRequestType('automaticDeposit');
      setTxnSheet(null);
      setView('payin');
      void loadPayin(mid);
    },
    [loadPayin],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: 'Sr No', width: 56, render: (_r, i) => String(i + 1) },
      {
        key: 'name',
        label: 'Name',
        width: 150,
        color: () => colors.primary,
        render: (r) => (r.name === 'coinRemove' ? 'Other Removal' : display(r.name)),
      },
      {
        key: 'totalFinalAmount',
        label: 'Total Amount',
        width: 130,
        align: 'right',
        render: (r) => formatAmt(r.totalFinalAmount),
      },
      {
        key: 'totalTransactionAmount',
        label: 'Automatic',
        width: 120,
        align: 'right',
        render: (r) => formatAmt(r.totalTransactionAmount),
      },
      {
        key: 'totalCoinRemove',
        label: 'Points Remove',
        width: 130,
        align: 'right',
        render: (r) => formatAmt(r.totalCoinRemove),
      },
    ],
    [],
  );

  const midColumns = useMemo<DataTableColumn<MidRow>[]>(
    () => [
      { key: 'idx', label: 'Sr No', width: 56, render: (_r, i) => String(i + 1) },
      {
        key: 'mid',
        label: 'Mid',
        width: 180,
        color: () => (gatewayOnly ? colors.foreground : colors.primary),
        render: (r) => display(r.mid),
      },
      {
        key: 'finalAmount',
        label: 'Final Amount',
        width: 120,
        align: 'right',
        render: (r) => formatAmt(r.finalAmount),
      },
      {
        key: 'transactionAmount',
        label: 'Transaction Amount',
        width: 150,
        align: 'right',
        render: (r) => formatAmt(r.transactionAmount),
      },
      {
        key: 'coinAdd',
        label: 'Scanner Add',
        width: 120,
        align: 'right',
        render: (r) => formatAmt(r.coinAdd),
      },
      {
        key: 'coinRemove',
        label: 'Scanner Remove',
        width: 130,
        align: 'right',
        render: (r) => formatAmt(r.coinRemove),
      },
    ],
    [gatewayOnly],
  );

  const autoColumns = useMemo<DataTableColumn<TxnRow>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'amount', label: 'Amount', width: 90, align: 'right', render: (r) => display(r.amount) },
      { key: 'orderId', label: 'OrderID', width: 180, render: (r) => display(r.orderId) },
      { key: 'userName', label: 'UserName', width: 130, render: (r) => display(r.userName) },
      {
        key: 'userMobile',
        label: 'Mobile',
        width: 110,
        render: (r) =>
          canShowMobile ? display(r.userMobile) : r.userMobile ? '**********' : '—',
      },
      { key: 'userCity', label: 'City', width: 110, render: (r) => display(r.userCity) },
      { key: 'userState', label: 'State', width: 110, render: (r) => display(r.userState) },
      { key: 'userBankName', label: 'User Bank', width: 130, render: (r) => display(r.userBankName) },
      {
        key: 'accountNumber',
        label: 'User Account',
        width: 150,
        render: (r) => display(r.accountNumber ?? r.userAccountNumber ?? r.userAccount),
      },
      {
        key: 'createdOn',
        label: 'Created At',
        width: 150,
        render: (r) => dt(r.createdOn ?? r.createdAt),
      },
      {
        key: 'updatedOn',
        label: 'Updated On',
        width: 150,
        render: (r) => dt(r.updatedOn ?? r.updatedAt),
      },
    ],
    [canShowMobile],
  );

  const scannerColumns = useMemo<DataTableColumn<TxnRow>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'userId', label: 'UserId', width: 200, render: (r) => display(r.userId) },
      { key: 'balance', label: 'Balance', width: 90, align: 'right', render: (r) => display(r.balance) },
      { key: 'reason', label: 'Reason', width: 150, render: (r) => display(r.reason) },
      { key: 'remark', label: 'Remark', width: 200, render: (r) => display(r.remark) },
      // UTR is present on Scanner Add rows only (desktop parity).
      ...(requestType === 'scanner add'
        ? [
            {
              key: 'utr',
              label: 'UTR',
              width: 160,
              render: (r: TxnRow) => display(r.utr),
            } as DataTableColumn<TxnRow>,
          ]
        : []),
      {
        key: 'createdOn',
        label: 'Created At',
        width: 150,
        render: (r) => dt(r.createdOn ?? r.createdAt),
      },
    ],
    [requestType],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const base = columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }));
    const mids = normalizeMids(sheetRow.mids);
    base.push({ label: 'MID Count', value: String(mids.length) });
    return base;
  }, [sheetRow, columns]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const mids = normalizeMids(sheetRow.mids);
    if (!mids.length) return [];
    return [
      {
        label: `View MID (${mids.length})`,
        tone: 'primary',
        onPress: () => openMids(sheetRow),
      },
    ];
  }, [sheetRow, openMids]);

  // Today / Previous Date split by createdAt IST day (mirrors desktop).
  const dateSplitStats = useMemo(() => {
    const referenceDay = endDate || startDate || todayIST();
    const dayOf = (row: TxnRow) => toIstYmd(getCreatedOn(row));
    const sumAmount = (list: TxnRow[]) =>
      list.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const sumBalance = (list: TxnRow[]) =>
      list.reduce((sum, row) => sum + (Number(row.balance) || 0), 0);

    const split = (list: TxnRow[]) => ({
      today: list.filter((r) => dayOf(r) === referenceDay && dayOf(r) !== ''),
      previous: list.filter((r) => dayOf(r) !== referenceDay && dayOf(r) !== ''),
    });
    const txn = split(transactions);
    const cr = split(coins);
    const db = split(debitCoins);
    return {
      todayTotal: sumAmount(txn.today) + sumBalance(cr.today) - sumBalance(db.today),
      todayCount: txn.today.length + cr.today.length + db.today.length,
      previousTotal:
        sumAmount(txn.previous) + sumBalance(cr.previous) - sumBalance(db.previous),
      previousCount: txn.previous.length + cr.previous.length + db.previous.length,
    };
  }, [transactions, coins, debitCoins, startDate, endDate]);

  const downloadSheet = useCallback(async () => {
    let rows: Record<string, unknown>[] = [];
    let sheetName = 'Automatic';
    if (requestType === 'automaticDeposit') {
      rows = transactions.map((r) => ({
        UserId: r.userId,
        Amount: r.amount,
        OrderID: r.orderId,
        UTR: r.utr,
        UserName: r.userName,
        Status: r.status,
        UserMobile: canShowMobile ? r.userMobile : '',
        City: r.userCity,
        State: r.userState,
        UserBankName: r.userBankName,
        UserAccount: r.accountNumber,
        CreatedAt: dt(getCreatedOn(r)),
        UpdatedOn: dt(getUpdatedOn(r)),
      }));
    } else if (requestType === 'scanner add') {
      sheetName = 'ScannerAdd';
      rows = coins.map((r) => ({
        UserId: r.userId,
        Balance: r.balance,
        Reason: r.reason,
        Remark: r.remark,
        UTR: r.utr,
        UserName: r.userName,
        UserMobile: canShowMobile ? r.userMobile : '',
        CreatedAt: dt(getCreatedOn(r)),
        UpdatedOn: dt(getUpdatedOn(r)),
      }));
    } else {
      sheetName = 'ScannerRemove';
      rows = debitCoins.map((r) => ({
        UserId: r.userId,
        Balance: r.balance,
        Reason: r.reason,
        Remark: r.remark,
        UTR: r.utr,
        UserName: r.userName,
        UserMobile: canShowMobile ? r.userMobile : '',
        CreatedAt: dt(getCreatedOn(r)),
        UpdatedOn: dt(getUpdatedOn(r)),
      }));
    }
    if (!rows.length) {
      setPayinError('No data to export');
      return;
    }
    try {
      const fileUri = `${FileSystem.cacheDirectory}${sheetName.toLowerCase()}_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, toCsv(rows));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `${sheetName} sheet`,
        });
      } else {
        setPayinError('Sharing is not available on this device');
      }
    } catch (err) {
      setPayinError(err instanceof Error ? err.message : 'Failed to export sheet');
    }
  }, [requestType, transactions, coins, debitCoins, canShowMobile]);

  const payinRows =
    requestType === 'scanner add' ? coins : requestType === 'scanner remove' ? debitCoins : transactions;
  const payinColumns = requestType === 'automaticDeposit' ? autoColumns : scannerColumns;
  const payinMainKeys =
    requestType === 'automaticDeposit'
      ? ['idx', 'amount', 'userName', 'createdOn']
      : ['idx', 'balance', 'reason', 'createdOn'];

  // ---------- MID list view ----------
  if (view === 'mids') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity onPress={() => setView('main')}>
          <Text style={styles.backLink}>‹ Back to Funds</Text>
        </TouchableOpacity>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing(2) }}
        >
          {rows.map((r, i) => {
            const label = r.name === 'coinRemove' ? 'Other Removal' : String(r.name);
            const active = label === drillName;
            return (
              <TouchableOpacity
                key={`${r.name}-${i}`}
                style={[styles.chip, active && styles.chipActive, { marginRight: spacing(1.5) }]}
                onPress={() => {
                  if (!active) openMids(r);
                }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.title}>{drillName} — MIDs</Text>
        <Text style={styles.sub}>
          {startDate} → {endDate} · {drillMids.length} MIDs
          {gatewayOnly ? ' · Gateway-only access — MID details are locked' : ''}
        </Text>
        <DataTable
          columns={midColumns}
          rows={drillMids}
          keyFor={(r, i) => `${r.mid}-${i}`}
          emptyMessage="No MIDs"
          onRowPress={(row) => {
            if (gatewayOnly) return;
            const midId = String(row.mid || '').trim();
            if (midId) openPayin(midId);
          }}
          hint={gatewayOnly ? undefined : 'Tap a MID to see its transactions'}
        />
      </ScrollView>
    );
  }

  // ---------- Payin (transaction list) view ----------
  if (view === 'payin') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={payinLoading}
            onRefresh={() => void loadPayin(selectedMid)}
            tintColor={colors.primary}
          />
        }
      >
        <TouchableOpacity onPress={() => setView('mids')}>
          <Text style={styles.backLink}>‹ Back to MIDs</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{selectedMid}</Text>
        <Text style={styles.sub}>
          {drillName} · {startDate} → {endDate}
        </Text>

        <View style={styles.kpiWrap}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiText}>Total Amount: {formatAmt(summary?.totalAmount)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiText}>
              Today Total: {formatAmt(dateSplitStats.todayTotal)} ({dateSplitStats.todayCount})
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiText}>
              Previous Date Total: {formatAmt(dateSplitStats.previousTotal)} (
              {dateSplitStats.previousCount})
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiText}>
              Transaction Amount: {formatAmt(summary?.transactionAmount)} ({txnCount})
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiText}>
              Scanner Add: {formatAmt(summary?.creditAmount)} ({creditCount})
            </Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiText}>
              Scanner Remove: {formatAmt(summary?.debitAmount)} ({debitCount})
            </Text>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {REQUEST_TYPES.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, requestType === t.key && styles.chipActive]}
              onPress={() => {
                setRequestType(t.key);
                setTxnSheet(null);
              }}
            >
              <Text style={[styles.chipText, requestType === t.key && styles.chipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.chip, styles.downloadChip]}
            onPress={() => void downloadSheet()}
          >
            <Text style={styles.downloadChipText}>⬇ Download Sheet</Text>
          </TouchableOpacity>
        </View>

        {payinError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{payinError}</Text>
          </View>
        ) : null}

        <DataTable
          columns={payinColumns.filter((c) => payinMainKeys.includes(c.key))}
          rows={payinRows}
          keyFor={(r, i) => String(r._id || r.orderId || i)}
          loading={payinLoading}
          emptyMessage="No transactions"
          onRowPress={(row) => setTxnSheet(row)}
          hint="Tap a row to see all details"
        />

        <RowDetailSheet
          visible={txnSheet !== null}
          title={
            txnSheet
              ? requestType === 'automaticDeposit'
                ? display(txnSheet.userName)
                : display(txnSheet.userId)
              : ''
          }
          fields={
            txnSheet
              ? [
                  ...payinColumns
                    .filter((c) => c.key !== 'idx')
                    .map<SheetField>((c) => ({
                      label: c.label,
                      value: c.render(txnSheet, 0),
                      multiline: c.key === 'remark' || c.key === 'orderId',
                    })),
                  // UTR is not a table column for every request type, but always
                  // show it in the detail sheet when the row carries one.
                  ...(payinColumns.some((c) => c.key === 'utr')
                    ? []
                    : [{ label: 'UTR', value: display(txnSheet.utr), multiline: true }]),
                ]
              : []
          }
          onClose={() => setTxnSheet(null)}
        />
      </ScrollView>
    );
  }

  // ---------- Main view ----------
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Funds</Text>

      {canShowTotal ? (
        <View style={styles.totalBox}>
          <Text style={styles.totalText}>Total Deposits: ₹ {formatAmt(totalDeposit)}</Text>
        </View>
      ) : null}

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      <TouchableOpacity
        style={styles.midGroupsBtn}
        onPress={() => {
          const parent = navigation.getParent() as
            | {
                push?: (name: string, params?: object) => void;
                navigate: (name: string, params?: object) => void;
              }
            | undefined;
          const go = (parent?.push ??
            parent?.navigate ??
            ((name: string) =>
              (navigation as { navigate: (n: string) => void }).navigate(name))) as (
            name: string,
          ) => void;
          go('/funds/mid-groups');
        }}
      >
        <Text style={styles.midGroupsBtnText}>MID Groups</Text>
      </TouchableOpacity>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => `${r.name}-${i}`}
        loading={loading}
        emptyMessage="No data"
        onRowPress={(row) => openMids(row)}
        hint="Tap a row to open its MID list"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={
          sheetRow
            ? sheetRow.name === 'coinRemove'
              ? 'Other Removal'
              : display(sheetRow.name)
            : ''
        }
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  backLink: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginBottom: spacing(2),
  },
  totalBox: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  totalText: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  midGroupsBtn: {
    marginTop: spacing(2),
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  midGroupsBtnText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 13,
  },
  kpiWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  kpiBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  kpiText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  downloadChip: { borderColor: colors.primary },
  downloadChipText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
});
