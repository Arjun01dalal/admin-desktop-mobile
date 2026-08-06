/**
 * SOS Blocked Users — port of desktop SosBlockedUsersPage.
 * Calls auth.getAllSosBlocks ({}); read-only listing with pull-to-refresh.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  enabled?: boolean;
  type?: string;
  location?: string;
  targetCallerId?: string;
  blockedById?: string;
  blockedByName?: string;
  blockedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

const MAIN_KEYS = new Set(['idx', 'blockedByName', 'type', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatWhen(row: Row): string {
  const ts = row.blockedAt || row.createdAt || row.updatedAt;
  if (!ts) return '—';
  const d = formatDisplayDate(ts);
  const t = formatDisplayTime(ts);
  return d && t ? `${d} ${t}` : String(ts);
}

/** Desktop unpackSosBlocks: tolerate many payload shapes. */
function unpackSosBlocks(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (!data || typeof data !== 'object') return [];
  let obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    obj = obj.payload as Record<string, unknown>;
  } else if (Array.isArray(obj.payload)) {
    return obj.payload as Row[];
  }
  for (const key of ['blocks', 'items', 'list', 'docs', 'data', 'users']) {
    if (Array.isArray(obj[key])) return obj[key] as Row[];
  }
  if (obj.block && typeof obj.block === 'object') return [obj.block as Row];
  return [];
}

export function SosBlockedUsersScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('auth.getAllSosBlocks', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load SOS blocked users');
        setRows([]);
        return;
      }
      setRows(unpackSosBlocks(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'blockedByName', label: 'Blocked By', width: 130, render: (r) => display(r.blockedByName) },
      { key: 'blockedById', label: 'Blocked By ID', width: 150, render: (r) => display(r.blockedById) },
      { key: 'type', label: 'Type', width: 90, render: (r) => display(r.type) },
      { key: 'location', label: 'Location', width: 120, render: (r) => display(r.location) },
      { key: 'targetCallerId', label: 'Target Caller ID', width: 150, render: (r) => display(r.targetCallerId) },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => (r.enabled === true ? 'Active' : 'Inactive'),
        color: (r) => (r.enabled === true ? colors.destructive : colors.muted),
      },
      { key: 'blockedAt', label: 'Blocked At', width: 160, render: (r) => formatWhen(r) },
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
      <Text style={styles.title}>SOS Blocked Users</Text>
      <Text style={styles.sub}>Total: {rows.length} · Pull down to refresh</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || r.blockedById || r.targetCallerId || i)}
        loading={loading}
        emptyMessage="No SOS blocks found"
        onRowPress={(row) => setSelected(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? display(selected.blockedByName) : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(selected, 0) }))
            : []
        }
        onClose={() => setSelected(null)}
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
