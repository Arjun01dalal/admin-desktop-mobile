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
  useWindowDimensions,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

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

function typeTotal(typeItem: TypeGroup): number {
  return typeItem.providers.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
}

export function WithdrawalFundScreen() {
  // Read once — getSessionUser returns a fresh object each call; using it directly
  // in hook deps retriggers load() every render (infinite API polling).
  const sessionUser = useMemo(() => getSessionUser() as { serverId?: string | number } | null, []);
  const canShowMobile = hasPermission('show_mobile');

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

  /** Push a single entry to the dialer campaign (exact desktop payload). */
  const dialerCall = useCallback(
    async (item: WithdrawalDoc) => {
      const SERVER_MAP: Record<string, string> = { '1': 'api2', '3': 'api', default: 'api' };
      const serverPrefix = SERVER_MAP[String(sessionUser?.serverId ?? '')] || SERVER_MAP.default;
      const apiUrl = `https://${serverPrefix}.ganesha999.com/API/`;
      const payload = {
        list_id: '990001',
        list_name: 'Withdrawal Campaign1',
        campaign_id: 'WDL1',
        leads: [
          {
            first_name: item?.name || item?.accountHolderName || item?.userName,
            phone_number: item?.mobile || item?.userMobile,
            city: item?.city,
            state: item?.state,
            email: item?.clientName,
            comments: item?.clientName,
            province: item?._id,
          },
        ],
      };
      setDialerBusy(true);
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('failed');
        Alert.alert('Dialer Call', 'Data sent successfully');
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

  // ---------- Fit main columns to phone width (PlayerRtpScreen pattern) ----------
  const { width: screenWidth } = useWindowDimensions();
  const availableWidth = Math.max(280, screenWidth - spacing(4) * 2 - spacing(2));
  const IDX_W = 34;
  const fit = (weight: number, totalWeight: number) =>
    Math.floor(((availableWidth - IDX_W) * weight) / totalWeight);

  // Type list columns.
  const typeW = { name: fit(5, 8), total: fit(3, 8) };
  const typeColumns = useMemo<DataTableColumn<TypeGroup>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      {
        key: 'type',
        label: 'Type',
        width: typeW.name,
        color: () => colors.primary,
        render: (r) => String(r.type).toUpperCase(),
      },
      {
        key: 'total',
        label: 'Total Amount',
        width: typeW.total,
        align: 'right',
        render: (r) => formatAmount(typeTotal(r)),
      },
      { key: 'count', label: 'Providers', width: 90, align: 'center', render: (r) => String(r.providers.length) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableWidth],
  );

  // Provider list columns.
  const provW = { name: fit(5, 8), total: fit(3, 8) };
  const providerColumns = useMemo<DataTableColumn<ProviderRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      {
        key: 'name',
        label: 'Provider',
        width: provW.name,
        color: () => colors.primary,
        render: (r) => display(r.withdrewalProviderName),
      },
      {
        key: 'total',
        label: 'Total Amount',
        width: provW.total,
        align: 'right',
        render: (r) => formatAmount(r.totalAmount),
      },
      { key: 'count', label: 'MIDs', width: 70, align: 'center', render: (r) => String(r.mids.length) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableWidth],
  );

  // MID list columns (fit main subset to width).
  const midW = { mid: fit(4, 10), total: fit(3, 10), count: fit(3, 10) };
  const midColumns = useMemo<DataTableColumn<MidRow>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      { key: 'mid', label: 'MID', width: midW.mid, color: () => colors.primary, render: (r) => display(r.mid) },
      { key: 'total', label: 'Total Amount', width: midW.total, align: 'right', render: (r) => formatAmount(r.totalAmount) },
      {
        key: 'count',
        label: 'Count',
        width: midW.count,
        align: 'center',
        render: (r) => String(r.withdrawals?.length || r.count || 0),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableWidth],
  );

  // Withdrawal-doc columns (main subset fit to width; full set in the sheet).
  const wdW = { name: fit(4.2, 10), amount: fit(2.6, 10), mobile: fit(3.2, 10) };
  const wdColumns = useMemo<DataTableColumn<WithdrawalDoc>[]>(
    () => [
      { key: 'idx', label: '#', width: IDX_W, render: (_r, i) => String(i + 1) },
      {
        key: 'accountHolderName',
        label: 'Account Holder',
        width: wdW.name,
        render: (r) => display(r.accountHolderName || r.userName || r.name),
      },
      { key: 'amount', label: 'Amount', width: wdW.amount, align: 'right', render: (r) => formatAmount(r.amount ?? 0) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: wdW.mobile,
        render: (r) => (canShowMobile ? display(r.mobile ?? r.userMobile) : r.mobile || r.userMobile ? '**********' : '—'),
      },
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

  const wdMainKeys = ['idx', 'accountHolderName', 'amount', 'mobile'];

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
        <DataTable
          columns={providerColumns}
          rows={drillType.providers}
          keyFor={(r, i) => `${r.withdrewalProviderName}-${i}`}
          emptyMessage="No providers"
          onRowPress={(r) => openProvider(r)}
          hint="Tap a provider to see its MIDs"
        />
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
        <DataTable
          columns={midColumns}
          rows={drillProvider.mids}
          keyFor={(r, i) => `${r.mid}-${i}`}
          loading={midLoading}
          emptyMessage="No MIDs"
          onRowPress={(m) => {
            const payload = midCache[m.mid];
            const s = payload?.summary;
            setBucketBackView('mids');
            openBucket({
              title: `${m.mid} — Withdrawals`,
              rows: m.withdrawals,
              totalAmount: m.totalAmount,
              count: m.withdrawals?.length || m.count || 0,
            });
            // stash summary so it renders on the withdrawals screen
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
          hint="Tap a MID to see its withdrawals & sheet-comparison buckets"
        />
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

        <DataTable
          columns={wdColumns.filter((c) => wdMainKeys.includes(c.key))}
          rows={bucket.rows}
          keyFor={(r, i) => String(r._id || r.transactionId || r.orderId || i)}
          emptyMessage="No withdrawals found"
          onRowPress={(r) => setRow(r)}
          hint="Tap a row to see all details"
        />

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
      <Text style={styles.title}>Withdrawal Fund</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Total Amount: {formatAmount(totalAmount)}
      </Text>

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
          <View style={styles.chipsRow}>
            {agentWise.map((agent) => (
              <TouchableOpacity
                key={agent.name}
                style={[styles.chip, styles.chipAgent]}
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
                <Text style={styles.chipAgentText}>
                  {agent.name} — Count({agent.approvedCount}) | Amount({formatAmount(agent.totalApprovedAmount)})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <DataTable
        columns={typeColumns}
        rows={types}
        keyFor={(r, i) => `${r.type}-${i}`}
        loading={loading}
        emptyMessage="No withdrawal fund data for this date range"
        onRowPress={(t) => {
          setBucketBackView('mids');
          openType(t);
        }}
        hint="Tap a type to drill into providers → MIDs"
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
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  backLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: spacing(2) },
  agentWrap: { marginTop: spacing(3), gap: spacing(2) },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
  chipAgent: { backgroundColor: 'rgba(66,165,245,0.15)', borderColor: 'rgba(66,165,245,0.4)' },
  chipAgentText: { color: '#42a5f5', fontSize: 12, fontWeight: '600' },
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
});
