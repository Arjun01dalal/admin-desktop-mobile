/**
 * Jetfair / Falcon event-wise GGR — port of desktop FalconRateManagementPage.
 * Opened from dashboard cards with route params { startDate, endDate, type }.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';

type EventRow = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  uniquePlayers: 'Unique Players',
  payin: 'Payin',
  payout: 'Payout',
  CommissionAmount: 'Commission Amount',
  commissionAmount: 'Commission Amount',
  TotalGGR: 'Total GGR',
  totalGGR: 'Total GGR',
  final_ggr: 'Final GGR',
  finalGgr: 'Final GGR',
  netpl: 'Net PL',
  profit: 'Profit',
};

const SKIP_KEYS = new Set(['eventName', 'Eventname', '_id', 'id']);

const HIGHLIGHT_KEYS = new Set([
  'TotalGGR',
  'totalGGR',
  'final_ggr',
  'finalGgr',
  'netpl',
]);

function labelFor(key: string): string {
  return (
    FIELD_LABELS[key] ||
    key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Match desktop: decrypt envelope → Object.values(payload). */
function unpackEvents(raw: unknown): EventRow[] {
  let cur: unknown = raw;
  for (let i = 0; i < 3; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (obj.payload != null) {
      cur = obj.payload;
      continue;
    }
    if (obj.data != null && typeof obj.data === 'object') {
      cur = obj.data;
      continue;
    }
    break;
  }

  if (Array.isArray(cur)) {
    return cur.filter(
      (v): v is EventRow => Boolean(v) && typeof v === 'object' && !Array.isArray(v),
    );
  }

  if (cur && typeof cur === 'object') {
    return Object.values(cur as Record<string, unknown>).filter(
      (v): v is EventRow => Boolean(v) && typeof v === 'object' && !Array.isArray(v),
    );
  }

  return [];
}

function formatValue(key: string, value: unknown): string {
  if (typeof value === 'number') {
    return key === 'uniquePlayers' ? String(value) : value.toFixed(2);
  }
  if (value == null) return '';
  return String(value);
}

export function FalconRateManagementScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = (params.startDate as string) || todayIST();
  const initialEnd = (params.endDate as string) || todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  // Match desktop: only exact `jetfair` uses jetfair API; else falcon.
  const type = String(params.type ?? 'jetfair').toLowerCase();
  const isJetfair = type === 'jetfair';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const action = isJetfair
        ? 'dashboard.jetfairByEvent'
        : 'dashboard.falconByEvent';
      const res = await secureApi(action, { startDate, endDate });
      if (!res.ok) {
        setError(res.message || 'Failed to load event GGR');
        setEvents([]);
        return;
      }
      const list = unpackEvents(res.data);
      list.sort((a, b) =>
        String(a.Eventname || a.eventName || '').localeCompare(
          String(b.Eventname || b.eventName || ''),
        ),
      );
      setEvents(list);
    } finally {
      setLoading(false);
    }
  }, [endDate, isJetfair, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = isJetfair
    ? 'Jetfair Platform Details'
    : 'Falcon Platform Details';

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
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
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && events.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && events.length === 0 && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No event data</Text>
        </View>
      ) : null}

      {events.map((event, index) => {
        const name = String(
          event.Eventname || event.eventName || `Event ${index + 1}`,
        );
        const entries = Object.entries(event).filter(([key]) => !SKIP_KEYS.has(key));
        return (
          <View key={`${name}-${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>{name}</Text>
            <View>
              {entries.map(([key, value], i) => {
                const highlight = HIGHLIGHT_KEYS.has(key);
                const num = typeof value === 'number' ? value : Number(value);
                const valueStyle = [
                  styles.rowValue,
                  highlight && Number.isFinite(num)
                    ? num < 0
                      ? styles.negative
                      : styles.positive
                    : styles.warning,
                ];
                return (
                  <View
                    key={key}
                    style={[styles.row, i < entries.length - 1 && styles.rowBorder]}
                  >
                    <Text style={styles.rowLabel}>{labelFor(key)}</Text>
                    <Text style={valueStyle}>{formatValue(key, value)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  description: {
    color: colors.muted,
    fontSize: 13,
    marginTop: spacing(1),
    marginBottom: spacing(3),
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 10,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  loadingBox: { paddingVertical: spacing(8), alignItems: 'center' },
  emptyBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(4),
  },
  emptyText: { color: colors.muted, fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
    marginBottom: spacing(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing(2),
    gap: spacing(2),
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.muted, fontSize: 13, flexShrink: 1, fontWeight: '700' },
  rowValue: { fontSize: 13, fontWeight: '800' },
  warning: { color: colors.primary },
  positive: { color: colors.success },
  negative: { color: colors.destructive },
});
