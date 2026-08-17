/**
 * Coin Removal List — port of desktop CoinRemovalPage + CoinRemovalDetailsPage.
 * users.coinRemovalUsers; card tap → details / transactions (users.getTransactionHistory).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  name?: string;
  city?: string;
  state?: string;
  totalBalance?: number | string;
  totalTransactions?: number | string;
  [key: string]: unknown;
};

type Txn = {
  _id?: string;
  paymentType?: string;
  userId?: string;
  balance?: number | string;
  updatedBy?: { name?: string };
  reason?: string;
  tag?: string;
  remark?: string;
  remakr?: string;
  createdOn?: string;
  [key: string]: unknown;
};

const PAGE_SIZE = 25;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatTs(ts?: string): string {
  if (!ts) return '—';
  return `${formatDisplayDate(ts)} ${formatDisplayTime(ts)}`;
}

export function CoinRemovalListScreen() {
  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Drill-down (desktop /coins-removal/details)
  const [detailUser, setDetailUser] = useState<Row | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotalPages, setTxnTotalPages] = useState(1);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<Txn | null>(null);
  const genRef = useRef(0);
  const txnGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('users.coinRemovalUsers', {
        itemsPerPage: PAGE_SIZE,
        pageNo: page,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load coin removal list');
        setRows([]);
        setTotalPages(1);
        return;
      }
      const data = (res.data || {}) as { items?: Row[]; totalPages?: number };
      setSheetRow(null);
      setRows(Array.isArray(data.items) ? data.items : []);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTxns = useCallback(async () => {
    if (!detailUser?._id) return;
    const gen = ++txnGenRef.current;
    setTxnLoading(true);
    setTxnError(null);
    try {
      const res = await secureApi<unknown>('users.getTransactionHistory', {
        itemsPerPage: PAGE_SIZE,
        pageNo: txnPage,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
        type: 'coin',
        filterDeposit: { userId: detailUser._id },
        filterWithdrawal: { dp_id: detailUser._id },
        filterCoin: { userId: detailUser._id, tag: 'debit' },
      });
      if (gen !== txnGenRef.current) return;
      if (!res.ok) {
        setTxnError(res.message || 'Failed to load transactions');
        setTxns([]);
        setTxnTotalPages(1);
        return;
      }
      const data = (res.data || {}) as { items?: Txn[]; totalPages?: number };
      setTxns(Array.isArray(data.items) ? data.items : []);
      setTxnTotalPages(Math.max(1, Number(data.totalPages) || 1));
    } finally {
      if (gen === txnGenRef.current) setTxnLoading(false);
    }
  }, [detailUser, txnPage, startDate, endDate]);

  useEffect(() => {
    void loadTxns();
  }, [loadTxns]);

  const openTransactions = useCallback((row: Row) => {
    txnGenRef.current += 1;
    setTxns([]);
    setDetailUser(row);
    setTxnPage(1);
    setSheetRow(null);
  }, []);

  const userSheetFields = (r: Row): SheetField[] => [
    { label: 'Name', value: display(r.name) },
    { label: 'Id', value: display(r._id) },
    { label: 'City', value: display(r.city) },
    { label: 'State', value: display(r.state) },
    {
      label: 'Total Coin Pulled',
      value: floorNum(r.totalBalance ?? 0).toLocaleString('en-IN'),
    },
    { label: 'Total Transactions', value: String(r.totalTransactions ?? 0) },
  ];

  const txnSheetFields = (t: Txn): SheetField[] => [
    { label: 'Payment Type', value: String(t.paymentType || 'coins') },
    { label: 'User Id', value: display(t.userId) },
    { label: 'Balance', value: floorNum(t.balance ?? 0).toLocaleString('en-IN') },
    { label: 'Updated By', value: display(t.updatedBy?.name) },
    { label: 'Reason', value: display(t.reason) },
    { label: 'Tag', value: display(t.tag) },
    { label: 'Remark', value: display(t.remark || t.remakr) },
    { label: 'Time', value: formatTs(t.createdOn) },
  ];

  // ---- Transactions drill-down view ----
  if (detailUser) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={txnLoading} onRefresh={() => void loadTxns()} tintColor={colors.primary} />
        }
      >
        <TouchableOpacity
          onPress={() => {
            txnGenRef.current += 1;
            setDetailUser(null);
            setTxns([]);
            setTxnPage(1);
            setSelectedTxn(null);
          }}
        >
          <Text style={styles.backLink}>‹ Back to Coin Removal List</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Coin Removal Transactions</Text>
        <Text style={styles.sub}>
          {display(detailUser.name)} · {startDate} → {endDate}
        </Text>

        {txnError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{txnError}</Text>
          </View>
        ) : null}

        {txnLoading && txns.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
        {!txnLoading && txns.length === 0 ? (
          <Text style={styles.hint}>No transactions found</Text>
        ) : null}

        <View style={styles.list}>
          {txns.map((t, index) => (
            <TouchableOpacity
              key={`row-${index}-${String(t._id ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSelectedTxn(t)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(txnPage - 1) * PAGE_SIZE + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {String(t.paymentType || 'coins')}
                </Text>
                <Text style={styles.cardBadge} numberOfLines={1}>
                  {display(t.tag)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Balance</Text>
                <Text style={styles.cardValue}>
                  {floorNum(t.balance ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Updated By</Text>
                <Text style={styles.cardValue}>{display(t.updatedBy?.name)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Time</Text>
                <Text style={styles.cardValue}>{formatTs(t.createdOn)}</Text>
              </View>
              <Text style={styles.cardHint}>Tap for full details</Text>
            </TouchableOpacity>
          ))}
        </View>

        <RowDetailSheet
          visible={selectedTxn !== null}
          title={selectedTxn ? String(selectedTxn.paymentType || 'coins') : ''}
          fields={selectedTxn ? txnSheetFields(selectedTxn) : []}
          onClose={() => setSelectedTxn(null)}
        />

        <View style={styles.pager}>
          <Text
            style={[styles.pagerBtn, txnPage <= 1 && styles.pagerDisabled]}
            onPress={() => txnPage > 1 && setTxnPage((p) => p - 1)}
          >
            ‹ Prev
          </Text>
          <Text style={styles.pagerLabel}>
            Page {txnPage} / {txnTotalPages}
          </Text>
          <Text
            style={[styles.pagerBtn, txnPage >= txnTotalPages && styles.pagerDisabled]}
            onPress={() => txnPage < txnTotalPages && setTxnPage((p) => p + 1)}
          >
            Next ›
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ---- Main list view ----
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Coin Removal List</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate}
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
          setPage(1);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No data available</Text> : null}

      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSheetRow(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * PAGE_SIZE + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => openTransactions(row)}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Text style={styles.actionBtnText}>Transactions</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Coin Pulled</Text>
              <Text style={styles.cardValue}>
                {floorNum(row.totalBalance ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Transactions</Text>
              <Text style={styles.cardValue}>{String(row.totalTransactions ?? 0)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>City / State</Text>
              <Text style={styles.cardValue}>
                {display(row.city)} · {display(row.state)}
              </Text>
            </View>
            <Text style={styles.cardHint}>Tap card for full details</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={sheetRow ? userSheetFields(sheetRow) : []}
        actions={[
          {
            label: 'Open transactions',
            tone: 'primary',
            onPress: () => {
              if (sheetRow) openTransactions(sheetRow);
            },
          },
        ]}
        onClose={() => setSheetRow(null)}
      />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  backLink: { color: colors.primary, fontWeight: '700', fontSize: 14, marginBottom: spacing(2) },
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
  cardBadge: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: 90,
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    flexShrink: 0,
  },
  actionBtnText: {
    color: colors.primaryForeground,
    fontSize: 10,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '40%' },
  cardValue: { color: colors.foreground, fontSize: 11, flex: 1, textAlign: 'right' },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerLabel: { color: colors.muted, fontSize: 13 },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
});
