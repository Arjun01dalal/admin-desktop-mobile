/**
 * House Games — transactions list (Ludo admin).
 * Port of desktop HouseGamesPage with the mobile screen structure:
 * date filter, paginated DataTable with main columns, bottom sheet
 * with every column, pull-to-refresh.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { colors, radius, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type TxnRow = {
  _id?: string;
  name?: string;
  userId?: string;
  txnId?: string;
  transactionId?: string;
  refTxnId?: string;
  roundId?: string;
  sessionId?: string;
  gameId?: string;
  operatorId?: string;
  type?: string;
  status?: string;
  currency?: string;
  amount?: number;
  winingPoint?: number;
  roundCapacity?: number;
  isBot?: boolean;
  bot?: boolean;
  createdAt?: string;
  createdOn?: string;
  updatedAt?: string;
};

const ITEMS_PER_PAGE = 50;

/** Mirrors desktop useHouseGamesQuery row unwrapping. */
function asRows(raw: unknown): TxnRow[] {
  if (Array.isArray(raw)) return raw as TxnRow[];
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  for (const key of ['items', 'transactions', 'results', 'docs', 'data']) {
    if (Array.isArray(obj[key])) return obj[key] as TxnRow[];
  }
  if (obj.data && typeof obj.data === 'object') {
    const nested = obj.data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items as TxnRow[];
  }
  return [];
}

function pickNumber(raw: unknown, keys: string[]): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  for (const key of keys) {
    const v = key.includes('.')
      ? key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
      : obj[key];
    const n = Number(v);
    if (v !== undefined && v !== null && Number.isFinite(n)) return n;
  }
  return null;
}

function fmt2(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function fmtDate(row: TxnRow): string {
  const raw = row.createdAt || row.createdOn || row.updatedAt;
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} - ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Columns shown in the list; the bottom sheet shows all of them. */
const MAIN_KEYS = new Set(['name', 'amount', 'status', 'created']);

export function HouseGamesScreen() {
  const isFocused = useIsFocused();

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [pageNo, setPageNo] = useState(1);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<TxnRow | null>(null);
  const genRef = React.useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const res = await secureApi('houseGames.transactions', {
        pageNo,
        itemsPerPage: ITEMS_PER_PAGE,
        startDate,
        endDate,
        filter: {},
      });
      if (gen !== genRef.current) return; // stale response
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to load house games');
        setRows([]);
        return;
      }
      const data = res.data;
      setRows(asRows(data));
      const count = pickNumber(data, ['total', 'count', 'totalCount', 'data.total', 'data.count']);
      setTotalCount(count);
      setTotalAmount(pickNumber(data, ['totals.totalAmount', 'data.totals.totalAmount']));
      const pages = pickNumber(data, ['totalPages', 'data.totalPages']);
      setTotalPages(pages ?? (count !== null ? Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)) : 1));
      setError('');
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [pageNo, startDate, endDate]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

  const columns = useMemo<DataTableColumn<TxnRow>[]>(
    () => [
      { key: 'name', label: 'Name', width: 130, render: (r) => String(r.name || '—') },
      { key: 'userId', label: 'User ID', width: 130, render: (r) => String(r.userId || '—') },
      { key: 'txnId', label: 'Transaction ID', width: 160, render: (r) => String(r.txnId || r.transactionId || '—') },
      { key: 'refTxnId', label: 'Ref Txn ID', width: 160, render: (r) => String(r.refTxnId || '—') },
      { key: 'roundId', label: 'Round ID', width: 140, render: (r) => String(r.roundId || '—') },
      { key: 'sessionId', label: 'Session ID', width: 140, render: (r) => String(r.sessionId || '—') },
      { key: 'gameId', label: 'Game ID', width: 110, render: (r) => String(r.gameId || '—') },
      { key: 'operatorId', label: 'Operator ID', width: 110, render: (r) => String(r.operatorId || '—') },
      { key: 'type', label: 'Type', width: 90, render: (r) => String(r.type || '—') },
      { key: 'status', label: 'Status', width: 90, render: (r) => String(r.status || '—') },
      { key: 'currency', label: 'Currency', width: 80, render: (r) => String(r.currency || '—') },
      { key: 'amount', label: 'Amount', width: 90, align: 'right', render: (r) => fmt2(r.amount) },
      { key: 'winingPoint', label: 'Winning Point', width: 110, align: 'right', render: (r) => fmt2(r.winingPoint) },
      { key: 'roundCapacity', label: 'Round Capacity', width: 110, align: 'right', render: (r) => String(r.roundCapacity ?? '—') },
      { key: 'isBot', label: 'Is Bot', width: 70, render: (r) => ((r.isBot ?? r.bot) ? 'Yes' : 'No') },
      { key: 'created', label: 'Created', width: 150, render: (r) => fmtDate(r) },
    ],
    [],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>House Games</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row to see all details
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setPageNo(1);
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      {/* Totals summary */}
      {(totalCount !== null || totalAmount !== null) && (
        <View style={styles.totalsRow}>
          {totalCount !== null && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Transactions</Text>
              <Text style={styles.totalValue}>{totalCount.toLocaleString('en-IN')}</Text>
            </View>
          )}
          {totalAmount !== null && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>{fmt2(totalAmount)}</Text>
            </View>
          )}
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || r.txnId || i)}
        emptyMessage={loading ? 'Loading…' : 'No Data Found'}
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      {/* Pagination */}
      <View style={styles.pagerRow}>
        <TouchableOpacity
          style={[styles.pagerBtn, (pageNo <= 1 || loading) && styles.pagerBtnDisabled]}
          disabled={pageNo <= 1 || loading}
          onPress={() => setPageNo((p) => Math.max(1, p - 1))}
          accessibilityRole="button"
        >
          <Text style={styles.pagerBtnText}>‹ Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pagerLabel}>
          Page {pageNo} of {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pagerBtn, (pageNo >= totalPages || loading) && styles.pagerBtnDisabled]}
          disabled={pageNo >= totalPages || loading}
          onPress={() => setPageNo((p) => Math.min(totalPages, p + 1))}
          accessibilityRole="button"
        >
          <Text style={styles.pagerBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.name || selected.txnId || 'Details') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label,
                value: c.render(selected, 0),
                color: c.color?.(selected),
              }))
            : []
        }
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13, marginTop: spacing(1), marginBottom: spacing(3) },
  totalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginBottom: spacing(3) },
  totalCard: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  totalLabel: { color: colors.muted, fontSize: 12 },
  totalValue: { color: colors.foreground, fontSize: 18, fontWeight: '700', marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
  },
  pagerBtn: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  pagerLabel: { color: colors.muted, fontSize: 13 },
});
