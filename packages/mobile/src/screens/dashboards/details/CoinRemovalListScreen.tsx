/**
 * Coin Removal List — port of desktop CoinRemovalPage + CoinRemovalDetailsPage.
 * users.coinRemovalUsers { itemsPerPage, pageNo, startDate, endDate }; tap a row to see
 * all fields, then open its transactions (users.getTransactionHistory, type 'coin').
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
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
const MAIN_KEYS = new Set(['name', 'totalBalance', 'totalTransactions']);
const TXN_MAIN_KEYS = new Set(['idx', 'balance', 'tag', 'time']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
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

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'name', label: 'Name', width: 140, render: (r) => display(r.name) },
      { key: 'id', label: 'Id', width: 150, render: (r) => display(r._id) },
      { key: 'city', label: 'City', width: 110, render: (r) => display(r.city) },
      { key: 'state', label: 'State', width: 110, render: (r) => display(r.state) },
      {
        key: 'totalBalance',
        label: 'Total Coin Pulled',
        width: 120,
        align: 'center',
        render: (r) => floorNum(r.totalBalance ?? 0).toLocaleString('en-IN'),
      },
      {
        key: 'totalTransactions',
        label: 'Total Transactions',
        width: 130,
        align: 'center',
        render: (r) => String(r.totalTransactions ?? 0),
      },
    ],
    [],
  );

  const txnColumns = useMemo<DataTableColumn<Txn>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_t, i) => String((txnPage - 1) * PAGE_SIZE + i + 1),
      },
      { key: 'paymentType', label: 'Payment Type', width: 110, render: (t) => String(t.paymentType || 'coins') },
      { key: 'userId', label: 'User Id', width: 150, render: (t) => display(t.userId) },
      {
        key: 'balance',
        label: 'Balance',
        width: 90,
        align: 'center',
        render: (t) => floorNum(t.balance ?? 0).toLocaleString('en-IN'),
      },
      { key: 'updatedBy', label: 'Updated By', width: 120, render: (t) => display(t.updatedBy?.name) },
      { key: 'reason', label: 'Reason', width: 120, render: (t) => display(t.reason) },
      { key: 'tag', label: 'Tag', width: 90, align: 'center', render: (t) => display(t.tag) },
      { key: 'remark', label: 'Remark', width: 120, render: (t) => display(t.remark || t.remakr) },
      {
        key: 'time',
        label: 'Time',
        width: 150,
        render: (t) =>
          t.createdOn ? `${formatDisplayDate(t.createdOn)} ${formatDisplayTime(t.createdOn)}` : '—',
      },
    ],
    [txnPage],
  );

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
            txnGenRef.current += 1; // invalidate any in-flight request
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

        <DataTable
          columns={txnColumns.filter((c) => TXN_MAIN_KEYS.has(c.key))}
          rows={txns}
          keyFor={(t, i) => String(t._id || i)}
          loading={txnLoading}
          emptyMessage="No transactions found"
          onRowPress={(t) => setSelectedTxn(t)}
          hint="Tap a row to see all details"
        />

        <RowDetailSheet
          visible={selectedTxn !== null}
          title={selectedTxn ? String(selectedTxn.paymentType || 'coins') : ''}
          fields={
            selectedTxn
              ? txnColumns
                  .filter((c) => c.key !== 'idx')
                  .map<SheetField>((c) => ({ label: c.label, value: c.render(selectedTxn, 0) }))
              : []
          }
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

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No data available"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns.map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        actions={[
          {
            label: 'Open transactions',
            onPress: () => {
              if (sheetRow) {
                txnGenRef.current += 1; // invalidate stale in-flight transactions
                setTxns([]);
                setDetailUser(sheetRow);
                setTxnPage(1);
              }
              setSheetRow(null);
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
