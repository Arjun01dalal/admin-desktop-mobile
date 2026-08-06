/**
 * Instant Deposit Providers — port of desktop InstantDepositProvidersPage.
 * instantDeposit.list { pageNo:1, itemsPerPage:100, filter:{ name?, mid? } }. Row tap
 * opens a detail sheet with Enable/Disable, Edit name/MID/link, Delete; header adds a provider.
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
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  name?: string;
  mid?: string | number;
  link?: string;
  status?: boolean;
  type?: string;
  openInBrowser?: boolean;
  updatedBy?: { userName?: string; userId?: string };
  updatedOn?: string;
  [key: string]: unknown;
};

type UpdateKind = 'name' | 'mid' | 'link';

const MAIN_KEYS = new Set(['idx', 'name', 'mid', 'status']);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Tolerant paged unpack: items under .items or .payload.items (or a bare array). */
function asPagedItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    const payload = obj.payload;
    if (payload && typeof payload === 'object' && Array.isArray((payload as Record<string, unknown>).items)) {
      return (payload as Record<string, unknown>).items as T[];
    }
    if (Array.isArray(obj.payload)) return obj.payload as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

const EMPTY_FORM = { name: '', link: '', mid: '', type: '', openInBrowser: true };

export function InstantDepositProvidersScreen() {
  const user = useMemo(() => getStoredUser<{ _id?: string; name?: string }>(), []);

  const [nameDraft, setNameDraft] = useState('');
  const [midDraft, setMidDraft] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [appliedMid, setAppliedMid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Add modal.
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  // Edit field modal.
  const [editKind, setEditKind] = useState<UpdateKind | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const filter: Record<string, unknown> = {};
      if (appliedName.trim()) filter.name = appliedName.trim();
      if (appliedMid.trim()) filter.mid = appliedMid.trim();
      const res = await secureApi<unknown>('instantDeposit.list', {
        pageNo: 1,
        itemsPerPage: 100,
        filter,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load instant deposit providers');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(asPagedItems<Row>(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [appliedName, appliedMid]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    setAppliedName(nameDraft);
    setAppliedMid(midDraft);
  }, [nameDraft, midDraft]);

  const toggleStatus = useCallback(
    (row: Row) => {
      const next = !row.status;
      Alert.alert(
        next ? 'Enable provider' : 'Disable provider',
        `${next ? 'Enable' : 'Disable'} ${display(row.name)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: next ? 'Enable' : 'Disable',
            style: next ? 'default' : 'destructive',
            onPress: () => {
              void (async () => {
                const res = await secureApi<unknown>('instantDeposit.updateStatus', {
                  _id: row._id,
                  status: next,
                  updatedBy: { userId: user?._id, userName: user?.name },
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
    [load, user],
  );

  const deleteRow = useCallback(
    (row: Row) => {
      Alert.alert('Delete provider', `Delete ${display(row.name)}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('instantDeposit.delete', { _id: row._id });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to delete');
                setSheetRow(null);
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  const openEdit = useCallback((row: Row, kind: UpdateKind) => {
    setEditRow(row);
    setEditKind(kind);
    setEditText(
      kind === 'name' ? String(row.name ?? '') : kind === 'mid' ? String(row.mid ?? '') : String(row.link ?? ''),
    );
    setEditMsg('');
    setSheetRow(null);
  }, []);

  const submitEdit = useCallback(async () => {
    const text = editText.trim();
    if (!text || !editRow?._id || !editKind) {
      setEditMsg('Please enter a value');
      return;
    }
    setSavingEdit(true);
    setEditMsg('');
    try {
      let res;
      if (editKind === 'name') {
        res = await secureApi<unknown>('instantDeposit.updateName', {
          _id: editRow._id,
          name: text,
          User: { data: { _id: user?._id, name: user?.name } },
        });
      } else if (editKind === 'mid') {
        res = await secureApi<unknown>('instantDeposit.updateInstant', {
          _id: editRow._id,
          mid: text,
        });
      } else {
        res = await secureApi<unknown>('instantDeposit.updateInstant', {
          _id: editRow._id,
          link: text,
        });
      }
      if (!res.ok) {
        setEditMsg(res.message || 'Failed to update');
        return;
      }
      setEditRow(null);
      setEditKind(null);
      setEditText('');
      void load();
    } finally {
      setSavingEdit(false);
    }
  }, [editText, editRow, editKind, user, load]);

  const submitCreate = useCallback(async () => {
    const name = form.name.trim();
    const link = form.link.trim();
    const mid = form.mid.trim();
    const type = form.type.trim();
    if (!name || !link || !mid || !type) {
      setAddMsg('Please fill gateway name, mid, link and type');
      return;
    }
    setSavingAdd(true);
    setAddMsg('');
    try {
      const res = await secureApi<unknown>('instantDeposit.create', {
        name,
        link,
        mid,
        openInBrowser: form.openInBrowser,
        type: type.toLowerCase(),
        updatedBy: { userId: user?._id, userName: user?.name },
      });
      if (!res.ok) {
        setAddMsg(res.message || 'Failed to add provider');
        return;
      }
      setAddOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSavingAdd(false);
    }
  }, [form, user, load]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'name', label: 'Gateway Name', width: 150, render: (r) => display(r.name) },
      { key: 'mid', label: 'Mid', width: 120, render: (r) => display(r.mid) },
      { key: 'link', label: 'Link', width: 220, render: (r) => display(r.link) },
      { key: 'status', label: 'Status', width: 90, render: (r) => (r.status ? 'Enabled' : 'Disabled') },
      {
        key: 'updatedBy.userName',
        label: 'Enable / Disable By',
        width: 150,
        render: (r) => display(r.updatedBy?.userName),
      },
      {
        key: 'updatedOn',
        label: 'Updated On',
        width: 150,
        render: (r) =>
          r.updatedOn ? `${formatDisplayDate(r.updatedOn)} ${formatDisplayTime(r.updatedOn)}` : '—',
      },
    ],
    [],
  );

  const editLabel = editKind === 'name' ? 'name' : editKind === 'mid' ? 'MID' : 'link';

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
        <Text style={styles.title}>Instant Deposit Providers</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setForm(EMPTY_FORM);
            setAddMsg('');
            setAddOpen(true);
          }}
        >
          <Text style={styles.addBtnText}>Add provider</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={nameDraft}
          onChangeText={setNameDraft}
          onSubmitEditing={search}
          returnKeyType="search"
          placeholder="Name…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.searchInput}
          value={midDraft}
          onChangeText={setMidDraft}
          onSubmitEditing={search}
          returnKeyType="search"
          placeholder="Mid…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.btnDisabled]}
          disabled={loading}
          onPress={search}
        >
          <Text style={styles.searchBtnText}>Search</Text>
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
        emptyMessage="No instant deposit providers"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(sheetRow, 0),
                  multiline: c.key === 'link',
                }))
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
                { label: 'Edit name', tone: 'primary', onPress: () => openEdit(sheetRow, 'name') },
                { label: 'Edit MID', tone: 'primary', onPress: () => openEdit(sheetRow, 'mid') },
                { label: 'Edit link', tone: 'primary', onPress: () => openEdit(sheetRow, 'link') },
                { label: 'Delete', tone: 'warning', onPress: () => deleteRow(sheetRow) },
              ] satisfies SheetAction[])
            : []
        }
        onClose={() => setSheetRow(null)}
      />

      {/* Edit field modal */}
      <Modal
        visible={editRow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditRow(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setEditRow(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Edit {editLabel}
              </Text>
              <TouchableOpacity
                onPress={() => setEditRow(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              placeholder={`Enter ${editLabel}…`}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {editMsg ? <Text style={styles.modalMsg}>{editMsg}</Text> : null}
            <TouchableOpacity
              style={[styles.saveBtn, (savingEdit || !editText.trim()) && styles.btnDisabled]}
              disabled={savingEdit || !editText.trim()}
              onPress={() => void submitEdit()}
            >
              <Text style={styles.saveBtnText}>{savingEdit ? 'Saving…' : 'Update'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add provider modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setAddOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add provider</Text>
              <TouchableOpacity
                onPress={() => setAddOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="Gateway Name"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.modalInput}
              value={form.link}
              onChangeText={(v) => setForm((p) => ({ ...p, link: v }))}
              placeholder="Link"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.modalInput}
              value={form.mid}
              onChangeText={(v) => setForm((p) => ({ ...p, mid: v }))}
              placeholder="Mid"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.modalInput}
              value={form.type}
              onChangeText={(v) => setForm((p) => ({ ...p, type: v }))}
              placeholder="Type"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.chipsRow}>
              <Text style={styles.chipsLabel}>Open In Browser:</Text>
              {[
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ].map((o) => (
                <TouchableOpacity
                  key={o.label}
                  style={[styles.chip, form.openInBrowser === o.value && styles.chipActive]}
                  onPress={() => setForm((p) => ({ ...p, openInBrowser: o.value }))}
                >
                  <Text
                    style={[styles.chipText, form.openInBrowser === o.value && styles.chipTextActive]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {addMsg ? <Text style={styles.modalMsg}>{addMsg}</Text> : null}
            <TouchableOpacity
              style={[styles.saveBtn, savingAdd && styles.btnDisabled]}
              disabled={savingAdd}
              onPress={() => void submitCreate()}
            >
              <Text style={styles.saveBtnText}>{savingAdd ? 'Saving…' : 'Submit'}</Text>
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginTop: spacing(3) },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
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
  modalMsg: { color: colors.destructive, fontSize: 12 },
  chipsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing(2) },
  chipsLabel: { color: colors.muted, fontSize: 12 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
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
