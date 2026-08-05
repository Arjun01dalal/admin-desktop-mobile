/**
 * AAA exchange game-wise P/L — port of desktop ExchangeRateManagementPage.
 * Opened from dashboard AAA card with route params { startDate, endDate }.
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
import { floorNum, toNum } from '../../../dashboards/mergeMetrics';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';

type GameRow = Record<string, unknown>;

export function ExchangeRateManagementScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialStart = (params.startDate as string) || todayIST();
  const initialEnd = (params.endDate as string) || todayIST();
  const [draftStart, setDraftStart] = useState(initialStart);
  const [draftEnd, setDraftEnd] = useState(initialEnd);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<GameRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi('dashboard.aaaGameWise', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load AAA exchange data');
        setRows([]);
        return;
      }
      const raw = res.data;
      const list = Array.isArray(raw)
        ? (raw as GameRow[])
        : raw && typeof raw === 'object'
          ? (Object.values(raw as Record<string, unknown>).filter(
              (v) => v && typeof v === 'object',
            ) as GameRow[])
          : [];
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
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
      <Text style={styles.title}>AAA Exch Details</Text>
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

      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No AAA exchange data</Text>
        </View>
      ) : null}

      {rows.map((r, index) => {
        const name = String(
          r.gameName || r.eventName || r.name || `Game ${index + 1}`,
        );
        const entries = Object.entries(r).filter(
          ([k, v]) =>
            k !== 'gameName' &&
            k !== 'eventName' &&
            k !== 'name' &&
            (typeof v === 'number' || typeof v === 'string'),
        );
        return (
          <View key={`${name}-${index}`} style={styles.card}>
            <Text style={styles.cardTitle}>{name}</Text>
            <View>
              {entries.map(([key, value], i) => {
                const display =
                  typeof value === 'number'
                    ? floorNum(toNum(value)).toLocaleString('en-IN')
                    : String(value);
                return (
                  <View
                    key={key}
                    style={[styles.row, i < entries.length - 1 && styles.rowBorder]}
                  >
                    <Text style={styles.rowLabel}>{key}</Text>
                    <Text style={styles.rowValue}>{display}</Text>
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
  screen: { flex: 1, backgroundColor: colors.background },
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
  rowValue: { color: colors.primary, fontSize: 13, fontWeight: '800' },
});
