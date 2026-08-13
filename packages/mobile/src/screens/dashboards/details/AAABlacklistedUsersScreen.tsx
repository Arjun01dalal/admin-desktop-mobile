/**
 * AAA Black Listed Users — mobile port of desktop AAABlacklistedUsersPage.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

const PREFERRED_LIST_KEYS = [
  'reports',
  'report',
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

export function AAABlacklistedUsersScreen() {
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
      const res = await secureApi<unknown>('aaa.blacklistedUsers', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to fetch blacklisted users');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(extractList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      <View style={styles.toolbar}>
        <Text style={styles.title}>AAA Black Listed Users</Text>
        <TouchableOpacity style={styles.btn} onPress={() => void load()}>
          <Text style={styles.btnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
          emptyMessage="No blacklisted users found."
        />
      </ScrollView>
      <RowDetailSheet
        visible={Boolean(sheetRow)}
        title="Blacklisted User"
        fields={sheetFields}
        onClose={() => setSheetRow(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing(4),
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.foreground, flex: 1 },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  btnText: { color: colors.primaryForeground, fontWeight: '700' },
  error: { color: colors.destructive, paddingHorizontal: spacing(4) },
  tableScroll: { flex: 1 },
});
