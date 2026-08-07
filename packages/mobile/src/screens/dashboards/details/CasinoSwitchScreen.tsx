/**
 * Casino Switch — port of desktop CasinoSwitchPage.
 * casinoSwitch.list {}; add provider (casinoSwitch.create), toggle status
 * (casinoSwitch.changeStatus), delete (casinoSwitch.delete, casino_delete_button).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  casinoActiveProvider?: string;
  startAmount?: number | string;
  endAmount?: number | string;
  percent?: number | string;
  status?: boolean;
  [key: string]: unknown;
};

const MAIN_KEYS = new Set(['idx', 'provider', 'percent', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Tolerant list unpack matching desktop normalizeCasinoList. */
function unpackList(raw: unknown): Row[] {
  if (Array.isArray(raw)) return raw as Row[];
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as Row[];
    if (Array.isArray(obj.payload)) return obj.payload as Row[];
    if (obj.payload && typeof obj.payload === 'object') return [obj.payload as Row];
    if (obj._id) return [obj as Row];
  }
  return [];
}

export function CasinoSwitchScreen() {
  const canDelete = hasPermission('casino_delete_button');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const [providerDraft, setProviderDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('casinoSwitch.list', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load casino switch list');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(unpackList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addProvider = useCallback(async () => {
    const name = providerDraft.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res = await secureApi<unknown>('casinoSwitch.create', { casinoActiveProvider: name });
      if (res.ok) {
        setProviderDraft('');
        void load();
      } else {
        setError(res.message || 'Failed to add provider');
      }
    } finally {
      setSaving(false);
    }
  }, [providerDraft, load]);

  const toggleStatus = useCallback(
    (row: Row) => {
      const next = !row.status;
      void (async () => {
        const res = await secureApi<unknown>('casinoSwitch.changeStatus', {
          _id: row._id,
          status: next,
        });
        if (res.ok) {
          setSheetRow(null);
          void load();
        } else {
          setError(res.message || 'Failed to change status');
        }
      })();
    },
    [load],
  );

  const deleteRow = useCallback(
    (row: Row) => {
      Alert.alert('Delete provider', `Delete ${row.casinoActiveProvider || 'this provider'}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('casinoSwitch.delete', { _id: row._id });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to delete provider');
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      {
        key: 'provider',
        label: 'Casino Provider',
        width: 150,
        render: (r) => display(r.casinoActiveProvider),
      },
      {
        key: 'startAmount',
        label: 'Start Amount',
        width: 100,
        align: 'center',
        render: (r) => display(r.startAmount),
      },
      {
        key: 'endAmount',
        label: 'End Amount',
        width: 100,
        align: 'center',
        render: (r) => display(r.endAmount),
      },
      { key: 'percent', label: 'Percent', width: 80, align: 'center', render: (r) => display(r.percent) },
      { key: 'status', label: 'Status', width: 80, render: (r) => (r.status ? 'Active' : 'Inactive') },
    ],
    [],
  );

  const sheetActions: SheetAction[] = [];
  if (sheetRow) {
    sheetActions.push({
      label: sheetRow.status ? 'Deactivate' : 'Activate',
      tone: sheetRow.status ? 'warning' : 'primary',
      onPress: () => toggleStatus(sheetRow),
    });
    if (canDelete) {
      sheetActions.push({ label: 'Delete', tone: 'warning', onPress: () => deleteRow(sheetRow) });
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Casino Switch</Text>
      <Text style={styles.sub}>{rows.length} providers</Text>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={providerDraft}
          onChangeText={setProviderDraft}
          placeholder="New provider name…"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.addBtn, (saving || !providerDraft.trim()) && styles.btnDisabled]}
          disabled={saving || !providerDraft.trim()}
          onPress={() => void addProvider()}
        >
          <Text style={styles.addBtnText}>{saving ? 'Adding…' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No providers found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.casinoActiveProvider) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  addRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(3) },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginRight: spacing(2),
  },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  btnDisabled: { opacity: 0.5 },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
});
