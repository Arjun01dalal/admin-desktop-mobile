/**
 * Set Gateway Mid — mobile port of desktop WhatsappMidPage / admin-panel gateway-upi.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EMPTY_GATEWAY_MID_FORM,
  WHATSAPP_UP_RAJ_NUMBER,
  availableGatewayMidPositions,
  buildGatewayMidSavePayload,
  buildGatewayMidStatusPayload,
  dedupeStrings,
  formStateFromGatewayMidRow,
  formatGatewayTypeLabel,
  getGatewayMidRowId,
  groupGatewayMids,
  isWhatsappType,
  isWhatsappUpRajName,
  parseDistinctMidOptions,
  parseGatewayNameOptions,
  parseGatewayUpisResponse,
  validateGatewayMidForm,
  type GatewayMidFormState,
  type GatewayMidRow,
} from '@astro/shared/gatewayMid';
import { makeStyles } from '../../../styles/common';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function ChipRow({
  options,
  onPick,
  selected,
  formatLabel,
}: {
  options: string[];
  onPick: (value: string) => void;
  selected?: string;
  formatLabel?: (value: string) => string;
}) {
  if (options.length === 0) return null;
  return (
    <ScrollView horizontal style={styles.chipRow} showsHorizontalScrollIndicator={false}>
      {options.map((value) => {
        const active = selected === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.chip, active ? styles.chipActive : null]}
            onPress={() => onPick(value)}
          >
            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
              {formatLabel ? formatLabel(value) : value}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function WhatsappMidScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<GatewayMidRow[]>([]);
  const [apiTypeOptions, setApiTypeOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<GatewayMidRow | null>(null);
  const [gatewayNames, setGatewayNames] = useState<string[]>([]);
  const [gatewayMids, setGatewayMids] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<GatewayMidFormState>(EMPTY_GATEWAY_MID_FORM);
  const [submitting, setSubmitting] = useState(false);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('whatsappMid.list', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load Gateway MIDs');
        setRows([]);
        setApiTypeOptions([]);
        return;
      }
      setSheetRow(null);
      const { rows: nextRows, types } = parseGatewayUpisResponse(res.data);
      setRows(nextRows);
      setApiTypeOptions(types);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    const [namesRes, midsRes] = await Promise.all([
      secureApi<unknown>('depositProviders.list', {}),
      secureApi<unknown>('depositProviders.distinctMids', {}),
    ]);
    if (namesRes.ok) setGatewayNames(parseGatewayNameOptions(namesRes.data));
    if (midsRes.ok) setGatewayMids(parseDistinctMidOptions(midsRes.data));
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  const nameOptions = useMemo(
    () => dedupeStrings([...gatewayNames, ...rows.map((item) => item.name)]),
    [gatewayNames, rows],
  );

  const midOptions = useMemo(
    () => dedupeStrings([...gatewayMids, ...rows.map((item) => item.mid)]),
    [gatewayMids, rows],
  );

  const typeOptions = useMemo(() => {
    if (apiTypeOptions.length) return apiTypeOptions;
    return dedupeStrings(rows.map((item) => item.type));
  }, [apiTypeOptions, rows]);

  const availablePositions = useMemo(
    () => availableGatewayMidPositions(rows, form.name, editingId),
    [rows, form.name, editingId],
  );

  const { groups: groupedByName, totalUpis, activeCount } = useMemo(
    () => groupGatewayMids(rows),
    [rows],
  );

  const resetForm = () => {
    setForm(EMPTY_GATEWAY_MID_FORM);
    setEditingId('');
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (row: GatewayMidRow) => {
    const rowId = getGatewayMidRowId(row);
    if (!rowId) return;
    setEditingId(rowId);
    setForm(formStateFromGatewayMidRow(row));
    setSheetRow(null);
    setFormOpen(true);
  };

  const toggleStatus = async (row: GatewayMidRow, checked: boolean) => {
    const rowId = getGatewayMidRowId(row);
    if (!rowId) return;
    let snapshot: GatewayMidRow[] = [];
    setRows((prev) => {
      snapshot = prev;
      return prev.map((item) =>
        getGatewayMidRowId(item) === rowId ? { ...item, isCurrentlyActive: checked } : item,
      );
    });
    setSheetRow((prev) =>
      prev && getGatewayMidRowId(prev) === rowId
        ? { ...prev, isCurrentlyActive: checked }
        : prev,
    );
    const res = await secureApi('whatsappMid.update', buildGatewayMidStatusPayload(row, checked));
    if (!res.ok) {
      setRows(snapshot);
      Alert.alert('Error', res.message || 'Failed to update status');
    }
  };

  const submitSave = async () => {
    const nextErrors = validateGatewayMidForm(form);
    if (Object.keys(nextErrors).length) {
      Alert.alert('Validation', Object.values(nextErrors)[0] || 'Fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const isUpdate = Boolean(editingId);
      const editingRow = isUpdate
        ? rows.find((item) => getGatewayMidRowId(item) === editingId)
        : undefined;
      const payload = buildGatewayMidSavePayload(form, { editingId, editingRow });
      const res = await secureApi(isUpdate ? 'whatsappMid.update' : 'whatsappMid.create', payload);
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Failed to save');
        return;
      }
      setFormOpen(false);
      resetForm();
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRow = (row: GatewayMidRow) => {
    const rowId = getGatewayMidRowId(row);
    if (!rowId) return;
            Alert.alert('Delete Gateway MID?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            let snapshot: GatewayMidRow[] = [];
            setSheetRow(null);
            setRows((prev) => {
              snapshot = prev;
              return prev.filter((item) => getGatewayMidRowId(item) !== rowId);
            });
            const res = await secureApi('whatsappMid.delete', {
              name: row.name || '',
              id: rowId,
            });
            if (!res.ok) {
              setRows(snapshot);
              Alert.alert('Error', res.message || 'Failed to delete');
            }
          })();
        },
      },
    ]);
  };

  const showWhatsappNumber = isWhatsappType(form.type);

  const sheetFields: SheetField[] = sheetRow
    ? [
        { label: 'Name', value: display(sheetRow.name) },
        { label: 'MID', value: display(sheetRow.mid) },
        { label: 'Type', value: display(formatGatewayTypeLabel(sheetRow.type || '') || undefined) },
        { label: 'UPI Id', value: display(sheetRow.upiId) },
        { label: 'WhatsApp', value: display(sheetRow.whatsappNumber || undefined) },
        { label: 'Max Deposit', value: display(sheetRow.maxDepositAllowed) },
        { label: 'Position', value: display(sheetRow.position) },
        {
          label: 'Active',
          value: sheetRow.isCurrentlyActive ? 'Yes' : 'No',
        },
      ]
    : [];

  const sheetActions: SheetAction[] = sheetRow
    ? [
        {
          label: 'Edit',
          onPress: () => openEdit(sheetRow),
        },
        {
          label: sheetRow.isCurrentlyActive ? 'Deactivate' : 'Activate',
          onPress: () => void toggleStatus(sheetRow, !sheetRow.isCurrentlyActive),
        },
        {
          label: 'Delete',
          tone: 'danger',
          onPress: () => deleteRow(sheetRow),
        },
      ]
    : [];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Set Gateway Mid</Text>
          <Text style={styles.subtitle}>
            {groupedByName.length} names · {totalUpis} UPIs · {activeCount} active
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No Gateway MIDs found</Text>
      ) : null}

      <View style={styles.list}>
        {groupedByName.map((group) => (
          <View key={group.name} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={styles.groupAccent} />
              <View style={styles.groupHeaderText}>
                <Text style={styles.groupLabel}>NAME</Text>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {group.name}
                </Text>
              </View>
              <View style={styles.groupBadge}>
                <Text style={styles.groupCount}>{group.rows.length}</Text>
              </View>
            </View>
            {group.rows.map((row, i) => (
              <TouchableOpacity
                key={getGatewayMidRowId(row) || `${group.name}-${i}`}
                style={styles.card}
                onPress={() => setSheetRow(row)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    MID: {display(row.mid)}
                  </Text>
                  <Switch
                    value={Boolean(row.isCurrentlyActive)}
                    onValueChange={(v) => void toggleStatus(row, v)}
                    style={styles.cardSwitch}
                  />
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {formatGatewayTypeLabel(row.type || '') || '—'} · UPI: {display(row.upiId)}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  Max {display(row.maxDepositAllowed)} · Pos {display(row.position)}
                  {row.whatsappNumber ? ` · ${row.whatsappNumber}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setFormOpen(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.formSheet}>
            <ScrollView
              contentContainerStyle={[
                styles.formContent,
                { paddingBottom: Math.max(insets.bottom, spacing(4)) + spacing(4) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.formTitle}>
                {editingId ? 'Update Gateway Mid' : 'Add Gateway Mid'}
              </Text>

              <Text style={styles.fieldLabel}>Type</Text>
              <ChipRow
                options={typeOptions}
                selected={form.type}
                formatLabel={(value) => formatGatewayTypeLabel(value) || value}
                onPick={(value) => {
                  setForm((prev) => ({
                    ...prev,
                    type: value,
                    whatsappNumber: isWhatsappType(value)
                      ? isWhatsappUpRajName(prev.name)
                        ? WHATSAPP_UP_RAJ_NUMBER
                        : prev.whatsappNumber
                      : '',
                  }));
                }}
              />
              <TextInput
                style={styles.input}
                placeholder="Type"
                placeholderTextColor={colors.muted}
                value={form.type}
                onChangeText={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    type: value,
                    whatsappNumber: isWhatsappType(value)
                      ? isWhatsappUpRajName(prev.name)
                        ? WHATSAPP_UP_RAJ_NUMBER
                        : prev.whatsappNumber
                      : '',
                  }))
                }
              />

              <Text style={styles.fieldLabel}>Name</Text>
              <ChipRow
                options={nameOptions.slice(0, 20)}
                selected={form.name}
                onPick={(value) => {
                  setForm((prev) => ({
                    ...prev,
                    name: value,
                    position: '',
                    whatsappNumber: isWhatsappUpRajName(value)
                      ? WHATSAPP_UP_RAJ_NUMBER
                      : prev.whatsappNumber,
                  }));
                }}
              />
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={colors.muted}
                value={form.name}
                onChangeText={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    name: value,
                    position: '',
                    whatsappNumber: isWhatsappUpRajName(value)
                      ? WHATSAPP_UP_RAJ_NUMBER
                      : prev.whatsappNumber,
                  }))
                }
              />

              <Text style={styles.fieldLabel}>MID</Text>
              <ChipRow
                options={midOptions.slice(0, 20)}
                selected={form.mid}
                onPick={(value) => setForm((prev) => ({ ...prev, mid: value }))}
              />
              <TextInput
                style={styles.input}
                placeholder="MID"
                placeholderTextColor={colors.muted}
                value={form.mid}
                onChangeText={(value) => setForm((prev) => ({ ...prev, mid: value }))}
              />

              <TextInput
                style={styles.input}
                placeholder="UPI Id"
                placeholderTextColor={colors.muted}
                value={form.upiId}
                onChangeText={(value) => setForm((prev) => ({ ...prev, upiId: value }))}
              />

              {showWhatsappNumber ? (
                <TextInput
                  style={styles.input}
                  placeholder={
                    isWhatsappUpRajName(form.name)
                      ? 'WhatsApp Number'
                      : 'WhatsApp Number (saved as 91…)'
                  }
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  value={form.whatsappNumber}
                  onChangeText={(value) =>
                    setForm((prev) => ({ ...prev, whatsappNumber: value }))
                  }
                />
              ) : null}

              <TextInput
                style={styles.input}
                placeholder="Max Deposit Allowed"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                value={form.maxDepositAllowed}
                onChangeText={(value) =>
                  setForm((prev) => ({ ...prev, maxDepositAllowed: value }))
                }
              />

              {form.name ? (
                <>
                  <Text style={styles.fieldLabel}>Position</Text>
                  <ChipRow
                    options={availablePositions.map(String)}
                    selected={form.position}
                    onPick={(value) => setForm((prev) => ({ ...prev, position: value }))}
                  />
                  {availablePositions.length === 0 ? (
                    <Text style={styles.hint}>All positions (1-15) used for this name</Text>
                  ) : null}
                </>
              ) : null}

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setFormOpen(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  disabled={submitting}
                  onPress={() => void submitSave()}
                >
                  <Text style={styles.addBtnText}>
                    {submitting ? 'Saving…' : editingId ? 'Update' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = makeStyles({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(8) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(4),
    gap: spacing(2),
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '800', color: colors.foreground },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: spacing(2),
    borderRadius: radius.sm,
    marginBottom: spacing(2),
  },
  errorText: { color: colors.destructive },
  hint: { color: colors.muted, marginBottom: spacing(2) },
  list: { gap: spacing(5) },
  group: { gap: spacing(1.5) },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    gap: spacing(2.5),
  },
  groupAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  groupHeaderText: { flex: 1, minWidth: 0 },
  groupLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  groupTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '800',
  },
  groupBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  groupCount: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardName: {
    fontWeight: '700',
    color: colors.foreground,
    flex: 1,
    marginRight: 8,
    fontSize: 13,
  },
  cardSwitch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  cardMeta: { color: colors.muted, fontSize: 11, marginTop: 1, lineHeight: 14 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
  },
  formContent: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    gap: spacing(2),
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  fieldLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: -4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2),
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  chipRow: { maxHeight: 40 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: { color: colors.foreground, fontSize: 12 },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '700' },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(2),
  },
  cancelBtn: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  cancelText: { color: colors.muted, fontWeight: '600' },
});
