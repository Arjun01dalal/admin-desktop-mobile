/**
 * Show My Coin History — Laxmi ShowCoinHistory port.
 * Visible only when User.data.showCoins is truthy (coin-role flag).
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { canShowMyCoinHistory, getSessionUser, hasPermission } from '../../../auth/permissions';
import { todayIST } from '../../../utils/dates';
import { asList, unpackPayload } from '@astro/shared/api';
import { DetailFilterBar } from './DetailFilterBar';
import { styles } from './ShowMyCoinHistoryScreen.styles';

type HistoryRow = {
  _id?: string;
  userName?: string;
  userMobile?: string;
  clientName?: string;
  state?: string;
  city?: string;
  openingSubadminBalance?: string | number;
  balance?: string | number;
  closingSubadminBalance?: string | number;
  reason?: string;
  remark?: string;
  tag?: string;
  createdOn?: string;
};

type SummaryRow = {
  name?: string;
  totalBalance?: string | number;
  count?: string | number;
};

function payloadList<T>(data: unknown): T[] {
  const unpacked = unpackPayload(data);
  return asList<T>(unpacked ?? data);
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function ShowMyCoinHistoryScreen() {
  const user = useMemo(() => getSessionUser(), []);
  const allowed = canShowMyCoinHistory(user);
  const canShowMobile = hasPermission('show_mobile');

  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [coinLimit, setCoinLimit] = useState<string | number>('—');
  const [loading, setLoading] = useState(false);
  const [limitLoading, setLimitLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLimit = useCallback(async () => {
    const id = user?._id;
    if (!id) return;
    setLimitLoading(true);
    try {
      const res = await secureApi<unknown>('subadmin.getSubadmin', { _id: id });
      if (!res.ok) return;
      const payload = unpackPayload(res.data) as { coinLimit?: string | number };
      setCoinLimit(payload?.coinLimit ?? '—');
    } finally {
      setLimitLoading(false);
    }
  }, [user?._id]);

  const load = useCallback(async () => {
    const id = user?._id;
    if (!id) {
      setError('User session missing');
      return;
    }
    setLoading(true);
    setError('');
    const body = {
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
      _id: id,
    };
    try {
      const [historyRes, cumulativeRes] = await Promise.all([
        secureApi<unknown>('coin.getSubadminCoinHistory', body),
        secureApi<unknown>('coin.getSubadminCoinHistoryCumulative', body),
      ]);
      if (!historyRes.ok) {
        setError(historyRes.message || 'Failed to load coin history');
        setRows([]);
      } else {
        setRows(payloadList<HistoryRow>(historyRes.data));
      }
      if (cumulativeRes.ok) {
        const list = payloadList<SummaryRow>(cumulativeRes.data);
        setSummary(list[0] || null);
      } else {
        setSummary(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user?._id, startDate, endDate]);

  useEffect(() => {
    if (!allowed) return;
    void load();
    void loadLimit();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keyExtractor = useCallback(
    (item: HistoryRow, index: number) => String(item._id || index),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<HistoryRow>) => (
      <ShowMyCoinHistoryCard item={item} index={index} canShowMobile={canShowMobile} />
    ),
    [canShowMobile],
  );

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <Text style={styles.hint}>You do not have access (`showCoins` required).</Text>
      </View>
    );
  }

  const listHeader = (
    <>
      <Text style={styles.title}>Show My Coin History</Text>

      <DetailFilterBar
        startDate={startDate}
        endDate={endDate}
        loading={loading}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={() => void load()}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Subadmin Coin Limit</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.summaryBody}>Coin Limit: {display(coinLimit)}</Text>
          <TouchableOpacity onPress={() => void loadLimit()} disabled={limitLoading}>
            <Text style={styles.link}>{limitLoading ? '…' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {summary ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coin Summary</Text>
          <View style={styles.cardSplitRow}>
            <Text style={styles.cardSplitLeft}>Name: {display(summary.name)}</Text>
            <Text style={styles.cardSplitRight}>Count: {display(summary.count)}</Text>
          </View>
          <Text style={styles.summaryBody}>Amount: {display(summary.totalBalance)}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        loading={loading}
        emptyMessage="No coin history for this date range"
        refreshing={loading}
        onRefresh={() => {
          void load();
          void loadLimit();
        }}
      />
    </View>
  );
}

type ShowMyCoinHistoryCardProps = {
  item: HistoryRow;
  index: number;
  canShowMobile: boolean;
};

const ShowMyCoinHistoryCard = memo(function ShowMyCoinHistoryCard({
  item,
  index,
  canShowMobile,
}: ShowMyCoinHistoryCardProps) {
  const location = [item.state, item.city].filter(Boolean).join(' / ') || '—';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.userName || '—'}
        </Text>
      </View>

      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          App: {display(item.clientName)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          Tag: {display(item.tag)}
        </Text>
      </View>

      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Mobile</Text>
        <Text style={styles.cardValue}>
          {canShowMobile ? display(item.userMobile) : '**********'}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Location</Text>
        <Text style={styles.cardValue} numberOfLines={1}>
          {location}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft}>Opening: {display(item.openingSubadminBalance)}</Text>
        <Text style={styles.cardSplitRight}>Amount: {display(item.balance)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Closing</Text>
        <Text style={styles.cardValue}>{display(item.closingSubadminBalance)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Reason</Text>
        <Text style={styles.cardValue} numberOfLines={2}>
          {display(item.reason)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Remark</Text>
        <Text style={styles.cardValue} numberOfLines={3}>
          {display(item.remark)}
        </Text>
      </View>
      <Text style={styles.metaHint}>{display(item.createdOn)}</Text>
    </View>
  );
});
