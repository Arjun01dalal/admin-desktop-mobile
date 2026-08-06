/**
 * Deposit Config — port of desktop DepositConfigPage.
 * depositConfig.getAll {}. Row tap opens a detail sheet with a permission-gated Edit
 * action; header "Add config" (gated) opens the same form empty. Deposit_Config permission.
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
import { hasPermission } from '../../../auth/permissions';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  clientName?: string;
  minDeposit?: number | string;
  maxDeposit?: number | string;
  allowedAmounts?: number[];
  [key: string]: unknown;
};

type FormState = {
  clientName: string;
  minDeposit: string;
  maxDeposit: string;
  allowedAmounts: string;
};

const MAIN_KEYS = new Set(['idx', 'clientName', 'minDeposit', 'maxDeposit']);

const EMPTY_FORM: FormState = { clientName: '', minDeposit: '', maxDeposit: '', allowedAmounts: '' };

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
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

function parseAllowedAmounts(raw: string): number[] {
  return raw
    .replace(/[^0-9,]/g, '')
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

export function DepositConfigScreen() {
  const canEdit = hasPermission('Deposit_Config');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Form modal.
  const [formOpen, setFormOpen] = useState(false);
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('depositConfig.getAll', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load deposit config');
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

  const openAdd = useCallback(() => {
    setMode('add');
    setForm(EMPTY_FORM);
    setFormMsg('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: Row) => {
    setMode('edit');
    setForm({
      clientName: String(row.clientName || ''),
      minDeposit: String(row.minDeposit ?? ''),
      maxDeposit: String(row.maxDeposit ?? ''),
      allowedAmounts: Array.isArray(row.allowedAmounts) ? row.allowedAmounts.join(', ') : '',
    });
    setFormMsg('');
    setSheetRow(null);
    setFormOpen(true);
  }, []);

  const submit = useCallback(async () => {
    if (
      !form.clientName.trim() ||
      !form.minDeposit.trim() ||
      !form.maxDeposit.trim() ||
      !form.allowedAmounts.trim()
    ) {
      setFormMsg('Please fill all fields');
      return;
    }
    const allowedAmounts = parseAllowedAmounts(form.allowedAmounts);
    if (!allowedAmounts.length) {
      setFormMsg('Enter valid allowed amounts');
      return;
    }
    setSaving(true);
    setFormMsg('');
    try {
      const payload = {
        clientName: form.clientName.trim(),
        minDeposit: form.minDeposit.trim(),
        maxDeposit: form.maxDeposit.trim(),
        allowedAmounts,
      };
      const res = await secureApi<unknown>(
        mode === 'add' ? 'depositConfig.add' : 'depositConfig.update',
        payload,
      );
      if (!res.ok) {
        setFormMsg(res.message || `Failed to ${mode} deposit config`);
        return;
      }
      setFormOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSaving(false);
    }
  }, [form, mode, load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'clientName', label: 'App Name', width: 150, render: (r) => display(r.clientName) },
      { key: 'minDeposit', label: 'Min Deposit', width: 120, render: (r) => display(r.minDeposit) },
      { key: 'maxDeposit', label: 'Max Deposit', width: 120, render: (r) => display(r.maxDeposit) },
      {
        key: 'allowedAmounts',
        label: 'Allowed Amount',
        width: 200,
        render: (r) => (Array.isArray(r.allowedAmounts) ? r.allowedAmounts.join(', ') : '—'),
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
        <Text style={styles.title}>Deposit Config</Text>
        {canEdit ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>Add config</Text>
          </TouchableOpacity>
        ) : null}
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
        emptyMessage="No deposit config"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.clientName) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        actions={
          sheetRow && canEdit
            ? ([{ label: 'Edit', tone: 'primary', onPress: () => openEdit(sheetRow) }] satisfies SheetAction[])
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
              <Text style={styles.modalTitle}>
                {mode === 'add' ? 'Add Deposit Config' : 'Edit Deposit Config'}
              </Text>
              <TouchableOpacity
                onPress={() => setFormOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, mode === 'edit' && styles.modalInputDisabled]}
              value={form.clientName}
              onChangeText={(v) => setForm((p) => ({ ...p, clientName: v }))}
              placeholder="Client Name"
              placeholderTextColor={colors.muted}
              editable={mode === 'add'}
            />
            <TextInput
              style={styles.modalInput}
              value={form.minDeposit}
              onChangeText={(v) => setForm((p) => ({ ...p, minDeposit: v }))}
              placeholder="Min Deposit"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.modalInput}
              value={form.maxDeposit}
              onChangeText={(v) => setForm((p) => ({ ...p, maxDeposit: v }))}
              placeholder="Max Deposit"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <TextInput
              style={styles.modalInput}
              value={form.allowedAmounts}
              onChangeText={(v) =>
                setForm((p) => ({ ...p, allowedAmounts: v.replace(/[^0-9,]/g, '') }))
              }
              placeholder="Allowed Amounts (comma separated)"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            {formMsg ? <Text style={styles.modalMsg}>{formMsg}</Text> : null}
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              disabled={saving}
              onPress={() => void submit()}
            >
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving…' : mode === 'add' ? 'Submit' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', flex: 1 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
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
    gap: spacing(2),
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', flex: 1, marginRight: spacing(2) },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  modalInputDisabled: { opacity: 0.6 },
  modalMsg: { color: colors.destructive, fontSize: 12 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(1),
  },
  btnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
