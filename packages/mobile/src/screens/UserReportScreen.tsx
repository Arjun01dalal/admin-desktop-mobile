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
import { useNavigation, useRoute } from '@react-navigation/native';
import { getSessionUser } from '../auth/permissions';
import { colors, radius, spacing } from '../theme';
import { floorNum } from '../dashboards/mergeMetrics';
import { type DataTableColumn } from '../dashboards/ui/DataTable';
import { ResponsiveTable } from '../dashboards/ui/ResponsiveTable';
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

/** Desktop USER_REPORT_TABS parity. */
const TABS = [
  'Wallet History',
  'Game History',
  'Starline History',
  'King Bazar History',
  'Instant Worli History',
  'Qtech History',
  'JetFair History',
  'Falcon History',
  'Remove Bonus Coins',
  'Fund Request',
  'Qtech Provider History',
  'Qtech Missing Bets',
  'Jetfair Provider History',
  'SM Provider History',
  'Qtech Bet Details',
  'Crazzy Wheel',
  'Settle SM Bets',
  'Settle Jetfair Bets',
  'Player RTP',
] as const;
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

      <TabBody tab={tab} userId={userId} />
    </ScrollView>
  );
}

function TabBody({ tab, userId }: { tab: Tab; userId: string }) {
  switch (tab) {
    case 'Wallet History':
      return <WalletTab userId={userId} />;
    case 'Game History':
      return <GameTab userId={userId} />;
    case 'Fund Request':
      return <FundTab userId={userId} />;
    case 'Starline History':
      return <MatkaTab userId={userId} variant="starline" />;
    case 'King Bazar History':
      return <MatkaTab userId={userId} variant="king" />;
    case 'Instant Worli History':
      return <MatkaTab userId={userId} variant="worli" />;
    case 'Crazzy Wheel':
      return <MatkaTab userId={userId} variant="crazy" />;
    case 'Qtech History':
      return <QtechTab userId={userId} />;
    case 'JetFair History':
      return <ExchangeTab userId={userId} variant="jetfair" />;
    case 'Falcon History':
      return <ExchangeTab userId={userId} variant="falcon" />;
    case 'Remove Bonus Coins':
      return <RemoveBonusTab userId={userId} />;
    case 'Qtech Provider History':
      return <ProviderTab userId={userId} kind="qtech" />;
    case 'Qtech Missing Bets':
      return <ProviderTab userId={userId} kind="missing" />;
    case 'Jetfair Provider History':
      return <ProviderTab userId={userId} kind="jetfair" />;
    case 'SM Provider History':
      return <ProviderTab userId={userId} kind="sm" />;
    case 'Qtech Bet Details':
      return <QtechBetDetailsTab userId={userId} />;
    case 'Settle SM Bets':
      return <SettleTab userId={userId} kind="sm" />;
    case 'Settle Jetfair Bets':
      return <SettleTab userId={userId} kind="jetfair" />;
    case 'Player RTP':
      return <PlayerRtpLink userId={userId} />;
    default:
      return null;
  }
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

/** Desktop parity: parse betAmountsByCategory payload into {name, amount} bars. */
function parseChartPayload(raw: unknown): { name: string; amount: number }[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  let map = raw as Rec;
  if (
    map.data &&
    typeof map.data === 'object' &&
    !Array.isArray(map.data) &&
    !('betAmount' in (map.data as object))
  ) {
    const inner = map.data as Rec;
    const innerKeys = Object.keys(inner);
    if (
      innerKeys.some((k) => ['casino', 'exchange', 'sattamatka'].includes(k.toLowerCase())) ||
      innerKeys.some((k) => {
        const v = inner[k];
        return v != null && typeof v === 'object' && 'betAmount' in (v as object);
      })
    ) {
      map = inner;
    }
  }
  if (map.payload && typeof map.payload === 'object' && !Array.isArray(map.payload)) {
    map = map.payload as Rec;
  }
  const skip = new Set(['success', 'message', 'status', 'token', 'payload', 'data']);
  const preferred = ['casino', 'exchange', 'sattamatka'];
  const entries = Object.entries(map).filter(([k, v]) => !skip.has(k) && v != null);
  const byLower = new Map(entries.map(([k, v]) => [k.toLowerCase(), { key: k, value: v }] as const));
  const ordered: string[] = [];
  for (const p of preferred) {
    const hit = byLower.get(p);
    if (hit) ordered.push(hit.key);
  }
  for (const [k] of entries) if (!ordered.includes(k)) ordered.push(k);
  return ordered.map((key) => {
    const v = byLower.get(key.toLowerCase())?.value;
    let amount = 0;
    if (typeof v === 'number') amount = v;
    else if (typeof v === 'string') amount = Number(v.replace(/,/g, '')) || 0;
    else if (v && typeof v === 'object') {
      const o = v as Rec;
      amount = Number(o.betAmount ?? o.BetAmount ?? o.amount ?? o.Amount ?? 0) || 0;
    }
    return { name: key.toUpperCase(), amount };
  });
}

const BAR_COLORS = ['#4fc3f7', '#ffb74d', '#81c784', '#e57373', '#ba68c8', '#f06292'];

/** Bet Amount Overview bars (desktop chart, RN Views version). */
function BetAmountChart({ data }: { data: { name: string; amount: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Bet Amount Overview</Text>
      {data.map((d, i) => (
        <View key={d.name} style={styles.chartRow}>
          <Text style={styles.chartLabel} numberOfLines={1}>
            {d.name}
          </Text>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartBar,
                {
                  width: `${Math.max(d.amount > 0 ? 2 : 0, (d.amount / max) * 100)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                },
              ]}
            />
          </View>
          <Text style={styles.chartValue} numberOfLines={1}>
            {Math.floor(d.amount).toLocaleString('en-IN')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function WalletTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [txType, setTxType] = useState<'' | 'CR' | 'DR'>('');
  const [chartData, setChartData] = useState<{ name: string; amount: number }[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await secureApi('userReport.betAmountsByCategory', {
        userId: String(userId),
        startDate: startDate || '',
        endDate: endDate || '',
      });
      if (alive) setChartData(res.ok ? parseChartPayload(res.data) : []);
    })();
    return () => {
      alive = false;
    };
  }, [userId, startDate, endDate]);

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
      <BetAmountChart data={chartData} />
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
      <ResponsiveTable
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
      <ResponsiveTable
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
      <ResponsiveTable
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

/* -------------------------------- matka tab -------------------------------- */

type MatkaVariant = 'starline' | 'king' | 'worli' | 'crazy';

const MATKA_ACTION: Record<MatkaVariant, string> = {
  starline: 'userReport.starlineHistory',
  king: 'userReport.kingBazarHistory',
  worli: 'userReport.instantWorliHistory',
  crazy: 'userReport.crazyWheelHistory',
};

function MatkaTab({ userId, variant }: { userId: string; variant: MatkaVariant }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resultDate, setResultDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Rec = { customer_id: userId };
      if (resultDate) filter.result_date = resultDate;
      const res = await secureApi(MATKA_ACTION[variant] as Parameters<typeof secureApi>[0], {
        itemsPerPage: 20,
        pageNo: page,
        filter,
      });
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, variant, page, resultDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    const cols: DataTableColumn<Rec>[] = [
      { key: 'txn', label: 'Txn Id', width: 130, render: (r) => display(r.transaction_id) },
      { key: 'bazar', label: 'Bazar', width: 110, render: (r) => display(r.bazar_name) },
    ];
    if (variant === 'crazy') {
      cols.push(
        { key: 'round', label: 'Round', width: 110, render: (r) => display(r.round_id ?? r.roundId) },
        { key: 'titles', label: 'Title', width: 110, render: (r) => display(r.titles ?? r.game_name) },
      );
    } else {
      cols.push({ key: 'gameName', label: 'Game', width: 110, render: (r) => display(r.game_name) });
    }
    cols.push(
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
    );
    return cols;
  }, [variant]);

  return (
    <View>
      <View style={styles.filterRow}>
        <View style={styles.dateWrap}>
          <DateField value={resultDate} onChange={(v) => { setResultDate(v); setPage(1); }} placeholder="Result date" />
        </View>
      </View>
      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* -------------------------------- qtech tab -------------------------------- */

function QtechTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'' | 'W' | 'L' | 'R'>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Rec = { userId };
      if (status) filter.status = status;
      const res = await secureApi('userReport.qtechHistory', {
        itemsPerPage: 20,
        pageNo: page,
        filter,
      });
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'txn', label: 'Txn Id', width: 140, render: (r) => display(r.transactionId) },
      { key: 'round', label: 'Round', width: 120, render: (r) => display(r.roundId) },
      { key: 'game', label: 'Game', width: 110, render: (r) => display(r.gameId) },
      { key: 'category', label: 'Category', width: 100, render: (r) => display(r.category) },
      { key: 'amount', label: 'Amount', width: 80, render: (r) => display(r.amount) },
      { key: 'win', label: 'Winning', width: 80, render: (r) => display(r.wining ?? r.winning) },
      { key: 'rollback', label: 'Rollback', width: 80, render: (r) => display(r.rollBackAmount ?? r.rollBack) },
      { key: 'commission', label: 'Commission', width: 90, render: (r) => display(r.commissionAmount ?? r.commission) },
      { key: 'afterComm', label: 'After Comm.', width: 90, render: (r) => display(r.amountAfterCommission) },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => display(r.status),
        color: (r) =>
          String(r.status) === 'W'
            ? colors.success
            : String(r.status) === 'L'
              ? colors.destructive
              : undefined,
      },
      { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
    ],
    [],
  );

  return (
    <View>
      <View style={styles.chipRowPlain}>
        {(
          [
            ['', 'All'],
            ['W', 'Win'],
            ['L', 'Loss'],
            ['R', 'Rollback'],
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
      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No Qtech history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* ------------------------------ exchange tab ------------------------------ */

function ExchangeTab({ userId, variant }: { userId: string; variant: 'jetfair' | 'falcon' }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Rec =
        variant === 'jetfair' ? { clientUsername: userId } : { userId };
      const res = await secureApi(
        variant === 'jetfair' ? 'userReport.jetfairHistory' : 'userReport.falconHistory',
        { itemsPerPage: 20, pageNo: page, filter },
      );
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, variant, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pick = (r: Rec, ...keys: string[]): string => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return String(r[k]);
    }
    return '—';
  };

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'txn', label: 'Txn Id', width: 140, render: (r) => pick(r, 'transactionId', 'TransactionID') },
      { key: 'code', label: 'Txn Code', width: 110, render: (r) => pick(r, 'transactionCode', 'TransactionCode') },
      { key: 'type', label: 'Type', width: 90, render: (r) => pick(r, 'transactionType', 'TransactionType') },
      { key: 'market', label: 'Market', width: 130, render: (r) => pick(r, 'marketName', 'Marketname') },
      { key: 'runner', label: 'Runner', width: 120, render: (r) => pick(r, 'runnerName', 'Runnername') },
      { key: 'gameName', label: 'Game', width: 110, render: (r) => pick(r, 'gameName', 'GameName', 'gameMarket') },
      { key: 'rate', label: 'Rate', width: 70, render: (r) => pick(r, 'rate', 'Rate') },
      { key: 'stake', label: 'Stake', width: 80, render: (r) => pick(r, 'stake', 'Stake') },
      { key: 'betType', label: 'Bet Type', width: 90, render: (r) => pick(r, 'betType', 'BetType') },
      { key: 'betStatus', label: 'Bet Status', width: 90, render: (r) => pick(r, 'betStatus', 'BetStatus') },
      { key: 'betPL', label: 'Bet P/L', width: 90, render: (r) => pick(r, 'betPL', 'BetPL') },
      { key: 'netPL', label: 'Net P/L', width: 90, render: (r) => pick(r, 'netPL', 'NetPL') },
      { key: 'commission', label: 'Commission', width: 90, render: (r) => pick(r, 'commission', 'commissionAmount') },
      {
        key: 'created',
        label: 'Created On',
        width: 140,
        render: (r) => {
          const raw = (r.createdOn ?? r.CreatedOn ?? r.createdAt) as string | undefined;
          return raw ? formatDisplayDate(raw) : '—';
        },
      },
    ],
    [],
  );

  return (
    <View>
      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No exchange history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* ---------------------------- remove bonus tab ---------------------------- */

function RemoveBonusTab({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = useCallback(async () => {
    setMsg('');
    if (!amount.trim() || !remark.trim()) {
      setMsg('Amount and remark are required');
      return;
    }
    setBusy(true);
    try {
      const admin = (getSessionUser() ?? {}) as Rec;
      const res = await secureApi('userReport.removeBonus', {
        bonusBy: {
          name: String(admin.name ?? ''),
          _id: String(admin._id ?? ''),
          type: 'remove bonus',
          transaction: 'credit',
        },
        userId,
        amount: amount.trim(),
        type: 'remove bonus',
        remark: remark.trim(),
      });
      setMsg(res.message || (res.ok ? 'Bonus removed' : 'Failed to remove bonus'));
      if (res.ok) {
        setAmount('');
        setRemark('');
      }
    } finally {
      setBusy(false);
    }
  }, [userId, amount, remark]);

  return (
    <View style={styles.formCard}>
      <Text style={styles.formLabel}>Amount</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="Bonus amount to remove"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.formLabel}>Remark</Text>
      <TextInput
        style={styles.input}
        value={remark}
        onChangeText={setRemark}
        placeholder="Reason / remark"
        placeholderTextColor={colors.muted}
      />
      <TouchableOpacity
        style={[styles.submitBtn, busy && styles.pagerBtnDisabled]}
        onPress={() => void submit()}
        disabled={busy}
      >
        <Text style={styles.submitBtnText}>{busy ? 'Removing…' : 'Remove Bonus'}</Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
    </View>
  );
}

/* ----------------------------- provider tabs ------------------------------ */

type ProviderKind = 'qtech' | 'missing' | 'jetfair' | 'sm';

function todayYmdIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function providerList(data: unknown): Rec[] {
  const obj = unwrap(data);
  for (const k of [
    'items',
    'providerBets',
    'provider',
    'providersDetail',
    'platformBets',
    'platform',
    'plateformDetails',
    'missingInProvider',
    'missingProviders',
    'providerMissing',
    'missingInPlatform',
    'missingPlatforms',
    'platformMissing',
    'list',
  ]) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return Array.isArray(data) ? (data as Rec[]) : [];
}

const SM_MARKET_CODES = ['301', '401', '501', '701', '801'] as const;

function ProviderTab({ userId, kind }: { userId: string; kind: ProviderKind }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(todayYmdIST());
  const [endDate, setEndDate] = useState(todayYmdIST());
  const [marketId, setMarketId] = useState('');
  const [marketCode, setMarketCode] = useState('301');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      let res;
      if (kind === 'qtech' || kind === 'missing') {
        res = await secureApi(
          kind === 'qtech' ? 'userReport.qtechStoreBet' : 'userReport.qtechMissingBets',
          {
            userId,
            startDate,
            endDate,
            size: 100,
            itemsPerPage: 100,
            pageNo: 1,
            filter: { userId, providerName: 'Qtech' },
          },
        );
      } else if (kind === 'jetfair') {
        if (!marketId.trim()) {
          setRows([]);
          setMsg('Enter Market ID and tap Load');
          return;
        }
        res = await secureApi('userReport.jetfairMapping', { userId, marketId: marketId.trim() });
      } else {
        res = await secureApi('userReport.smMapping', {
          userId,
          resultDate: startDate,
          marketCode,
        });
      }
      setRows(res.ok ? providerList(res.data) : []);
      if (!res.ok) setMsg(res.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [userId, kind, startDate, endDate, marketId, marketCode]);

  useEffect(() => {
    if (kind !== 'jetfair') void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const pick = (r: Rec, ...keys: string[]): string => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return String(r[k]);
    }
    return '—';
  };

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    if (kind === 'sm') {
      return [
        { key: 'gameName', label: 'Game', width: 110, render: (r) => pick(r, 'game_name', 'gameName') },
        { key: 'bazar', label: 'Bazar', width: 110, render: (r) => pick(r, 'game', 'bazar_name') },
        { key: 'status', label: 'Status', width: 80, render: (r) => pick(r, 'status') },
        { key: 'win', label: 'Winning', width: 80, render: (r) => pick(r, 'winning_point', 'winningPoint') },
        { key: 'commission', label: 'Commission', width: 90, render: (r) => pick(r, 'commission') },
        { key: 'txn', label: 'Txn Id', width: 140, render: (r) => pick(r, 'transaction_id', 'transactionId') },
        { key: 'resultDate', label: 'Result Date', width: 100, render: (r) => pick(r, 'result_date', 'resultDate') },
      ];
    }
    if (kind === 'jetfair') {
      return [
        { key: 'runner', label: 'Runner', width: 130, render: (r) => pick(r, 'runnerName', 'Runnername') },
        { key: 'hub', label: 'Hub', width: 90, render: (r) => pick(r, 'hub') },
        { key: 'stake', label: 'Stake', width: 80, render: (r) => pick(r, 'stake', 'Stake') },
        { key: 'rate', label: 'Rate', width: 70, render: (r) => pick(r, 'rate', 'Rate') },
        { key: 'won', label: 'Won?', width: 70, render: (r) => pick(r, 'isBetWon', 'IsBetWon') },
        { key: 'back', label: 'Back?', width: 70, render: (r) => pick(r, 'isback', 'Isback') },
        { key: 'netPL', label: 'Net P/L', width: 90, render: (r) => pick(r, 'netPL', 'NetPL') },
        {
          key: 'created',
          label: 'Created On',
          width: 120,
          render: (r) => {
            const raw = (r.createdOn ?? r.CreatedOn) as string | undefined;
            return raw ? formatDisplayDate(raw) : '—';
          },
        },
      ];
    }
    return [
      { key: 'round', label: 'Round', width: 130, render: (r) => pick(r, 'roundId', 'round_id') },
      { key: 'status', label: 'Status', width: 90, render: (r) => pick(r, 'status') },
      { key: 'bet', label: 'Bet', width: 80, render: (r) => pick(r, 'totalBet', 'betAmount', 'amount') },
      { key: 'payout', label: 'Payout', width: 80, render: (r) => pick(r, 'totalPayout', 'winAmount', 'payout') },
      { key: 'bonusBet', label: 'Bonus Bet', width: 80, render: (r) => pick(r, 'totalBonusBet', 'bonusBet') },
      { key: 'game', label: 'Game', width: 100, render: (r) => pick(r, 'gameId') },
      { key: 'category', label: 'Category', width: 100, render: (r) => pick(r, 'gameCategory', 'category') },
      { key: 'provider', label: 'Provider', width: 100, render: (r) => pick(r, 'gameProvider', 'providerName') },
      { key: 'device', label: 'Device', width: 80, render: (r) => pick(r, 'device') },
      { key: 'initiated', label: 'Initiated', width: 140, render: (r) => pick(r, 'initiated', 'initiatedAt') },
      { key: 'completed', label: 'Completed', width: 140, render: (r) => pick(r, 'completed', 'completedAt') },
    ];
  }, [kind]);

  return (
    <View>
      {kind === 'qtech' || kind === 'missing' ? (
        <View style={styles.filterRow}>
          <View style={styles.dateWrap}>
            <DateField value={startDate} onChange={setStartDate} placeholder="From" />
          </View>
          <View style={styles.dateWrap}>
            <DateField value={endDate} onChange={setEndDate} placeholder="To" />
          </View>
        </View>
      ) : null}
      {kind === 'sm' ? (
        <View>
          <View style={styles.filterRow}>
            <View style={styles.dateWrap}>
              <DateField value={startDate} onChange={setStartDate} placeholder="Result date" />
            </View>
          </View>
          <View style={styles.chipRowPlain}>
            {SM_MARKET_CODES.map((code) => (
              <TouchableOpacity
                key={code}
                style={[styles.chip, marketCode === code && styles.chipActive]}
                onPress={() => setMarketCode(code)}
              >
                <Text style={[styles.chipText, marketCode === code && styles.chipTextActive]}>
                  {code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
      {kind === 'jetfair' ? (
        <View style={styles.filterRow}>
          <TextInput
            style={styles.input}
            value={marketId}
            onChangeText={setMarketId}
            placeholder="Market ID"
            placeholderTextColor={colors.muted}
          />
        </View>
      ) : null}
      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.pagerBtnDisabled]}
        onPress={() => void load()}
        disabled={loading}
      >
        <Text style={styles.submitBtnText}>{loading ? 'Loading…' : 'Load'}</Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No records"
      />
    </View>
  );
}

/* --------------------------- qtech bet details ---------------------------- */

function QtechBetDetailsTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(todayYmdIST());
  const [endDate, setEndDate] = useState(todayYmdIST());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('userReport.qtechRtp', {
        userId,
        startDate: startDate || todayYmdIST(),
        endDate: endDate || todayYmdIST(),
      });
      const obj = unwrap(res.ok ? res.data : {});
      setRows(Array.isArray(obj) ? (obj as Rec[]) : Array.isArray(obj.games) ? (obj.games as Rec[]) : providerList(res.data));
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'game', label: 'Game', width: 150, render: (r) => display(r.gameName ?? r.gameId) },
      { key: 'bets', label: 'Total Bets', width: 90, render: (r) => display(r.totalBets) },
      { key: 'wins', label: 'Total Wins', width: 90, render: (r) => display(r.totalWins) },
      { key: 'amount', label: 'Bet Amount', width: 100, render: (r) => display(r.totalAmount) },
      { key: 'winAmount', label: 'Win Amount', width: 100, render: (r) => display(r.winAmount) },
    ],
    [],
  );

  return (
    <View>
      <View style={styles.filterRow}>
        <View style={styles.dateWrap}>
          <DateField value={startDate} onChange={setStartDate} placeholder="From" />
        </View>
        <View style={styles.dateWrap}>
          <DateField value={endDate} onChange={setEndDate} placeholder="To" />
        </View>
      </View>
      <ResponsiveTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r.gameId ?? i)}
        loading={loading}
        emptyMessage="No bet details"
      />
    </View>
  );
}

/* ------------------------------- settle tabs ------------------------------ */

function SettleTab({ userId, kind }: { userId: string; kind: 'sm' | 'jetfair' }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [json, setJson] = useState('');

  const submit = useCallback(async () => {
    setMsg('');
    setBusy(true);
    try {
      if (kind === 'sm') {
        const res = await secureApi('userReport.settleSmBets', { userId });
        setMsg(res.message || (res.ok ? 'SM bets settled' : 'Failed to settle'));
      } else {
        let payload: Rec;
        try {
          payload = JSON.parse(json) as Rec;
        } catch {
          setMsg('Invalid JSON');
          return;
        }
        const res = await secureApi('userReport.settleJetfair', payload);
        setMsg(res.message || (res.ok ? 'Jetfair market settled' : 'Failed to settle'));
      }
    } finally {
      setBusy(false);
    }
  }, [userId, kind, json]);

  return (
    <View style={styles.formCard}>
      {kind === 'jetfair' ? (
        <>
          <Text style={styles.formLabel}>Settlement JSON</Text>
          <TextInput
            style={[styles.input, styles.jsonInput]}
            value={json}
            onChangeText={setJson}
            placeholder='{"marketId": "..."}'
            placeholderTextColor={colors.muted}
            multiline
          />
        </>
      ) : (
        <Text style={styles.muted}>Settle all pending SM bets for this user.</Text>
      )}
      <TouchableOpacity
        style={[styles.submitBtn, busy && styles.pagerBtnDisabled]}
        onPress={() => void submit()}
        disabled={busy}
      >
        <Text style={styles.submitBtnText}>
          {busy ? 'Settling…' : kind === 'sm' ? 'Settle SM Bets' : 'Settle Jetfair Market'}
        </Text>
      </TouchableOpacity>
      {msg ? <Text style={styles.muted}>{msg}</Text> : null}
    </View>
  );
}

/* ------------------------------- player RTP ------------------------------- */

function PlayerRtpLink({ userId }: { userId: string }) {
  const navigation = useNavigation<{
    navigate: (name: string, params?: object) => void;
  }>();
  return (
    <View style={styles.formCard}>
      <Text style={styles.muted}>Player RTP report opens on its own page.</Text>
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() =>
          navigation.navigate('panel', {
            screen: 'playerRtp',
            params: { id: userId, fromUserReport: true },
          })
        }
      >
        <Text style={styles.submitBtnText}>Open Player RTP</Text>
      </TouchableOpacity>
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
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
  },
  formLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  jsonInput: { minHeight: 100, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing(1),
    marginBottom: spacing(2),
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  chartCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  chartTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700', marginBottom: spacing(2) },
  chartRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(1.5) },
  chartLabel: { color: colors.muted, fontSize: 11, width: 92 },
  chartTrack: {
    flex: 1,
    height: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing(2),
  },
  chartBar: { height: '100%', borderRadius: radius.sm },
  chartValue: { color: colors.foreground, fontSize: 11, fontWeight: '700', width: 76, textAlign: 'right' },
});
