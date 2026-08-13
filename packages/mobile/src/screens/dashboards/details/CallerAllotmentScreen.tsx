/**
 * Caller Allotment — port of desktop CallerAllotmentPage (caller-head assign/remove).
 * Loads callers + heads via ops.callerAllotmentSubadmins; row sheet lets you pick
 * caller heads then Update / Remove (ops.updateCallerHead / ops.removeCallerHead).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { CALLER_HEAD_ROLE_IDS, CALLER_ROLE_IDS } from '../../../auth/callerRoles';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type SubAdmin = {
  _id: string;
  name?: string;
  realName?: string;
  empCode?: string;
  Role_ID?: string;
  block?: boolean;
  callerHead?: string | string[];
};

type RoleGroup = {
  roleId: string;
  block?: boolean;
  subAdmins?: SubAdmin[];
};

type CallerHeadOption = { id: string; name: string };

type CallerRow = SubAdmin & {
  location?: string;
};

const MAIN_KEYS = new Set(['idx', 'name', 'empCode', 'callerHead']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';
  return String(value);
}

function displayCallerHead(value: unknown): string {
  if (!value || value === 'not assigned') return '—';
  return display(value);
}

export function CallerAllotmentScreen() {
  const [rows, setRows] = useState<CallerRow[]>([]);
  const [headOptions, setHeadOptions] = useState<CallerHeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: CallerRow; index: number } | null>(null);
  const [pickedHeadIds, setPickedHeadIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await secureApi<{ byRole?: RoleGroup[] }>('ops.callerAllotmentSubadmins', {
        filter: {},
      });
      if (!res.ok) {
        setError(res.message || 'Failed to load caller allotment');
        setRows([]);
        setHeadOptions([]);
        return;
      }
      const byRole = res.data?.byRole ?? [];
      const heads = byRole
        .filter((g) => CALLER_HEAD_ROLE_IDS.has(g.roleId))
        .flatMap((g) => g.subAdmins ?? [])
        .filter((h) => !h.block)
        .map((h) => ({ id: h._id, name: h.name || h._id }));
      const callers = byRole
        .filter((g) => CALLER_ROLE_IDS.has(g.roleId))
        .flatMap((g) =>
          (g.subAdmins ?? []).map((s) => ({ ...s, block: s.block ?? g.block })),
        )
        .sort((a, b) => Number(a.block) - Number(b.block));
      setHeadOptions(heads);
      setRows(callers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openRow = useCallback((row: CallerRow, index: number) => {
    setSelected({ row, index });
    setPickedHeadIds([]);
  }, []);

  const toggleHead = useCallback((id: string) => {
    setPickedHeadIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const selectedHeads = useMemo(
    () => headOptions.filter((h) => pickedHeadIds.includes(h.id)),
    [headOptions, pickedHeadIds],
  );

  const updateCallerHead = useCallback(async () => {
    if (!selected) return;
    if (!selectedHeads.length) {
      Alert.alert('Caller Allotment', 'Select at least one caller head');
      return;
    }
    setBusy(true);
    try {
      const res = await secureApi('ops.updateCallerHead', {
        _id: selected.row._id,
        callerHead: selectedHeads.map((h) => h.name),
      });
      Alert.alert(
        res.ok ? 'Updated' : 'Failed',
        res.message || (res.ok ? 'Caller head updated' : 'Failed to update caller head'),
      );
      if (res.ok) {
        setSelected(null);
        void load();
      }
    } finally {
      setBusy(false);
    }
  }, [selected, selectedHeads, load]);

  /** Same as Laxmi/admin-panel: one remove-caller-head call per selected head name. */
  const removeCallerHead = useCallback(async () => {
    if (!selected) return;
    if (!selectedHeads.length) {
      Alert.alert('Caller Allotment', 'Please select caller head to remove');
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.all(
        selectedHeads.map((item) =>
          secureApi('ops.removeCallerHead', {
            _id: selected.row._id,
            callerHead: item.name,
          }),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        Alert.alert('Failed', failed.message || 'Failed to remove caller head');
        return;
      }
      Alert.alert('Removed', 'Caller head removed successfully');
      setSelected(null);
      void load();
    } finally {
      setBusy(false);
    }
  }, [selected, selectedHeads, load]);

  const columns = useMemo<DataTableColumn<CallerRow>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String(i + 1),
      },
      {
        key: 'name',
        label: 'Pseudo Name',
        width: 140,
        render: (r) => display(r.name),
      },
      {
        key: 'realName',
        label: 'Real Name',
        width: 130,
        render: (r) => display(r.realName),
      },
      {
        key: 'empCode',
        label: 'Emp Code',
        width: 100,
        render: (r) => display(r.empCode),
      },
      {
        key: 'callerHead',
        label: 'Caller Head',
        width: 160,
        render: (r) => displayCallerHead(r.callerHead),
      },
      {
        key: 'block',
        label: 'Status',
        width: 90,
        render: (r) => (r.block ? 'Blocked' : 'Active'),
      },
    ],
    [],
  );

  const mainColumns = useMemo(
    () => columns.filter((c) => MAIN_KEYS.has(c.key)),
    [columns],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!selected) return [];
    return columns
      .filter((c) => c.key !== 'idx')
      .map((c) => ({
        label: c.label,
        value: c.render(selected.row, selected.index),
      }));
  }, [columns, selected]);

  const sheetActions = useMemo<SheetAction[] | undefined>(() => {
    if (!selected || selected.row.block) return undefined;
    return [
      {
        label: busy ? 'Working…' : 'Update Caller Head',
        tone: 'primary',
        disabled: busy || selectedHeads.length === 0,
        onPress: () => void updateCallerHead(),
      },
      {
        label: busy ? 'Working…' : 'Remove Caller Head',
        tone: 'danger',
        disabled: busy || selectedHeads.length === 0,
        onPress: () => void removeCallerHead(),
      },
    ];
  }, [selected, busy, selectedHeads.length, updateCallerHead, removeCallerHead]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Caller Allotment</Text>
      <Text style={styles.hint}>Tap a caller → select head(s) → Update or Remove</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <DataTable
        columns={mainColumns}
        rows={loading ? [] : rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        onRowPress={(row, index) => openRow(row, index)}
        emptyMessage={loading ? 'Loading…' : 'No callers'}
      />

      <RowDetailSheet
        visible={!!selected}
        title={selected ? String(selected.row.name || selected.row.empCode || 'Caller') : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSelected(null)}
        footer={
          selected && !selected.row.block ? (
            <View style={styles.headPick}>
              <Text style={styles.headPickLabel}>Select Caller Head(s)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {headOptions.map((h) => {
                    const on = pickedHeadIds.includes(h.id);
                    return (
                      <TouchableOpacity
                        key={h.id}
                        style={[styles.chip, on && styles.chipActive]}
                        onPress={() => toggleHead(h.id)}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextActive]}>{h.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : null
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(2), paddingBottom: spacing(6), gap: spacing(1.5) },
  title: { color: colors.foreground, fontSize: 22, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing(0.5) },
  error: { color: '#ef5350', fontSize: 13 },
  headPick: { gap: spacing(1), marginTop: spacing(1) },
  headPickLabel: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
});
