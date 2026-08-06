/**
 * Checkers Report — port of desktop CheckersReportPage.
 * Calls reports.checkersData with { startDate, endDate }.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';

type CheckerMaps = {
  checkBy?: Record<string, number>;
  crossCheckBy?: Record<string, number>;
};

type Row = { name: string; checkBy: number; crossCheckBy: number };

export function CheckersReportScreen() {
  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<Required<CheckerMaps>>({ checkBy: {}, crossCheckBy: {} });
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('reports.checkersData', {
        startDate: startDate || null,
        endDate: endDate || null,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load checkers report');
        setMaps({ checkBy: {}, crossCheckBy: {} });
        return;
      }
      const raw = res.data;
      const data = (Array.isArray(raw) ? raw[0] : raw) as CheckerMaps | undefined;
      setMaps({
        checkBy: data?.checkBy || {},
        crossCheckBy: data?.crossCheckBy || {},
      });
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    const names = new Set([...Object.keys(maps.checkBy), ...Object.keys(maps.crossCheckBy)]);
    return [...names].map((name) => ({
      name,
      checkBy: maps.checkBy[name] ?? 0,
      crossCheckBy: maps.crossCheckBy[name] ?? 0,
    }));
  }, [maps]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'name', label: 'Name', width: 160, render: (r) => r.name },
      { key: 'checkBy', label: 'Check By', width: 100, align: 'right', render: (r) => String(r.checkBy) },
      {
        key: 'crossCheckBy',
        label: 'Cross Check By',
        width: 120,
        align: 'right',
        render: (r) => String(r.crossCheckBy),
      },
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
      <Text style={styles.title}>Checkers Report</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · {rows.length} checkers
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

      <DataTable
        columns={columns}
        rows={rows}
        keyFor={(r) => r.name}
        loading={loading}
        emptyMessage="No data available"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: 8,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
});
