/**
 * UTR Providers — port of desktop UtrProviderPage.
 * ops.utrGetAll { startDate, endDate } (default todayIST both). Row tap opens a
 * detail sheet with Enable/Disable + Delete; header "Add UTR account" modal creates.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  BankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  ifsc?: string;
  status?: boolean;
  pendingTotal?: number;
  approvedTotal?: number;
  [key: string]: unknown;
};

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

const EMPTY_FORM = { bankName: '', accountNumber: '', accountHolderName: '', ifsc: '' };

export function UtrProviderScreen() {
  const [draftStart, setDraftStart] = useState(todayIST);
  const [draftEnd, setDraftEnd] = useState(todayIST);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Add modal.
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.utrGetAll', {
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load UTR providers');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(asList<Row>(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleStatus = useCallback(
    (row: Row) => {
      const next = !row.status;
      Alert.alert(
        next ? 'Enable UTR account' : 'Disable UTR account',
        `${next ? 'Enable' : 'Disable'} ${display(row.accountHolderName)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: next ? 'Enable' : 'Disable',
            style: next ? 'default' : 'destructive',
            onPress: () => {
              void (async () => {
                const res = await secureApi<unknown>('ops.utrUpdate', {
                  _id: row._id,
                  status: next,
                });
                if (res.ok) {
                  setSheetRow(null);
                  void load();
                } else {
                  setError(res.message || 'Failed to update status');
                  setSheetRow(null);
                }
              })();
            },
          },
        ],
      );
    },
    [load],
  );

  const deleteRow = useCallback(
    (row: Row) => {
      Alert.alert('Delete UTR account', 'This UTR provider will be permanently removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('ops.utrDelete', { _id: row._id });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to delete UTR provider');
                setSheetRow(null);
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  const submitCreate = useCallback(async () => {
    const bankName = form.bankName.trim();
    const accountNumber = form.accountNumber.trim();
    const accountHolderName = form.accountHolderName.trim();
    const ifsc = form.ifsc.trim().toUpperCase();
    if (!bankName || !accountNumber || !accountHolderName || !ifsc) {
      setAddMsg('Please fill all bank details');
      return;
    }
    setSaving(true);
    setAddMsg('');
    try {
      const res = await secureApi<unknown>('ops.utrCreate', {
        bankName,
        accountNumber,
        accountHolderName,
        ifsc,
        status: false,
      });
      if (!res.ok) {
        setAddMsg(res.message || 'Failed to add UTR account');
        return;
      }
      setAddOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSaving(false);
    }
  }, [form, load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      {
        key: 'total',
        label: 'Total Amount',
        width: 200,
        render: (r) =>
          `Approved - ${formatAmount(r.approvedTotal)} / Pending - ${formatAmount(r.pendingTotal)}`,
      },
      {
        key: 'accountHolderName',
        label: 'Account Holder',
        width: 150,
        render: (r) => display(r.accountHolderName),
      },
      { key: 'BankName', label: 'Bank Name', width: 140, render: (r) => display(r.BankName) },
      {
        key: 'accountNumber',
        label: 'Account Number',
        width: 150,
        render: (r) => display(r.accountNumber),
      },
      { key: 'ifsc', label: 'IFSC', width: 120, render: (r) => display(r.ifsc) },
      {
        key: 'status',
        label: 'Status',
        width: 90,
        render: (r) => (r.status ? 'Enabled' : 'Disabled'),
      },
      {
        key: 'pendingTotal',
        label: 'Pending Total',
        width: 130,
        render: (r) => formatAmount(r.pendingTotal),
      },
      {
        key: 'approvedTotal',
        label: 'Approved Total',
        width: 130,
        render: (r) => formatAmount(r.approvedTotal),
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
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>UTR Providers</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setForm(EMPTY_FORM);
            setAddMsg('');
            setAddOpen(true);
          }}
        >
          <Text style={styles.addBtnText}>Add UTR account</Text>
        </TouchableOpacity>
      </View>

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

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No UTR providers found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const enabled = Boolean(row.status);
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.accountHolderName)}
                </Text>
                <Text style={[styles.statusPill, enabled ? styles.statusOn : styles.statusOff]}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Bank: {display(row.BankName)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  A/c: {display(row.accountNumber)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Approved: {formatAmount(row.approvedTotal)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  Pending: {formatAmount(row.pendingTotal)}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details & actions</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.accountHolderName) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(sheetRow, 0) }))
            : []
        }
        actions={
          sheetRow
            ? ([
                {
                  label: sheetRow.status ? 'Disable' : 'Enable',
                  tone: sheetRow.status ? 'warning' : 'primary',
                  onPress: () => toggleStatus(sheetRow),
                },
                {
                  label: 'Delete',
                  tone: 'warning',
                  onPress: () => deleteRow(sheetRow),
                },
              ] satisfies SheetAction[])
            : []
        }
        onClose={() => setSheetRow(null)}
      />

      {/* Add UTR account modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setAddOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add UTR account</Text>
              <TouchableOpacity
                onPress={() => setAddOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.modalInput}
                value={form.bankName}
                onChangeText={(v) => setForm((p) => ({ ...p, bankName: v }))}
                placeholder="Bank Name"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={styles.modalInput}
                value={form.accountNumber}
                onChangeText={(v) => setForm((p) => ({ ...p, accountNumber: v }))}
                placeholder="Bank Account Number"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.modalInput}
                value={form.accountHolderName}
                onChangeText={(v) => setForm((p) => ({ ...p, accountHolderName: v }))}
                placeholder="Account Holder Name"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={styles.modalInput}
                value={form.ifsc}
                onChangeText={(v) => setForm((p) => ({ ...p, ifsc: v.toUpperCase() }))}
                placeholder="IFSC"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {addMsg ? <Text style={styles.modalMsg}>{addMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={() => void submitCreate()}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = makeStyles({
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', flex: 1 },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(12),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md * 2,
    padding: spacing(4),
    gap: spacing(2),
    maxHeight: '100%',
  },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { gap: spacing(2), paddingBottom: spacing(1) },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  modalMsg: { color: colors.destructive, fontSize: 12 },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(1),
  },
  saveBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
