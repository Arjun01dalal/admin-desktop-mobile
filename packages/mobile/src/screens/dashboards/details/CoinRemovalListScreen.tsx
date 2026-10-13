/**
 * Coin Removal List — port of desktop CoinRemovalPage + CoinRemovalDetailsPage.
 * users.coinRemovalUsers; card tap → details / transactions (users.getTransactionHistory).
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './CoinRemovalListScreen.styles';
import { display } from '../../../utils/display';

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

  const userKeyExtractor = useCallback(
    (row: Row, index: number) => `row-${index}-${String(row._id ?? '')}`,
    [],
  );

  const renderUserItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <CoinRemovalUserCard
        row={row}
        index={index}
        page={page}
        onPress={() => setSheetRow(row)}
        onTransactions={() => openTransactions(row)}
      />
    ),
    [page, openTransactions],
  );

  const txnKeyExtractor = useCallback(
    (t: Txn, index: number) => `row-${index}-${String(t._id ?? '')}`,
    [],
  );

  const renderTxnItem = useCallback(
    ({ item: t, index }: ListRenderItemInfo<Txn>) => (
      <CoinRemovalTxnCard
        txn={t}
        index={index}
        txnPage={txnPage}
        onPress={() => setSelectedTxn(t)}
      />
    ),
    [txnPage],
  );

  // ---- Transactions drill-down view ----
  if (detailUser) {
    const txnHeader = (
      <>
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
      </>
    );

    const txnFooter = (
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
    );

    return (
      <>
        <ScreenFlatList
          style={styles.screen}
          contentContainerStyle={styles.content}
          data={txns}
          keyExtractor={txnKeyExtractor}
          renderItem={renderTxnItem}
          listHeader={txnHeader}
          listFooter={txnFooter}
          loading={txnLoading}
          emptyMessage="No transactions found"
          refreshing={txnLoading}
          onRefresh={() => void loadTxns()}
        />

        <RowDetailSheet
          visible={selectedTxn !== null}
          title={selectedTxn ? String(selectedTxn.paymentType || 'coins') : ''}
          fields={selectedTxn ? txnSheetFields(selectedTxn) : []}
          onClose={() => setSelectedTxn(null)}
        />
      </>
    );
  }

  // ---- Main list view ----
  const listHeader = (
    <>
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
    </>
  );

  const listFooter = (
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
  );

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={userKeyExtractor}
        renderItem={renderUserItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No data available"
        refreshing={loading}
        onRefresh={() => void load()}
      />

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
    </>
  );
}

type CoinRemovalUserCardProps = {
  row: Row;
  index: number;
  page: number;
  onPress: () => void;
  onTransactions: () => void;
};

const CoinRemovalUserCard = memo(function CoinRemovalUserCard({
  row,
  index,
  page,
  onPress,
  onTransactions,
}: CoinRemovalUserCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * PAGE_SIZE + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.name)}
        </Text>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onTransactions}
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
  );
});

type CoinRemovalTxnCardProps = {
  txn: Txn;
  index: number;
  txnPage: number;
  onPress: () => void;
};

const CoinRemovalTxnCard = memo(function CoinRemovalTxnCard({
  txn: t,
  index,
  txnPage,
  onPress,
}: CoinRemovalTxnCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
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
        <Text style={styles.cardValue}>{floorNum(t.balance ?? 0).toLocaleString('en-IN')}</Text>
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
  );
});
