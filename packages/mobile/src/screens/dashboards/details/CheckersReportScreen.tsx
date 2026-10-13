/**
 * Checkers Report — port of desktop CheckersReportPage.
 * Calls reports.checkersData with { startDate, endDate }.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './loginStatusReport.styles';

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
  const [selected, setSelected] = useState<Row | null>(null);
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
      { key: 'name', label: 'Name', width: 150, render: (r) => r.name },
      {
        key: 'checkBy',
        label: 'Check By',
        width: 90,
        align: 'center',
        render: (r) => String(r.checkBy),
      },
      {
        key: 'crossCheckBy',
        label: 'Cross Check By',
        width: 110,
        align: 'center',
        render: (r) => String(r.crossCheckBy),
      },
    ],
    [],
  );

  const keyExtractor = useCallback(
    (row: Row, index: number) => `row-${index}-${String(row.name ?? '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <CheckersReportCard row={row} index={index} onPress={() => setSelected(row)} />
    ),
    [],
  );

  const listHeader = (
    <>
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
        emptyMessage="No data available"
        refreshing={loading}
        onRefresh={() => void load()}
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? selected.name : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({ label: c.label, value: c.render(selected, 0) }))
            : []
        }
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

type CheckersReportCardProps = {
  row: Row;
  index: number;
  onPress: () => void;
};

const CheckersReportCard = memo(function CheckersReportCard({
  row,
  index,
  onPress,
}: CheckersReportCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {row.name}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft}>Check By: {row.checkBy}</Text>
        <Text style={styles.cardSplitRight}>Cross Check: {row.crossCheckBy}</Text>
      </View>
      <Text style={styles.cardHint}>Tap card for details</Text>
    </TouchableOpacity>
  );
});
