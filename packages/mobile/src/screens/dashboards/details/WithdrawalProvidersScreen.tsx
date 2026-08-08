/**
 * Withdrawal Providers — mobile port of desktop WithdrawalProvidersPage.
 * withdrawalProviders.list { startDate, endDate }. Row tap opens a popup with
 * every field, the gateway image and all actions: toggle status, edit full
 * provider (updateAll), single-field update (displayName / gatewayImage / mid /
 * link via updateMidNameLink), and delete. Header has Add provider (create).
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
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  name?: string;
  displayName?: string;
  gatewayImage?: string;
  mid?: string;
  link?: string;
  redirectionLink?: string;
  status?: boolean;
  token?: string;
  cookies?: string;
  [key: string]: unknown;
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

/** Tolerant unpack: array directly, or under .payload/.items/.data (nested .items). */
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of ['payload', 'items', 'data']) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
    if (v && typeof v === 'object') {
      const inner = (v as Record<string, unknown>).items;
      if (Array.isArray(inner)) return inner as T[];
    }
  }
  return [];
}

// Single-field update targets via withdrawalProviders.updateMidNameLink.
const UPDATE_FIELDS = [
  { key: 'displayName', label: 'Display name', prop: 'displayName' },
  { key: 'gatewayImg', label: 'Gateway image URL', prop: 'gatewayImage' },
  { key: 'mid', label: 'MID', prop: 'mid' },
  { key: 'link', label: 'Link', prop: 'link' },
] as const;

type UpdateKey = (typeof UPDATE_FIELDS)[number]['key'];

type FormState = {
  name: string;
  link: string;
  mid: string;
  token: string;
  cookies: string;
};

const EMPTY_FORM: FormState = { name: '', link: '', mid: '', token: '', cookies: '' };

const FORM_FIELDS: [keyof FormState, string, boolean][] = [
  ['name', 'Parent Company / Name', false],
  ['link', 'Link / UPI', false],
  ['mid', 'Mid', false],
  ['token', 'Token', true],
  ['cookies', 'Cookies', true],
];

export function WithdrawalProvidersScreen() {
  const canAdd = hasPermission('Add_PayOut_Account');
  const canToggle = hasPermission('Toggle_PayOut_Account');
  const canDelete = hasPermission('Delete_PayOut_Account');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const updatedBy = useMemo(
    () => ({ userId: admin?._id, userName: admin?.name }),
    [admin],
  );

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  // Edit-full-provider modal (updateAll) — also reused for Add (create).
  const [formRow, setFormRow] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Single-field update modal (updateMidNameLink).
  const [updateRow, setUpdateRow] = useState<Row | null>(null);
  const [updateKey, setUpdateKey] = useState<UpdateKey>('link');
  const [updateText, setUpdateText] = useState('');

  const [busy, setBusy] = useState(false);
  const [modalMsg, setModalMsg] = useState('');

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      const res = await secureApi<unknown>('withdrawalProviders.list', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load withdrawal providers');
        setRows([]);
        return;
      }
      const list = asList<Row>(res.data);
      list.sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status ? -1 : 1;
      });
      setSheetRow(null);
      setRows(list);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<string | null> => {
      const res = await secureApi<unknown>(action, payload);
      if (!res.ok) return res.message || 'Request failed';
      void load();
      return null;
    },
    [load],
  );

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.displayName, r.mid, r.link, r.redirectionLink]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [rows, searchText]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'name', label: 'Gateway Name', width: 130, render: (r) => display(r.name) },
      { key: 'displayName', label: 'Display Name', width: 130, render: (r) => display(r.displayName) },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => (r.status ? 'Active' : 'Inactive'),
        badge: (r) => (r.status ? '#16a34a' : '#dc2626'),
      },
      { key: 'mid', label: 'Mid', width: 140, render: (r) => display(r.mid) },
      { key: 'link', label: 'Link', width: 180, render: (r) => display(r.link) },
      {
        key: 'redirectionLink',
        label: 'Redirection Link',
        width: 180,
        render: (r) => display(r.redirectionLink),
      },
      { key: 'token', label: 'Token', width: 180, render: (r) => display(r.token) },
      { key: 'cookies', label: 'Cookies', width: 180, render: (r) => display(r.cookies) },
    ],
    [],
  );

  const openFullEdit = useCallback((row: Row) => {
    setForm({
      name: String(row.name ?? ''),
      link: String(row.link ?? ''),
      mid: String(row.mid ?? ''),
      token: String(row.token ?? ''),
      cookies: String(row.cookies ?? ''),
    });
    setModalMsg('');
    setFormRow(row);
  }, []);

  const sheetActions: SheetAction[] = [];
  if (sheetRow) {
    if (canToggle) {
      const next = !sheetRow.status;
      sheetActions.push({
        label: sheetRow.status ? 'Disable' : 'Enable',
        tone: sheetRow.status ? 'warning' : 'primary',
        onPress: () => {
          Alert.alert(
            next ? 'Enable provider' : 'Disable provider',
            `${next ? 'Enable' : 'Disable'} ${sheetRow.name || 'this provider'}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: next ? 'Enable' : 'Disable',
                style: next ? 'default' : 'destructive',
                onPress: () => {
                  void (async () => {
                    const err = await run('withdrawalProviders.update', {
                      _id: sheetRow._id,
                      status: next,
                      name: sheetRow.name,
                      updatedBy,
                    });
                    if (err) setError(err);
                    setSheetRow(null);
                  })();
                },
              },
            ],
          );
        },
      });
    }
    sheetActions.push({
      label: 'Edit provider',
      onPress: () => {
        const row = sheetRow;
        setSheetRow(null);
        openFullEdit(row);
      },
    });
    sheetActions.push({
      label: 'Update field',
      onPress: () => {
        const row = sheetRow;
        setSheetRow(null);
        setUpdateKey('link');
        setUpdateText(String(row.link ?? ''));
        setModalMsg('');
        setUpdateRow(row);
      },
    });
    if (canDelete) {
      sheetActions.push({
        label: 'Delete',
        tone: 'warning',
        onPress: () => {
          Alert.alert('Delete provider', `Delete ${sheetRow.name || 'this provider'}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  const err = await run('withdrawalProviders.delete', { _id: sheetRow._id });
                  if (err) setError(err);
                  setSheetRow(null);
                })();
              },
            },
          ]);
        },
      });
    }
  }

  const submitForm = useCallback(async () => {
    const isAdd = addOpen;
    if (
      !form.name.trim() ||
      !form.link.trim() ||
      !form.mid.trim() ||
      !form.token.trim() ||
      !form.cookies.trim()
    ) {
      setModalMsg('Please fill all fields');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try {
      const base = {
        name: form.name.trim(),
        link: form.link.trim(),
        mid: form.mid.trim(),
        token: form.token.trim(),
        cookies: form.cookies.trim(),
      };
      let err: string | null;
      if (isAdd) {
        err = await run('withdrawalProviders.create', { ...base, status: false });
      } else if (formRow) {
        err = await run('withdrawalProviders.updateAll', {
          _id: formRow._id,
          ...base,
          status: Boolean(formRow.status),
        });
      } else {
        err = 'No provider selected';
      }
      if (err) {
        setModalMsg(err);
        return;
      }
      setAddOpen(false);
      setFormRow(null);
      setForm(EMPTY_FORM);
    } finally {
      setBusy(false);
    }
  }, [addOpen, form, formRow, run]);

  const submitUpdateField = useCallback(async () => {
    if (!updateRow) return;
    const value = updateText.trim();
    if (!value) {
      setModalMsg('Please enter a value');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try {
      const prop = UPDATE_FIELDS.find((f) => f.key === updateKey)?.prop || 'link';
      const err = await run('withdrawalProviders.updateMidNameLink', {
        _id: updateRow._id,
        [prop]: value,
      });
      if (err) {
        setModalMsg(err);
        return;
      }
      setUpdateRow(null);
      setUpdateText('');
    } finally {
      setBusy(false);
    }
  }, [updateRow, updateKey, updateText, run]);

  const formVisible = addOpen || formRow !== null;

  const renderModalShell = (
    visible: boolean,
    title: string,
    onClose: () => void,
    children: React.ReactNode,
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {children}
            {modalMsg ? <Text style={styles.modalMsg}>{modalMsg}</Text> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
      <Text style={styles.title}>{toDisplayText('Withdrawal Providers')}</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · {filtered.length.toLocaleString('en-IN')} providers
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

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search name / display / MID / link…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {canAdd ? (
        <View style={styles.headerBtns}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              setForm(EMPTY_FORM);
              setModalMsg('');
              setAddOpen(true);
            }}
          >
            <Text style={styles.headerBtnText}>+ Add provider</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns.filter((c) => ['idx', 'name', 'displayName', 'status', 'mid'].includes(c.key))}
        rows={filtered}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No withdrawal providers"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        imageUri={sheetRow?.gatewayImage || undefined}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(sheetRow, 0),
                  badgeColor: c.key === 'status' ? c.badge?.(sheetRow) : undefined,
                  multiline: ['link', 'redirectionLink', 'token', 'cookies'].includes(c.key),
                }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Add / Edit full provider modal */}
      {renderModalShell(
        formVisible,
        addOpen ? 'Add Withdrawal Provider' : `Edit — ${formRow?.name || ''}`,
        () => {
          setAddOpen(false);
          setFormRow(null);
        },
        (
          <View>
            {FORM_FIELDS.map(([key, label, multiline]) => (
              <TextInput
                key={key}
                style={[styles.modalInput, multiline && styles.modalInputMultiline]}
                value={form[key]}
                onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                placeholder={label}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={multiline}
              />
            ))}
            <TouchableOpacity
              style={[styles.submitBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void submitForm()}
            >
              <Text style={styles.submitText}>
                {busy ? 'Saving…' : addOpen ? 'Add provider' : 'Update'}
              </Text>
            </TouchableOpacity>
          </View>
        ),
      )}

      {/* Single-field update modal */}
      {renderModalShell(
        updateRow !== null,
        `Update field — ${updateRow?.name || ''}`,
        () => setUpdateRow(null),
        (
          <View>
            <View style={styles.chipsWrap}>
              {UPDATE_FIELDS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, updateKey === f.key && styles.chipActive]}
                  onPress={() => {
                    setUpdateKey(f.key);
                    setUpdateText(
                      String((updateRow as Record<string, unknown> | null)?.[f.prop] ?? ''),
                    );
                  }}
                >
                  <Text style={[styles.chipText, updateKey === f.key && styles.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              value={updateText}
              onChangeText={setUpdateText}
              placeholder="New value…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.submitBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void submitUpdateField()}
            >
              <Text style={styles.submitText}>{busy ? 'Saving…' : 'Update'}</Text>
            </TouchableOpacity>
          </View>
        ),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(3) },
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
  headerBtns: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  headerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  headerBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(2),
  },
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
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginTop: spacing(2.5),
  },
  modalInputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(4),
  },
  btnDisabled: { opacity: 0.5 },
  submitText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
});
