/**
 * Withdrawal Fund — mobile port of desktop WithdrawalFundPage (route
 * /withdrawal-fund), NestedFundTable and WithdrawUserDataPage.
 *
 * Views (drill-down):
 *  report      → total amount + agent chips + Type list (withdrawalFund.report)
 *  types(prov) → providers under a tapped type
 *  mids        → MID list under a tapped provider (per-MID summary counts come
 *                from withdrawalFund.latestReport, lazy-loaded on entry)
 *  withdrawals → the withdrawal-doc list for an agent chip / MID / filtered
 *                record bucket (matched / db-not-sheet / sheet-not-db);
 *                tap a row for full details.
 *
 * Skipped vs desktop: SheetUploadDialog (Excel/CSV file picker + XLSX parsing)
 * needs a document picker + sheet parser not available in this app — the
 * upload action and withdrawalFund.sheetComparison are not wired here.
 *
 * Desktop-parity row actions (in the row detail sheet): "Dialer Call" pushes
 * the single entry to the dialer campaign API (ganesha999.com, server picked
 * from the admin's serverId, same as desktop), and "Add Comment" edits the
 * local-only comment field on the row (desktop does not persist it either).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { appCodeForName } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import {
  getRoleName,
  getSessionUser,
  hasPermission,
  isSosExemptRole,
} from '../../../auth/permissions';
import { appStorage } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { EmpCodePieChartModal, type ChartCountRow } from './EmpCodePieChartModal';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

/** Current Month Chart — 9608010101 + full_access / dev_full_access. */
const WITHDRAWAL_FUND_CHART_MOBILES = new Set(['9608010101']);

function canShowCurrentMonthChart(
  user: {
    mobile?: string;
    Role_ID?: string;
    Role_Name?: string;
    roleName?: string;
    role?: string;
    roles?: Record<string, string> | unknown;
  } | null,
): boolean {
  const mobile = String(user?.mobile || appStorage.getItem('mobile') || '').trim();
  if (WITHDRAWAL_FUND_CHART_MOBILES.has(mobile)) return true;
  if (isSosExemptRole(user)) return true;

  const role = String(getRoleName(user) || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return (
    role === 'dev_full_access' ||
    role.includes('dev_full_access') ||
    role === 'full_access' ||
    role.endsWith('_full_access')
  );
}

type WithdrawalDoc = {
  _id?: string;
  amount?: number;
  name?: string;
  accountHolderName?: string;
  userName?: string;
  mobile?: string;
  userMobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
  status?: string;
  createdOn?: string;
  updatedOn?: string;
  transactionId?: string;
  orderId?: string;
  empCode?: string;
  accountNo?: string;
  accountNumber?: string;
  bankName?: string;
  userBankName?: string;
  ifscCode?: string;
  ifsc?: string;
  commissionAmount?: string | number;
  dp_id?: string;
  action?: { name?: string; status?: string | boolean; date?: string };
  gatewayName?: string;
  mid?: string | number;
  comment?: string;
  [key: string]: unknown;
};

type MidRow = {
  mid: string;
  totalAmount: number;
  withdrawals: WithdrawalDoc[];
  count?: number;
};

type ProviderRow = {
  type: string;
  withdrewalProviderName: string;
  totalAmount: number;
  mids: MidRow[];
};

type TypeGroup = {
  type: string;
  providers: ProviderRow[];
};

type AgentSummary = {
  name: string;
  approvedCount: number;
  lockCount: number;
  totalApprovedAmount: number;
  withdrawals: WithdrawalDoc[];
};

type MidReportSummary = {
  bothInSheetAndDbCount?: number;
  dbButNotInSheetCount?: number;
  sheetButNotInDbCount?: number;
};

type MidReportPayload = {
  summary?: MidReportSummary;
  bothInSheetAndDb?: WithdrawalDoc[];
  dbButNotInSheet?: WithdrawalDoc[];
  sheetButNotInDb?: WithdrawalDoc[];
  [key: string]: unknown;
};

type Bucket = { title: string; rows: WithdrawalDoc[]; totalAmount?: number; count?: number; lockCount?: number };

type MidSummaryState = {
  mid: string;
  payload: MidReportPayload;
  matched: number;
  dbNotSheet: number;
  sheetNotDb: number;
} | null;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatAmount(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

function dt(value: unknown): string {
  if (value == null || value === '') return '—';
  try {
    return `${formatDisplayDate(String(value))} ${formatDisplayTime(String(value))}`;
  } catch {
    return display(value);
  }
}

function istDateTime(utcDate?: string): string {
  if (!utcDate) return '';
  const dateObj = new Date(utcDate);
  if (Number.isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

/** Prefer docs / approvedItems / items / withdrawals from API mid/agent blobs. */
function pickDocList(source: unknown): WithdrawalDoc[] {
  if (!source || typeof source !== 'object') return [];
  const s = source as Record<string, unknown>;
  for (const key of ['docs', 'approvedItems', 'withdrawals', 'items', 'list'] as const) {
    const v = s[key];
    if (Array.isArray(v)) return v as WithdrawalDoc[];
  }
  return [];
}

/** Transform API `grouped` tree → Type → Provider → MID rows (desktop parity). */
function transformWithdrawData(grouped: unknown): TypeGroup[] {
  if (!grouped || typeof grouped !== 'object') return [];

  const groupedByType: Record<string, TypeGroup> = {};

  Object.entries(grouped as Record<string, unknown>).forEach(([typeKey, providers]) => {
    Object.entries((providers as Record<string, unknown>) || {}).forEach(
      ([providerName, midsObj]) => {
        const mids: MidRow[] = Object.entries((midsObj as Record<string, unknown>) || {}).map(
          ([midName, midData]) => {
            const md = midData as {
              totalAmount?: number;
              count?: number;
            };
            const withdrawals = pickDocList(midData);
            return {
              mid: midName,
              totalAmount: Number(md?.totalAmount || 0),
              count: Number(md?.count || withdrawals.length || 0),
              withdrawals,
            };
          },
        );
        const totalAmount = mids.reduce((sum, m) => sum + m.totalAmount, 0);
        const provider: ProviderRow = {
          type: typeKey,
          withdrewalProviderName: providerName,
          totalAmount,
          mids,
        };
        if (!groupedByType[typeKey]) {
          groupedByType[typeKey] = { type: typeKey, providers: [] };
        }
        groupedByType[typeKey].providers.push(provider);
      },
    );
  });

  return Object.values(groupedByType);
}

function sumGroupedTotal(grouped: unknown): number {
  if (!grouped || typeof grouped !== 'object') return 0;
  let amount = 0;
  Object.values(grouped as Record<string, unknown>).forEach((type) => {
    Object.values((type as Record<string, unknown>) || {}).forEach((bank) => {
      Object.values((bank as Record<string, unknown>) || {}).forEach((item) => {
        amount += Number((item as { totalAmount?: number })?.totalAmount || 0);
      });
    });
  });
  return amount;
}

function parseAgentSummaries(agentWiseSummary: unknown): AgentSummary[] {
  if (!agentWiseSummary || typeof agentWiseSummary !== 'object') return [];
  return Object.entries(agentWiseSummary as Record<string, unknown>).map(([name, summary]) => {
    const s = summary as {
      approvedCount?: number;
      lockCount?: number;
      totalApprovedAmount?: number;
    };
    const withdrawals = pickDocList(summary);
    return {
      name,
      approvedCount: Number(s?.approvedCount ?? withdrawals.length ?? 0),
      lockCount: Number(s?.lockCount ?? 0),
      totalApprovedAmount: Number(s?.totalApprovedAmount ?? 0),
      withdrawals,
    };
  });
}

function countEmpCodes(rows: WithdrawalDoc[]): { empCode: string; count: number }[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const code = String(r.empCode || '').trim() || 'Unassigned';
    map.set(code, (map.get(code) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([empCode, count]) => ({ empCode, count }))
    .sort((a, b) => b.count - a.count);
}

function currentMonthRangeIst(): { start: string; end: string } {
  const end = todayIST();
  const start = `${end.slice(0, 7)}-01`;
  return { start, end };
}

function typeTotal(typeItem: TypeGroup): number {
  return typeItem.providers.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
}

export function WithdrawalFundScreen() {
  // Read once — getSessionUser returns a fresh object each call; using it directly
  // in hook deps retriggers load() every render (infinite API polling).
  const sessionUser = useMemo(
    () =>
      getSessionUser() as {
        serverId?: string | number;
        mobile?: string;
        Role_ID?: string;
        Role_Name?: string;
        roleName?: string;
        role?: string;
        roles?: Record<string, string> | unknown;
      } | null,
    [],
  );
  const canShowMobile = hasPermission('show_mobile');
  const canViewChart = canShowCurrentMonthChart(sessionUser);

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState<unknown>(null);
  const [agentWise, setAgentWise] = useState<AgentSummary[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const genRef = useRef(0);

  // Drill-down navigation state.
  const [view, setView] = useState<'report' | 'providers' | 'mids' | 'withdrawals'>('report');
  const [drillType, setDrillType] = useState<TypeGroup | null>(null);
  const [drillProvider, setDrillProvider] = useState<ProviderRow | null>(null);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [row, setRow] = useState<WithdrawalDoc | null>(null);
  // Where "Back" returns from the withdrawals view (report vs mids).
  const [bucketBackView, setBucketBackView] = useState<'report' | 'mids'>('mids');
  // Sheet-comparison summary + payload for the currently opened MID.
  const [midSummary, setMidSummary] = useState<MidSummaryState>(null);

  // Per-MID latestReport cache (mid → payload) + loading state.
  const [midCache, setMidCache] = useState<Record<string, MidReportPayload>>({});
  const [midLoading, setMidLoading] = useState(false);
  const midGenRef = useRef(0);

  // Row actions (desktop WithdrawUserDataPage parity): dialer call + local comment.
  const [dialerBusy, setDialerBusy] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');

  // Current Month Chart (emp / agent pie).
  const [chartOpen, setChartOpen] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartStart, setChartStart] = useState(() => currentMonthRangeIst().start);
  const [chartEnd, setChartEnd] = useState(() => currentMonthRangeIst().end);
  const [chartEmpRows, setChartEmpRows] = useState<ChartCountRow[]>([]);
  const [chartAgentRows, setChartAgentRows] = useState<ChartCountRow[]>([]);
  const chartGenRef = useRef(0);

  /** Push a single entry to the dialer campaign (exact desktop payload). */
  const dialerCall = useCallback(
    async (item: WithdrawalDoc) => {
      setDialerBusy(true);
      try {
        const { addToDialerBatch } = await import('../../../utils/externalDialer');
        const res = await addToDialerBatch({
          campaignId: 'WDL1',
          serverId: String(sessionUser?.serverId ?? ''),
          listId: '990001',
          listName: 'Withdrawal Campaign1',
          leads: [
            {
              name: String(item?.name || item?.accountHolderName || item?.userName || ''),
              mobile: String(item?.mobile || item?.userMobile || ''),
              city: String(item?.city || ''),
              state: String(item?.state || ''),
              clientName: String(item?.clientName || ''),
              _id: String(item?._id || ''),
            },
          ],
        });
        Alert.alert('Dialer Call', res.message || (res.ok ? 'Data sent successfully' : 'Failed'));
      } catch {
        Alert.alert('Dialer Call', 'API request failed');
      } finally {
        setDialerBusy(false);
      }
    },
    [sessionUser],
  );

  const saveComment = useCallback(() => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setRow((prev) => (prev ? { ...prev, comment: trimmed } : prev));
    setBucket((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) => (r === row ? { ...r, comment: trimmed } : r)),
          }
        : prev,
    );
    setCommentOpen(false);
    Alert.alert('Comment', 'Comment added successfully');
  }, [commentText, row]);

  const types = useMemo(() => transformWithdrawData(grouped), [grouped]);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('withdrawalFund.report', {
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load withdrawal fund report');
        setGrouped(null);
        setAgentWise([]);
        setTotalAmount(0);
        return;
      }
      const body = unpackPayload(res.data);
      const g = body.grouped ?? null;
      setGrouped(g);
      setAgentWise(parseAgentSummaries(body.agentWiseSummary));
      setTotalAmount(sumGroupedTotal(g));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadChartReport = useCallback(async (start: string, end: string) => {
    if (!start || !end) {
      Alert.alert('Chart', 'Select from and to dates');
      return;
    }
    if (start > end) {
      Alert.alert('Chart', 'From date cannot be after To date');
      return;
    }
    const gen = ++chartGenRef.current;
    setChartLoading(true);
    try {
      const res = await secureApi<unknown>('withdrawalFund.report', {
        startDate: start,
        endDate: end,
      });
      if (gen !== chartGenRef.current) return;
      if (!res.ok) {
        Alert.alert('Chart', res.message || 'Failed to load chart data');
        return;
      }
      const body = unpackPayload(res.data);
      const agents = parseAgentSummaries(body.agentWiseSummary);
      const agentRows: ChartCountRow[] = agents
        .map((a) => ({ name: a.name, count: a.approvedCount || a.withdrawals.length }))
        .sort((a, b) => b.count - a.count);
      const allDocs = agents.flatMap((a) => a.withdrawals);
      const empRows: ChartCountRow[] = countEmpCodes(allDocs).map((e) => ({
        name: e.empCode,
        count: e.count,
      }));
      setChartAgentRows(agentRows);
      setChartEmpRows(empRows);
    } catch {
      if (gen === chartGenRef.current) {
        Alert.alert('Chart', 'Failed to load chart data');
      }
    } finally {
      if (gen === chartGenRef.current) setChartLoading(false);
    }
  }, []);

  const openCurrentMonthChart = useCallback(() => {
    const { start, end } = currentMonthRangeIst();
    setChartStart(start);
    setChartEnd(end);
    setChartEmpRows([]);
    setChartAgentRows([]);
    setChartOpen(true);
    void loadChartReport(start, end);
  }, [loadChartReport]);

  const loadMidReports = useCallback(
    async (provider: ProviderRow) => {
      const gen = ++midGenRef.current;
      setMidLoading(true);
      try {
        // Fetch each MID's latest report (desktop batches these in chunks of 10).
        const results = await Promise.all(
          provider.mids.map(async (m) => {
            if (midCache[m.mid]) return { mid: m.mid, payload: midCache[m.mid] };
            try {
              const res = await secureApi<unknown>('withdrawalFund.latestReport', {
                mid: m.mid,
                startDate: startDate || todayIST(),
                endDate: endDate || todayIST(),
              });
              if (!res.ok) return { mid: m.mid, payload: {} as MidReportPayload };
              return { mid: m.mid, payload: unpackPayload(res.data) as MidReportPayload };
            } catch {
              return { mid: m.mid, payload: {} as MidReportPayload };
            }
          }),
        );
        if (gen !== midGenRef.current) return;
        setMidCache((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            next[r.mid] = r.payload;
          });
          return next;
        });
      } finally {
        if (gen === midGenRef.current) setMidLoading(false);
      }
    },
    [midCache, startDate, endDate],
  );

  const openType = useCallback((typeItem: TypeGroup) => {
    setDrillType(typeItem);
    setView('providers');
  }, []);

  const openProvider = useCallback(
    (provider: ProviderRow) => {
      setDrillProvider(provider);
      setView('mids');
      void loadMidReports(provider);
    },
    [loadMidReports],
  );

  const openBucket = useCallback((b: Bucket) => {
    setBucket(b);
    setRow(null);
    setView('withdrawals');
  }, []);

  // ---------- Withdrawal-doc columns (used for detail sheet fields) ----------
  const wdColumns = useMemo<DataTableColumn<WithdrawalDoc>[]>(
    () => [
      { key: 'idx', label: '#', width: 34, render: (_r, i) => String(i + 1) },
      {
        key: 'accountHolderName',
        label: 'Account Holder',
        width: 140,
        render: (r) => display(r.accountHolderName || r.userName || r.name),
      },
      { key: 'amount', label: 'Amount', width: 100, align: 'right', render: (r) => formatAmount(r.amount ?? 0) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 120,
        render: (r) => (canShowMobile ? display(r.mobile ?? r.userMobile) : r.mobile || r.userMobile ? '**********' : '—'),
      },
      { key: 'clientName', label: 'App Code', width: 90, render: (r) => appCodeForName(r.clientName) },
      { key: 'status', label: 'Status', width: 100, render: (r) => display(r.status) },
      { key: 'empCode', label: 'Emp Code', width: 90, render: (r) => display(r.empCode) },
      { key: 'accountNo', label: 'Account No', width: 130, render: (r) => display(r.accountNo || r.accountNumber) },
      { key: 'bankName', label: 'Bank Name', width: 130, render: (r) => display(r.bankName || r.userBankName) },
      { key: 'ifsc', label: 'IFSC', width: 120, render: (r) => display(r.ifscCode || r.ifsc) },
      { key: 'commissionAmount', label: 'Commission Amount', width: 120, render: (r) => display(r.commissionAmount) },
      { key: 'dp_id', label: 'DP ID', width: 110, render: (r) => display(r.dp_id) },
      {
        key: 'action',
        label: 'Action',
        width: 150,
        render: (r) => {
          const a = r.action;
          if (!a || typeof a !== 'object') return '—';
          const parts = [display(a.name), display(a.status), a.date ? istDateTime(a.date) : ''].filter(
            (p) => p && p !== '—',
          );
          return parts.length ? parts.join(' · ') : '—';
        },
      },
      { key: 'gatewayName', label: 'Given By (Bank)', width: 140, render: (r) => display(r.gatewayName) },
      { key: 'mid', label: 'MID', width: 90, render: (r) => display(r.mid) },
      { key: 'transactionId', label: 'Transaction ID', width: 160, render: (r) => display(r.transactionId || r.orderId) },
      { key: 'comment', label: 'Comment', width: 150, render: (r) => display(r.comment) },
      {
        key: 'updatedOn',
        label: 'Updated On',
        width: 150,
        render: (r) => dt(r.updatedOn ?? r.createdOn),
      },
    ],
    [canShowMobile],
  );

  const rowActions = useMemo<SheetAction[]>(() => {
    if (!row) return [];
    return [
      {
        label: dialerBusy ? 'Sending…' : 'Dialer Call',
        tone: 'primary',
        disabled: dialerBusy,
        onPress: () => void dialerCall(row),
      },
      {
        label: 'Add Comment',
        tone: 'default',
        onPress: () => {
          setCommentText(String(row.comment || ''));
          setCommentOpen(true);
        },
      },
    ];
  }, [row, dialerBusy, dialerCall]);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!row) return [];
    return wdColumns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(row, 0),
        multiline: c.key === 'transactionId' || c.key === 'comment' || c.key === 'action',
      }));
  }, [row, wdColumns]);

  // ---------- Providers view ----------
  if (view === 'providers' && drillType) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => setView('report')}>
          <Text style={styles.backLink}>‹ Back to Withdrawal Fund</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{String(drillType.type).toUpperCase()}</Text>
        <Text style={styles.sub}>
          {startDate} → {endDate} · {drillType.providers.length} providers
        </Text>
        {drillType.providers.length === 0 ? (
          <Text style={styles.hint}>No providers</Text>
        ) : null}
        <View style={styles.list}>
          {drillType.providers.map((r, index) => (
            <TouchableOpacity
              key={`${r.withdrewalProviderName}-${index}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => openProvider(r)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(r.withdrewalProviderName)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Amount: {formatAmount(r.totalAmount)}</Text>
                <Text style={styles.cardSplitRight}>MIDs: {r.mids.length}</Text>
              </View>
              <Text style={styles.cardHint}>Tap card to see MIDs</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ---------- MID list view ----------
  if (view === 'mids' && drillProvider) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={midLoading}
            onRefresh={() => void loadMidReports(drillProvider)}
            tintColor={colors.primary}
          />
        }
      >
        <TouchableOpacity onPress={() => setView('providers')}>
          <Text style={styles.backLink}>‹ Back to Providers</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{display(drillProvider.withdrewalProviderName)}</Text>
        <Text style={styles.sub}>
          {startDate} → {endDate} · {drillProvider.mids.length} MIDs
          {midLoading ? ' · loading sheet comparison…' : ''}
        </Text>
        {drillProvider.mids.length === 0 && !midLoading ? (
          <Text style={styles.hint}>No MIDs</Text>
        ) : null}
        <View style={styles.list}>
          {drillProvider.mids.map((m, index) => (
            <TouchableOpacity
              key={`${m.mid}-${index}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => {
                const payload = midCache[m.mid];
                const s = payload?.summary;
                setBucketBackView('mids');
                openBucket({
                  title: `${m.mid} — Refunds`,
                  rows: m.withdrawals,
                  totalAmount: m.totalAmount,
                  count: m.withdrawals?.length || m.count || 0,
                });
                setMidSummary(
                  s
                    ? {
                        mid: String(m.mid),
                        payload: payload as MidReportPayload,
                        matched: Number(s.bothInSheetAndDbCount ?? 0),
                        dbNotSheet: Number(s.dbButNotInSheetCount ?? 0),
                        sheetNotDb: Number(s.sheetButNotInDbCount ?? 0),
                      }
                    : null,
                );
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(m.mid)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>Amount: {formatAmount(m.totalAmount)}</Text>
                <Text style={styles.cardSplitRight}>
                  Count: {m.withdrawals?.length || m.count || 0}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for withdrawals</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ---------- Withdrawal-doc list view ----------
  if (view === 'withdrawals' && bucket) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => {
            setBucket(null);
            setMidSummary(null);
            setView(bucketBackView);
          }}
        >
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{bucket.title}</Text>

        <View style={styles.chipsRow}>
          {bucket.totalAmount != null ? (
            <View style={styles.kpiChip}>
              <Text style={styles.kpiChipText}>Total: {formatAmount(bucket.totalAmount)}</Text>
            </View>
          ) : null}
          <View style={styles.kpiChip}>
            <Text style={styles.kpiChipText}>Count: {bucket.count ?? bucket.rows.length}</Text>
          </View>
          {bucket.lockCount != null ? (
            <View style={styles.kpiChip}>
              <Text style={styles.kpiChipText}>Lock: {bucket.lockCount}</Text>
            </View>
          ) : null}
        </View>

        {midSummary ? (
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, styles.chipMatched]}
              onPress={() =>
                openFilteredRecord(midSummary.payload, 'bothInSheetAndDb', 'Matched Records')
              }
            >
              <Text style={styles.chipText}>Matched ({midSummary.matched})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, styles.chipWarn]}
              onPress={() =>
                openFilteredRecord(midSummary.payload, 'dbButNotInSheet', 'In System, not in Statement')
              }
            >
              <Text style={styles.chipText}>In system not in sheet ({midSummary.dbNotSheet})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, styles.chipDanger]}
              onPress={() =>
                openFilteredRecord(midSummary.payload, 'sheetButNotInDb', 'In Statement, not in System')
              }
            >
              <Text style={styles.chipText}>In sheet not in system ({midSummary.sheetNotDb})</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {bucket.rows.length === 0 ? (
          <Text style={styles.hint}>No withdrawals found</Text>
        ) : null}

        <View style={styles.list}>
          {bucket.rows.map((r, index) => {
            const holder = display(r.accountHolderName || r.userName || r.name);
            const mobile = canShowMobile
              ? display(r.mobile ?? r.userMobile)
              : r.mobile || r.userMobile
                ? '**********'
                : '—';
            return (
              <TouchableOpacity
                key={`row-${index}-${String(r._id || r.transactionId || r.orderId || '')}`}
                style={styles.card}
                activeOpacity={0.75}
                onPress={() => setRow(r)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIndex}>#{index + 1}</Text>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {holder}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Amount</Text>
                  <Text style={styles.cardValue}>{formatAmount(r.amount ?? 0)}</Text>
                </View>
                <View style={styles.cardSplitRow}>
                  <Text style={styles.cardSplitLeft} numberOfLines={1}>
                    Emp Code: {display(r.empCode)}
                  </Text>
                  <Text style={styles.cardSplitRight} numberOfLines={1}>
                    Status: {display(r.status)}
                  </Text>
                </View>
                <View style={styles.cardSplitRow}>
                  <Text style={styles.cardSplitLeft} numberOfLines={1}>
                    App Code: {appCodeForName(r.clientName)}
                  </Text>
                  <Text style={styles.cardSplitRight} numberOfLines={1}>
                    Mobile: {mobile}
                  </Text>
                </View>
                <View style={styles.cardRow}>
                  <Text style={styles.cardLabel}>Date</Text>
                  <Text style={styles.cardValue}>{dt(r.updatedOn ?? r.createdOn)}</Text>
                </View>
                <Text style={styles.cardHint}>Tap card for details & actions</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <RowDetailSheet
          visible={row !== null && !commentOpen}
          title={row ? display(row.accountHolderName || row.userName || row.name) : ''}
          fields={sheetFields}
          onClose={() => setRow(null)}
          actions={rowActions}
        />

        <Modal visible={commentOpen} transparent animationType="fade" onRequestClose={() => setCommentOpen(false)}>
          <View style={styles.commentBackdrop}>
            <TouchableWithoutFeedback onPress={() => setCommentOpen(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <View style={styles.commentCard}>
              <Text style={styles.commentTitle}>Add Comment</Text>
              <Text style={styles.commentHint}>Please enter a valid comment.</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Enter your comment..."
                placeholderTextColor={colors.muted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <View style={styles.commentBtnRow}>
                <TouchableOpacity style={styles.commentCancelBtn} onPress={() => setCommentOpen(false)}>
                  <Text style={styles.commentCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.commentSaveBtn, !commentText.trim() && styles.commentSaveBtnDisabled]}
                  onPress={saveComment}
                  disabled={!commentText.trim()}
                >
                  <Text style={styles.commentSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // ---------- Main report view ----------
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>{toDisplayText('Refund Fund')}</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total Amount: {formatAmount(totalAmount)}
      </Text>

      {canViewChart ? (
        <TouchableOpacity style={styles.chartBtn} onPress={openCurrentMonthChart} activeOpacity={0.85}>
          <Text style={styles.chartBtnText}>Current Month Chart</Text>
        </TouchableOpacity>
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

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {agentWise.length > 0 ? (
        <View style={styles.agentWrap}>
          <Text style={styles.rowLabel}>Agent-wise (tap to open list)</Text>
          <View style={styles.agentGrid}>
            {agentWise.map((agent, ai) => (
              <TouchableOpacity
                key={`agent-${ai}-${agent.name || ''}`}
                style={styles.agentCard}
                activeOpacity={0.75}
                onPress={() => {
                  setBucketBackView('report');
                  setMidSummary(null);
                  openBucket({
                    title: agent.name,
                    rows: agent.withdrawals,
                    totalAmount: agent.totalApprovedAmount,
                    count: agent.approvedCount,
                    lockCount: agent.lockCount,
                  });
                }}
              >
                <Text style={styles.agentName} numberOfLines={1}>
                  {agent.name}
                </Text>
                <Text style={styles.agentCount}>Count: {agent.approvedCount}</Text>
                <Text style={styles.agentAmount} numberOfLines={1}>
                  {formatAmount(agent.totalApprovedAmount)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {loading && types.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && types.length === 0 ? (
        <Text style={styles.hint}>No withdrawal fund data for this date range</Text>
      ) : null}

      <View style={styles.list}>
        {types.map((t, index) => (
          <TouchableOpacity
            key={`${t.type}-${index}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => {
              setBucketBackView('mids');
              openType(t);
            }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {String(t.type).toUpperCase()}
              </Text>
            </View>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft}>Amount: {formatAmount(typeTotal(t))}</Text>
              <Text style={styles.cardSplitRight}>Providers: {t.providers.length}</Text>
            </View>
            <Text style={styles.cardHint}>Tap card for providers → MIDs</Text>
          </TouchableOpacity>
        ))}
      </View>

      <EmpCodePieChartModal
        visible={chartOpen}
        onClose={() => !chartLoading && setChartOpen(false)}
        loading={chartLoading}
        empCodeRows={chartEmpRows}
        agentRows={chartAgentRows}
        startDate={chartStart}
        endDate={chartEnd}
        onStartDateChange={setChartStart}
        onEndDateChange={setChartEnd}
        onApply={() => void loadChartReport(chartStart, chartEnd)}
      />
    </ScrollView>
  );

  // (Helpers below use closures; declared as function statements so they hoist.)
  function openFilteredRecord(payload: MidReportPayload, key: keyof MidReportPayload, title: string) {
    const nested =
      payload && payload.payload && typeof payload.payload === 'object'
        ? (payload.payload as Record<string, unknown>)
        : (payload as Record<string, unknown>);
    const list = nested?.[key as string];
    const rows = Array.isArray(list) ? (list as WithdrawalDoc[]) : [];
    setBucketBackView('mids');
    // keep midSummary so buckets stay switchable
    setBucket({ title, rows, count: rows.length });
    setRow(null);
    setView('withdrawals');
  }
}

const styles = StyleSheet.create({
  commentBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(5),
  },
  commentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  commentTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  commentHint: { color: colors.muted, fontSize: 12 },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    padding: spacing(3),
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    backgroundColor: colors.surfaceAlt,
  },
  commentBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(3),
    marginTop: spacing(1),
  },
  commentCancelBtn: { paddingVertical: spacing(2), paddingHorizontal: spacing(3) },
  commentCancelText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  commentSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  commentSaveBtnDisabled: { opacity: 0.5 },
  commentSaveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  chartBtn: {
    marginTop: spacing(3),
    marginBottom: spacing(1),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
    alignItems: 'center',
  },
  chartBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  backLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: spacing(2) },
  agentWrap: { marginTop: spacing(3), gap: spacing(2) },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  agentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  agentCard: {
    flexBasis: '30%',
    flexGrow: 1,
    maxWidth: '32%',
    backgroundColor: 'rgba(66,165,245,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(66,165,245,0.35)',
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(1.5),
    gap: 2,
  },
  agentName: {
    color: '#42a5f5',
    fontSize: 12,
    fontWeight: '800',
  },
  agentCount: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  agentAmount: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipMatched: { backgroundColor: 'rgba(22,163,74,0.15)', borderColor: 'rgba(22,163,74,0.4)' },
  chipWarn: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)' },
  chipDanger: { backgroundColor: 'rgba(220,38,38,0.15)', borderColor: 'rgba(220,38,38,0.4)' },
  kpiChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surfaceAlt,
  },
  kpiChipText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
});
