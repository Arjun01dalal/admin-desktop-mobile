/** User Report feature module. */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme';
import { floorNum } from '../../dashboards/mergeMetrics';
import { secureApi } from '../../api/client';
import { DateField } from '../../components/DateField';
import {
  CollapsibleSection,
} from './HistoryFilterBar';
import { BetAmountChart } from './BetAmountChart';
import { Pager } from './Pager';
import { styles } from '../UserReportScreen.styles';
import {
  detailText,
  display,
  listOf,
  num,
  pagesOf,
  parseChartPayload,
  when,
  type Rec,
} from './helpers';

function txKind(row: Rec): 'credit' | 'debit' | 'other' {
  const t = String(row.transactionType ?? '').toUpperCase();
  if (t === 'CR' || t === 'CREDITED' || t === 'CREDIT') return 'credit';
  if (t === 'DR' || t === 'DEBITED' || t === 'DEBIT') return 'debit';
  return 'other';
}

function txLabel(kind: 'credit' | 'debit' | 'other', row: Rec): string {
  if (kind === 'credit') return 'Credit';
  if (kind === 'debit') return 'Debit';
  return display(row.transactionType);
}

function formatMoney(value: unknown): string {
  return floorNum(num(value)).toLocaleString('en-IN');
}

function WalletHistoryCard({ row, index }: { row: Rec; index: number }) {
  const kind = txKind(row);
  const amount = floorNum(num(row.amount));
  const amountPrefix = kind === 'credit' ? '+' : kind === 'debit' ? '−' : '';

  return (
    <View
      style={[
        styles.walletCard,
        kind === 'credit' ? styles.walletCardCredit : null,
        kind === 'debit' ? styles.walletCardDebit : null,
      ]}
    >
      <View style={styles.walletTop}>
        <View style={styles.walletIndex}>
          <Text style={styles.walletIndexText}>#{index + 1}</Text>
        </View>
        <View
          style={[
            styles.walletTypePill,
            kind === 'credit'
              ? styles.walletTypeCredit
              : kind === 'debit'
                ? styles.walletTypeDebit
                : styles.walletTypeNeutral,
          ]}
        >
          <Text
            style={[
              styles.walletTypeText,
              kind === 'credit'
                ? styles.walletTypeTextCredit
                : kind === 'debit'
                  ? styles.walletTypeTextDebit
                  : styles.walletTypeTextNeutral,
            ]}
          >
            {txLabel(kind, row)}
          </Text>
        </View>
      </View>

      <View>
        <Text style={styles.walletProvider} numberOfLines={2}>
          {display(row.providerName)}
        </Text>
        <Text style={styles.walletCreated} numberOfLines={1}>
          {when(row)}
        </Text>
      </View>

      <View style={styles.walletMoneyRow}>
        <View style={styles.walletMoneyCell}>
          <Text style={styles.walletMoneyLabel}>Opening</Text>
          <Text style={styles.walletMoneyValue} numberOfLines={1}>
            {formatMoney(row.lastBalance)}
          </Text>
        </View>
        <View style={styles.walletMoneyDivider} />
        <View style={styles.walletMoneyCell}>
          <Text style={styles.walletMoneyLabel}>Amount</Text>
          <Text
            style={[
              styles.walletMoneyValue,
              kind === 'credit'
                ? styles.walletAmountCredit
                : kind === 'debit'
                  ? styles.walletAmountDebit
                  : null,
            ]}
            numberOfLines={1}
          >
            {amountPrefix}
            {amount.toLocaleString('en-IN')}
          </Text>
        </View>
        <View style={styles.walletMoneyDivider} />
        <View style={styles.walletMoneyCell}>
          <Text style={styles.walletMoneyLabel}>Closing</Text>
          <Text style={styles.walletMoneyValue} numberOfLines={1}>
            {formatMoney(row.balance)}
          </Text>
        </View>
      </View>

      <View style={styles.walletMetaGrid}>
        <View style={styles.walletMetaItem}>
          <Text style={styles.walletMetaLabel}>Action</Text>
          <Text style={[styles.walletMetaValue, styles.walletMetaAction]} numberOfLines={2}>
            {display(row.action)}
          </Text>
        </View>
        <View style={styles.walletMetaItem}>
          <Text style={styles.walletMetaLabel}>Detail</Text>
          <Text style={styles.walletMetaValue} numberOfLines={2}>
            {detailText(row)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function WalletTab({ userId }: { userId: string }) {
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

  return (
    <View>
      <CollapsibleSection title="Bet Amount Overview">
        <BetAmountChart data={chartData} />
      </CollapsibleSection>
      <CollapsibleSection title="Search Filters">
        <View style={styles.filterRow}>
          <View style={styles.dateWrap}>
            <DateField
              value={startDate}
              onChange={(v) => {
                setStartDate(v);
                setPage(1);
              }}
              placeholder="From"
            />
          </View>
          <View style={styles.dateWrap}>
            <DateField
              value={endDate}
              onChange={(v) => {
                setEndDate(v);
                setPage(1);
              }}
              placeholder="To"
            />
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
      </CollapsibleSection>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={styles.walletLoading} color={colors.primary} />
      ) : rows.length === 0 ? (
        <Text style={styles.walletEmpty}>No wallet history</Text>
      ) : (
        <View style={styles.walletList}>
          {rows.map((row, index) => (
            <WalletHistoryCard key={String(row._id ?? index)} row={row} index={index} />
          ))}
        </View>
      )}

      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}
