/**
 * AAA Fraud Bet Report — mobile port of desktop AAAFraudBetReportPage.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

const STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected'];

function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const PREFERRED_LIST_KEYS = [
  'reports',
  'report',
  'FraudBets',
  'fraudBets',
  'data',
  'list',
  'rows',
  'items',
  'users',
  'result',
  'payload',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findRecordArray(value: unknown, depth = 0): unknown[] | null {
  if (value == null || depth > 5) return null;
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((item) => isPlainObject(item))) {
      return value;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const key of PREFERRED_LIST_KEYS) {
      if (key in value) {
        const found = findRecordArray(value[key], depth + 1);
        if (found) return found;
      }
    }
    for (const key of Object.keys(value)) {
      if (PREFERRED_LIST_KEYS.includes(key)) continue;
      const found = findRecordArray(value[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractList(raw: unknown): Record<string, unknown>[] {
  const found = findRecordArray(raw);
  if (!found) return [];
  return found.filter(isPlainObject) as Record<string, unknown>[];
}

function formatColumnLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function cellText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).slice(0, 120);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function AAAFraudBetReportScreen() {
  const [startDate, setStartDate] = useState(() =>
    toDateTimeLocal(new Date(Date.now() - 9 * 24 * 60 * 60 * 1000)),
  );
  const [endDate, setEndDate] = useState(() => toDateTimeLocal(new Date()));
  const [status, setStatus] = useState('All');
  const [limit, setLimit] = useState('10');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<Record<string, unknown> | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('aaa.fraudBetsReport', {
        startDate,
        endDate,
        status: status || 'All',
        limit: String(limit || 10),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to fetch fraud bets report');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(extractList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, status, limit]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columnKeys = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row || {}).forEach((k) => keys.add(k)));
    return Array.from(keys).slice(0, 8);
  }, [rows]);

  const columns: DataTableColumn<Record<string, unknown>>[] = useMemo(
    () =>
      columnKeys.map((col) => ({
        key: col,
        label: formatColumnLabel(col),
        width: 140,
        render: (row) => cellText(row?.[col]),
      })),
    [columnKeys],
  );

  const sheetFields: SheetField[] = sheetRow
    ? Object.keys(sheetRow).map((k) => ({
        label: formatColumnLabel(k),
        value: cellText(sheetRow[k]),
      }))
    : [];

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.filters}
        contentContainerStyle={styles.filtersContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>AAA Fraud Bet Report</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="Start (YYYY-MM-DDTHH:mm)"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="End (YYYY-MM-DDTHH:mm)"
          placeholderTextColor={colors.muted}
        />
        <ScrollView horizontal style={styles.chipRow}>
          {STATUS_OPTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, status === s && styles.chipActive]}
              onPress={() => setStatus(s)}
            >
              <Text
                style={[styles.chipText, status === s && styles.chipTextActive]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          value={limit}
          onChangeText={setLimit}
          keyboardType="numeric"
          placeholder="Limit"
          placeholderTextColor={colors.muted}
        />
        <TouchableOpacity style={styles.btn} onPress={() => void load()}>
          <Text style={styles.btnText}>Apply</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <ScrollView
        horizontal
        style={styles.tableScroll}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
      >
        <DataTable
          columns={columns}
          rows={rows}
          keyFor={(row, index) => String(row._id || row.id || row.userId || index)}
          loading={loading}
          onRowPress={(row) => setSheetRow(row)}
          emptyMessage="No fraud bets found."
        />
      </ScrollView>

      <RowDetailSheet
        visible={Boolean(sheetRow)}
        title="Fraud Bet"
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  filters: { maxHeight: 280 },
  filtersContent: { padding: spacing(4), gap: spacing(2) },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2),
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  chipRow: { maxHeight: 40 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  btnText: { color: colors.primaryForeground, fontWeight: '700' },
  error: { color: colors.destructive },
  tableScroll: { flex: 1 },
});
