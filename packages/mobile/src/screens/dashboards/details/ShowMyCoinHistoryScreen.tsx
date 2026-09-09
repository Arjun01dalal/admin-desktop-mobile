/**
 * Show My Coin History — Laxmi ShowCoinHistory port.
 * Visible only when User.data.showCoins is truthy (coin-role flag).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { makeStyles } from '../../../styles/common';
import { colors, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { canShowMyCoinHistory, getSessionUser, hasPermission } from '../../../auth/permissions';
import { todayIST } from '../../../utils/dates';
import { asList, unpackPayload } from '@astro/shared/api';
import { DetailFilterBar } from './DetailFilterBar';

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

  if (!allowed) {
    return (
      <View style={styles.screen}>
        <Text style={styles.hint}>You do not have access (`showCoins` required).</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            void load();
            void loadLimit();
          }}
          tintColor={colors.primary}
        />
      }
    >
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
          <Text style={styles.body}>Coin Limit: {String(coinLimit)}</Text>
          <TouchableOpacity onPress={() => void loadLimit()} disabled={limitLoading}>
            <Text style={styles.link}>{limitLoading ? '…' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {summary ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Coin Summary</Text>
          <Text style={styles.body}>Name: {summary.name || '—'}</Text>
          <Text style={styles.body}>Amount: {String(summary.totalBalance ?? '—')}</Text>
          <Text style={styles.body}>Count: {String(summary.count ?? '—')}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <ActivityIndicator color={colors.primary} /> : null}

      {rows.map((item, index) => (
        <View key={item._id || String(index)} style={styles.card}>
          <Text style={styles.cardTitle}>
            #{index + 1} {item.userName || '—'}
          </Text>
          <Text style={styles.body}>
            Mobile: {canShowMobile ? item.userMobile || '—' : '**********'}
          </Text>
          <Text style={styles.body}>App: {item.clientName || '—'}</Text>
          <Text style={styles.body}>
            {item.state || '—'} / {item.city || '—'}
          </Text>
          <Text style={styles.body}>Opening: {String(item.openingSubadminBalance ?? '—')}</Text>
          <Text style={styles.body}>Amount: {String(item.balance ?? '—')}</Text>
          <Text style={styles.body}>Closing: {String(item.closingSubadminBalance ?? '—')}</Text>
          <Text style={styles.body}>Reason: {item.reason || '—'}</Text>
          <Text style={styles.body}>Remark: {item.remark || '—'}</Text>
          <Text style={styles.body}>Tag: {item.tag || '—'}</Text>
          <Text style={styles.hint}>{item.createdOn || '—'}</Text>
        </View>
      ))}

      {!loading && rows.length === 0 && !error ? (
        <Text style={styles.hint}>No coin history for this date range</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = makeStyles({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  body: { color: colors.foreground, fontSize: 13, marginBottom: 2 },
  hint: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  errorBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  errorText: { color: colors.destructive },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: colors.primary, fontWeight: '600' },
});
