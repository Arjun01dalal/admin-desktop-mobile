/**
 * User Report / History — opened by tapping a user's name on the Users page.
 * Desktop parity: userReport/* (wallet summary + ledger, game history,
 * fund request deposit/withdrawal/coins). Route params: { userId, userName }.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../dashboards/ui/DataTable';
import { secureApi } from '../api/client';
import { formatDisplayDate } from '../utils/dates';
import { DateField } from '../components/DateField';

type Rec = Record<string, unknown>;

const display = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

function unwrap(data: unknown): Rec {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Rec;
  const nested = obj.payload ?? obj.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as Rec;
  return obj;
}

function listOf(data: unknown, ...keys: string[]): Rec[] {
  if (Array.isArray(data)) return data as Rec[];
  const obj = unwrap(data);
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return [];
}

function pagesOf(data: unknown): number {
  const obj = unwrap(data);
  const n = Number(obj.totalPages ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function when(r: Rec): string {
  const raw = (r.createdOn ?? r.createdAt ?? r.updatedOn) as string | undefined;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return `${formatDisplayDate(raw)} ${d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

const TABS = ['Wallet History', 'Game History', 'Fund Request'] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------ summary card ------------------------------ */

type Summary = {
  totalDeposit: number;
  totalWithdrawal: number;
  balance: number;
  bonusWalletBalance: number;
  pendingWithdrawal: number;
  exposure: number;
  referralEarning: number;
  ownEarning: number;
  approvedBonus: number;
};

function useWalletSummary(userId: string) {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let live = true;
    void (async () => {
      const [wallet, bonus, approved, exposure] = await Promise.all([
        secureApi('userReport.walletHistory', {
          itemsPerPage: 1,
          pageNo: 1,
          filter: { userId },
        }),
        secureApi('userReport.bonusTotalEarning', { userId, itemsPerPage: 10, pageNo: 1 }),
        secureApi('userReport.bonusApprovedTotal', { userId }),
        secureApi('userReport.userExposure', { _id: userId }),
      ]);
      if (!live) return;
      const w = unwrap(wallet.ok ? wallet.data : {});
      const b = unwrap(bonus.ok ? bonus.data : {});
      const a = unwrap(approved.ok ? approved.data : {});
      const rawExp = exposure.ok ? exposure.data : 0;
      const exp = typeof rawExp === 'object' ? num((rawExp as Rec).total) : num(rawExp);
      setSummary({
        totalDeposit: num(w.totalDeposit),
        totalWithdrawal: num(w.totalWithdrawal),
        balance: num(w.balance),
        bonusWalletBalance: num(w.bonusWalletBalance),
        pendingWithdrawal: num(w.pendingWithdrawal),
        exposure: exp,
        referralEarning: num(b.userReferral),
        ownEarning: num(b.userOwnEarning),
        approvedBonus: num(a.totalAmount),
      });
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  return summary;
}

/* --------------------------------- screen --------------------------------- */

export function UserReportScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const userId = String(params.userId ?? '');
  const userName = String(params.userName ?? '');
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [tab, setTab] = useState<Tab>('Wallet History');
  const summary = useWalletSummary(userId);

  const summaryCards: [string, number][] = summary
    ? [
        ['Balance', summary.balance],
        ['Total Deposit', summary.totalDeposit],
        ['Total Withdrawal', summary.totalWithdrawal],
        ['Bonus Wallet', summary.bonusWalletBalance],
        ['Pending Withdrawal', summary.pendingWithdrawal],
        ['Exposure', summary.exposure],
        ['Referral Earning', summary.referralEarning],
        ['Own Earning', summary.ownEarning],
        ['Approved Bonus', summary.approvedBonus],
      ]
    : [];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{userName || 'User Report'}</Text>
      <Text style={styles.sub}>ID: {userId}</Text>

      <View style={styles.summaryGrid}>
        {summaryCards.map(([label, value]) => (
          <View key={label} style={[styles.summaryCard, compact && styles.summaryCardCompact]}>
            <Text style={styles.summaryLabel}>{label}</Text>
            <Text style={styles.summaryValue}>₹{floorNum(value).toLocaleString('en-IN')}</Text>
          </View>
        ))}
        {!summary ? <Text style={styles.muted}>Loading summary…</Text> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, tab === t && styles.chipActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.chipText, tab === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'Wallet History' ? <WalletTab userId={userId} /> : null}
      {tab === 'Game History' ? <GameTab userId={userId} /> : null}
      {tab === 'Fund Request' ? <FundTab userId={userId} /> : null}
    </ScrollView>
  );
}

/* --------------------------------- pager ---------------------------------- */

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <View style={styles.pagerRow}>
      <TouchableOpacity
        style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
        disabled={page <= 1}
        onPress={() => onPage(page - 1)}
      >
        <Text style={styles.pagerBtnText}>‹ Prev</Text>
      </TouchableOpacity>
      <Text style={styles.pagerText}>
        Page {page} / {totalPages}
      </Text>
      <TouchableOpacity
        style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
        disabled={page >= totalPages}
        onPress={() => onPage(page + 1)}
      >
        <Text style={styles.pagerBtnText}>Next ›</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ------------------------------- wallet tab ------------------------------- */

function detailText(r: Rec): string {
  const d = (r.description ?? {}) as Rec;
  const bits: string[] = [];
  for (const k of [
    'marketName',
    'gameName',
    'game',
    'category',
    'paymentGatewayName',
    'paymentType',
    'reason',
    'remark',
  ]) {
    if (d[k]) bits.push(String(d[k]));
  }
  if (d.roundId) bits.push(`Round ${String(d.roundId)}`);
  if (d.transactionId) bits.push(`Txn ${String(d.transactionId)}`);
  return bits.join(' · ') || '—';
}

function WalletTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [txType, setTxType] = useState<'' | 'CR' | 'DR'>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Rec = { userId };
      if (txType) filter.transactionType = txType;
      const payload: Rec = { itemsPerPage: 75, pageNo: page, filter };
      if (startDate && endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }
      const useCustomer = Boolean(txType);
      if (useCustomer) {
        const res = await secureApi('userReport.walletHistoryCustomer', payload);
        if (res.ok) {
          setRows(listOf(res.data, 'items'));
          setTotalPages(pagesOf(res.data));
          return;
        }
      }
      const res = await secureApi('userReport.walletHistory', payload);
      setRows(res.ok ? listOf(res.data, 'walletHistory', 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, startDate, endDate, txType]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'provider', label: 'Provider', width: 110, render: (r) => display(r.providerName) },
      { key: 'action', label: 'Action', width: 110, render: (r) => display(r.action) },
      { key: 'detail', label: 'Detail', width: 180, render: (r) => detailText(r) },
      {
        key: 'type',
        label: 'Type',
        width: 70,
        render: (r) => {
          const t = String(r.transactionType ?? '').toUpperCase();
          return t === 'CR' || t === 'CREDITED' ? 'Credit' : t === 'DR' || t === 'DEBITED' ? 'Debit' : display(r.transactionType);
        },
        color: (r) => {
          const t = String(r.transactionType ?? '').toUpperCase();
          return t === 'CR' || t === 'CREDITED' ? colors.success : colors.destructive;
        },
      },
      { key: 'opening', label: 'Opening', width: 90, render: (r) => floorNum(num(r.lastBalance)).toLocaleString('en-IN') },
      { key: 'amount', label: 'Amount', width: 90, render: (r) => floorNum(num(r.amount)).toLocaleString('en-IN') },
      { key: 'closing', label: 'Closing', width: 90, render: (r) => floorNum(num(r.balance)).toLocaleString('en-IN') },
      { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
    ],
    [],
  );

  return (
    <View>
      <View style={styles.filterRow}>
        <View style={styles.dateWrap}>
          <DateField value={startDate} onChange={(v) => { setStartDate(v); setPage(1); }} placeholder="From" />
        </View>
        <View style={styles.dateWrap}>
          <DateField value={endDate} onChange={(v) => { setEndDate(v); setPage(1); }} placeholder="To" />
        </View>
      </View>
      <View style={styles.chipRowPlain}>
        {(
          [
            ['', 'All'],
            ['CR', 'Credited'],
            ['DR', 'Debited'],
          ] as const
        ).map(([v, label]) => (
          <TouchableOpacity
            key={label}
            style={[styles.chip, txType === v && styles.chipActive]}
            onPress={() => {
              setTxType(v);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, txType === v && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <DataTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No wallet history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* -------------------------------- game tab -------------------------------- */

const GAME_STATUS: Record<string, string> = { P: 'Pending', W: 'Win', L: 'Loss' };

function GameTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'' | 'P' | 'W' | 'L'>('');
  const [resultDate, setResultDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Rec = { customer_id: userId };
      if (status) filter.status = status;
      if (resultDate) filter.result_date = resultDate;
      const res = await secureApi('userReport.gameHistory', {
        itemsPerPage: 20,
        pageNo: page,
        filter,
      });
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, status, resultDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'txn', label: 'Txn Id', width: 130, render: (r) => display(r.transaction_id) },
      { key: 'bazar', label: 'Bazar', width: 110, render: (r) => display(r.bazar_name) },
      { key: 'gameType', label: 'Game Type', width: 100, render: (r) => display(r.game_type) },
      { key: 'gameName', label: 'Game', width: 110, render: (r) => display(r.game_name) },
      { key: 'game', label: 'Number', width: 80, render: (r) => display(r.game) },
      { key: 'resultDate', label: 'Result Date', width: 100, render: (r) => display(r.result_date) },
      { key: 'point', label: 'Point', width: 70, render: (r) => display(r.point) },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => GAME_STATUS[String(r.status ?? '')] ?? display(r.status),
        color: (r) =>
          String(r.status) === 'W'
            ? colors.success
            : String(r.status) === 'L'
              ? colors.destructive
              : undefined,
      },
      { key: 'win', label: 'Winning', width: 80, render: (r) => display(r.winning_point) },
      { key: 'commission', label: 'Commission', width: 90, render: (r) => display(r.commission) },
      { key: 'bet', label: 'Bet Time', width: 140, render: (r) => when(r) },
    ],
    [],
  );

  return (
    <View>
      <View style={styles.filterRow}>
        <View style={styles.dateWrap}>
          <DateField value={resultDate} onChange={(v) => { setResultDate(v); setPage(1); }} placeholder="Result date" />
        </View>
      </View>
      <View style={styles.chipRowPlain}>
        {(
          [
            ['', 'All'],
            ['P', 'Pending'],
            ['W', 'Win'],
            ['L', 'Loss'],
          ] as const
        ).map(([v, label]) => (
          <TouchableOpacity
            key={label}
            style={[styles.chip, status === v && styles.chipActive]}
            onPress={() => {
              setStatus(v);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, status === v && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <DataTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No game history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* -------------------------------- fund tab -------------------------------- */

type FundType = 'deposit' | 'withdrawal' | 'coin';

function FundTab({ userId }: { userId: string }) {
  const [type, setType] = useState<FundType>('deposit');
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Rec = { itemsPerPage: 20, pageNo: page, type };
      if (type === 'deposit') {
        const f: Rec = { userId };
        if (amount.trim()) f.amount = amount.trim();
        payload.filterDeposit = f;
      } else if (type === 'withdrawal') {
        payload.filterWithdrawal = { dp_id: userId };
      } else {
        payload.filterCoin = { userId };
      }
      const res = await secureApi('userReport.transactionHistory', payload);
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, type, amount]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    if (type === 'withdrawal') {
      return [
        { key: 'ptype', label: 'Type', width: 90, render: (r) => display(r.paymentType ?? r.type) },
        { key: 'amount', label: 'Amount', width: 90, render: (r) => floorNum(num(r.amount)).toLocaleString('en-IN') },
        { key: 'status', label: 'Status', width: 90, render: (r) => display(r.status) },
        { key: 'txn', label: 'Transaction', width: 140, render: (r) => display(r.transactionId ?? r.orderId) },
        { key: 'account', label: 'Account', width: 130, render: (r) => display(r.accountNo) },
        { key: 'holder', label: 'Holder', width: 120, render: (r) => display(r.accountHolderName) },
        { key: 'ifsc', label: 'IFSC', width: 100, render: (r) => display(r.ifsc ?? r.IfscCode) },
        { key: 'bank', label: 'Bank', width: 110, render: (r) => display(r.userBankName ?? r.bankName) },
        { key: 'provider', label: 'Provider', width: 110, render: (r) => display(r.withdrewalProviderName) },
        { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
      ];
    }
    if (type === 'coin') {
      return [
        { key: 'ptype', label: 'Type', width: 90, render: (r) => display(r.paymentType ?? r.type) },
        { key: 'amount', label: 'Amount', width: 90, render: (r) => floorNum(num(r.balance ?? r.amount)).toLocaleString('en-IN') },
        {
          key: 'updatedBy',
          label: 'Updated By',
          width: 120,
          render: (r) => {
            const u = r.updatedBy;
            return u && typeof u === 'object' ? display((u as Rec).name) : display(u);
          },
        },
        { key: 'reason', label: 'Reason', width: 130, render: (r) => display(r.reason) },
        { key: 'tag', label: 'Tag', width: 90, render: (r) => display(r.tag) },
        { key: 'remark', label: 'Remark', width: 140, render: (r) => display(r.remark) },
        { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
      ];
    }
    return [
      { key: 'ptype', label: 'Type', width: 90, render: (r) => display(r.paymentType ?? r.type) },
      { key: 'amount', label: 'Amount', width: 90, render: (r) => floorNum(num(r.amount)).toLocaleString('en-IN') },
      { key: 'status', label: 'Status', width: 90, render: (r) => display(r.status) },
      { key: 'orderId', label: 'Order Id', width: 150, render: (r) => display(r.orderId ?? r.order_id) },
      { key: 'gateway', label: 'Gateway', width: 110, render: (r) => display(r.paymentGatewayName ?? r.gateway) },
      { key: 'mid', label: 'MID', width: 100, render: (r) => display(r.mid) },
      { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
    ];
  }, [type]);

  return (
    <View>
      <View style={styles.chipRowPlain}>
        {(
          [
            ['deposit', 'Deposit'],
            ['withdrawal', 'Withdrawal'],
            ['coin', 'Coins'],
          ] as const
        ).map(([v, label]) => (
          <TouchableOpacity
            key={v}
            style={[styles.chip, type === v && styles.chipActive]}
            onPress={() => {
              setType(v);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, type === v && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {type === 'deposit' ? (
        <View style={styles.filterRow}>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Search amount"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            onSubmitEditing={() => setPage(1)}
          />
        </View>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No transactions"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* --------------------------------- styles --------------------------------- */

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  content: { padding: spacing(3), paddingBottom: spacing(8) },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 11, marginBottom: spacing(2) },
  muted: { color: colors.muted, fontSize: 12 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    minWidth: '30%',
    flexGrow: 1,
  },
  summaryCardCompact: { minWidth: '46%' },
  summaryLabel: { color: colors.muted, fontSize: 10, marginBottom: 2 },
  summaryValue: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  chipRow: { gap: spacing(2), paddingBottom: spacing(2) },
  chipRowPlain: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  filterRow: {
    flexDirection: 'row',
    gap: spacing(2),
    marginBottom: spacing(2),
  },
  dateWrap: { flex: 1 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.foreground,
    paddingHorizontal: spacing(2),
    paddingVertical: 8,
    fontSize: 13,
  },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(2),
  },
  pagerBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  pagerText: { color: colors.muted, fontSize: 12 },
});
