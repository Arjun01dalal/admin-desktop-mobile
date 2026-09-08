/** User Report feature module. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme';
import { floorNum } from '../../dashboards/mergeMetrics';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { ResponsiveTable } from '../../dashboards/ui/ResponsiveTable';
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
          return t === 'CR' || t === 'CREDITED'
            ? 'Credit'
            : t === 'DR' || t === 'DEBITED'
              ? 'Debit'
              : display(r.transactionType);
        },
        color: (r) => {
          const t = String(r.transactionType ?? '').toUpperCase();
          return t === 'CR' || t === 'CREDITED' ? colors.success : colors.destructive;
        },
      },
      {
        key: 'opening',
        label: 'Opening',
        width: 90,
        render: (r) => floorNum(num(r.lastBalance)).toLocaleString('en-IN'),
      },
      {
        key: 'amount',
        label: 'Amount',
        width: 90,
        render: (r) => floorNum(num(r.amount)).toLocaleString('en-IN'),
      },
      {
        key: 'closing',
        label: 'Closing',
        width: 90,
        render: (r) => floorNum(num(r.balance)).toLocaleString('en-IN'),
      },
      { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
    ],
    [],
  );

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
      <ResponsiveTable
        forceCards
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
