/**
 * Percentage — port of desktop PercentagePage.
 * ops.percentageGetAll {} (tolerant list unpack); header "Add" opens a text-input
 * modal (ops.percentageSave). Row tap opens a detail sheet with Edit (same modal,
 * type locked) + status toggle (ops.percentageChangeStatus). No file uploads.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  type?: string;
  percent?: number;
  startAmount?: number;
  endAmount?: number;
  bonus?: number;
  status?: boolean;
  [key: string]: unknown;
};

type PercentForm = {
  type: string;
  percent: string;
  startAmount: string;
  endAmount: string;
  bonus: string;
};

const EMPTY_FORM: PercentForm = {
  type: '',
  percent: '',
  startAmount: '',
  endAmount: '',
  bonus: '',
};

const MAIN_KEYS = new Set(['idx', 'name', 'percent', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatAmount(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** Tolerant unpack: array directly, or under .payload/.items/.data. */
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['payload', 'items', 'data']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as T[];
      if (v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).items)) {
        return (v as Record<string, unknown>).items as T[];
      }
    }
  }
  return [];
}

export function PercentageScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Add / Edit modal (shared form).
  const [formOpen, setFormOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState<PercentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.percentageGetAll', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load percentage list');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(asList<Row>(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = useCallback((key: keyof PercentForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setIsEdit(false);
    setFormMsg('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: Row) => {
    setForm({
      type: row.type || '',
      percent: row.percent !== undefined ? String(row.percent) : '',
      startAmount: row.startAmount !== undefined ? String(row.startAmount) : '',
      endAmount: row.endAmount !== undefined ? String(row.endAmount) : '',
      bonus: row.bonus !== undefined ? String(row.bonus) : '',
    });
    setIsEdit(true);
    setFormMsg('');
    setSheetRow(null);
    setFormOpen(true);
  }, []);

  const submitForm = useCallback(async () => {
    const percent = Number(form.percent);
    const startAmount = Number(form.startAmount);
    const endAmount = Number(form.endAmount);
    const bonus = Number(form.bonus);

    if (!form.type.trim()) {
      setFormMsg('Enter type name');
      return;
    }
    if (!form.percent || Number.isNaN(percent)) {
      setFormMsg('Enter percentage');
      return;
    }
    if (!form.startAmount || Number.isNaN(startAmount)) {
      setFormMsg('Enter start amount');
      return;
    }
    if (!form.endAmount || Number.isNaN(endAmount) || endAmount <= startAmount) {
      setFormMsg('Enter end amount greater than start amount');
      return;
    }
    if (!form.bonus || Number.isNaN(bonus)) {
      setFormMsg('Enter bonus');
      return;
    }

    setSaving(true);
    setFormMsg('');
    try {
      const res = await secureApi<unknown>('ops.percentageSave', {
        type: form.type.trim(),
        percent,
        startAmount,
        endAmount,
        bonus,
      });
      if (!res.ok) {
        setFormMsg(res.message || 'Failed to save percentage');
        return;
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const toggleStatus = useCallback(
    (row: Row) => {
      if (!row.type) return;
      const next = !row.status;
      void (async () => {
        const res = await secureApi<unknown>('ops.percentageChangeStatus', {
          type: row.type,
          status: next,
        });
        if (res.ok) {
          setSheetRow(null);
          setRows((prev) =>
            prev.map((item) => (item._id === row._id ? { ...item, status: next } : item)),
          );
        } else {
          setError(res.message || 'Failed to update status');
          setSheetRow(null);
        }
      })();
    },
    [],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'name', label: 'Name', width: 140, render: (r) => display(r.type) },
      {
        key: 'percent',
        label: 'Percentage',
        width: 100,
        align: 'center',
        render: (r) => (r.percent !== undefined ? String(r.percent) : '—'),
      },
      {
        key: 'startAmount',
        label: 'Start Amount',
        width: 130,
        render: (r) => formatAmount(r.startAmount ?? 0),
      },
      {
        key: 'endAmount',
        label: 'End Amount',
        width: 130,
        render: (r) => formatAmount(r.endAmount ?? 0),
      },
      {
        key: 'bonus',
        label: 'Bonus',
        width: 90,
        align: 'center',
        render: (r) => (r.bonus !== undefined ? String(r.bonus) : '—'),
      },
      {
        key: 'status',
        label: 'Status',
        width: 90,
        render: (r) => (r.status ? 'Active' : 'Inactive'),
        badge: (r) => (r.status ? '#16a34a' : '#dc2626'),
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Percentage</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Total: {rows.length.toLocaleString('en-IN')}</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || r.type || i)}
        loading={loading}
        emptyMessage="No percentage records found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.type) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(sheetRow, 0),
                  badgeColor: c.key === 'status' ? c.badge?.(sheetRow) : undefined,
                }))
            : []
        }
        actions={
          sheetRow
            ? ([
                {
                  label: 'Edit',
                  tone: 'primary',
                  onPress: () => openEdit(sheetRow),
                },
                {
                  label: sheetRow.status ? 'Deactivate' : 'Activate',
                  tone: sheetRow.status ? 'warning' : 'primary',
                  onPress: () => toggleStatus(sheetRow),
                },
              ] satisfies SheetAction[])
            : []
        }
        onClose={() => setSheetRow(null)}
      />

      {/* Add / Edit modal */}
      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFormOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setFormOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {isEdit ? 'Edit Percentage' : 'Add Percentage'}
              </Text>
              <TouchableOpacity
                onPress={() => setFormOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing(4) }}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.fieldLabel}>Type</Text>
              <TextInput
                style={[styles.modalInput, isEdit && styles.modalInputDisabled]}
                value={form.type}
                onChangeText={(v) => setField('type', v)}
                editable={!isEdit}
                placeholder="Type name"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Percent</Text>
              <TextInput
                style={styles.modalInput}
                value={form.percent}
                onChangeText={(v) => setField('percent', v)}
                keyboardType="numeric"
                placeholder="Percent"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Start Amount</Text>
              <TextInput
                style={styles.modalInput}
                value={form.startAmount}
                onChangeText={(v) => setField('startAmount', v)}
                keyboardType="numeric"
                placeholder="Start amount"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>End Amount</Text>
              <TextInput
                style={styles.modalInput}
                value={form.endAmount}
                onChangeText={(v) => setField('endAmount', v)}
                keyboardType="numeric"
                placeholder="End amount"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Bonus</Text>
              <TextInput
                style={styles.modalInput}
                value={form.bonus}
                onChangeText={(v) => setField('bonus', v)}
                keyboardType="numeric"
                placeholder="Bonus"
                placeholderTextColor={colors.muted}
              />
              {formMsg ? <Text style={styles.modalMsg}>{formMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={() => void submitForm()}
              >
                <Text style={styles.submitBtnText}>{saving ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
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
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(3), marginBottom: spacing(1) },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  modalInputDisabled: { opacity: 0.5 },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  submitBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
