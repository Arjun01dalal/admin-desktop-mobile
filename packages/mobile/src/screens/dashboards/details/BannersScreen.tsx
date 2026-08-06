/**
 * Banners List — port of desktop BannersPage.
 * ops.bannersGetAll {} → list sorted by position asc. Row tap opens a detail sheet
 * with the banner image + all fields; toggle status, set position (modal), and delete
 * are gated actions. Header "Add banner" opens a create modal.
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
import { hasPermission } from '../../../auth/permissions';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  imagePath?: string;
  gameName?: string;
  type?: string;
  status?: boolean;
  position?: number;
  [key: string]: unknown;
};

const MAIN_KEYS = new Set(['idx', 'gameName', 'type', 'position', 'status']);
const POSITION_OPTIONS = Array.from({ length: 25 }, (_, i) => i + 1);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/** Tolerant list unpack — res.data may be array or under .payload/.items/.data. */
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return obj.payload as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export function BannersScreen() {
  const canAdd = hasPermission('Add_Banner');
  const canToggle = hasPermission('Toggle_Banner');
  const canDelete = hasPermission('Delete_Banner');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Add banner modal.
  const [addOpen, setAddOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [gameName, setGameName] = useState('');
  const [type, setType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  // Set position modal.
  const [positionRow, setPositionRow] = useState<Row | null>(null);
  const [positionDraft, setPositionDraft] = useState('');
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionMsg, setPositionMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.bannersGetAll', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load banners');
        setRows([]);
        return;
      }
      const list = asList<Row>(res.data);
      const sorted = [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setSheetRow(null);
      setRows(sorted);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = useCallback(() => {
    setImageUrl('');
    setGameName('');
    setType('');
    setAddMsg('');
    setAddOpen(true);
  }, []);

  const submitAdd = useCallback(async () => {
    if (!imageUrl.trim() || !gameName.trim() || !type.trim()) {
      setAddMsg('Please fill image URL, game name and type');
      return;
    }
    setSubmitting(true);
    setAddMsg('');
    try {
      const res = await secureApi<unknown>('ops.bannersCreate', {
        imagePath: imageUrl.trim(),
        gameName: gameName.trim(),
        type: type.trim(),
      });
      if (!res.ok) {
        setAddMsg(res.message || 'Failed to add banner');
        return;
      }
      setAddOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [imageUrl, gameName, type, load]);

  const toggleStatus = useCallback(
    (row: Row) => {
      const next = !row.status;
      Alert.alert(
        next ? 'Enable banner' : 'Disable banner',
        `${next ? 'Enable' : 'Disable'} ${display(row.gameName)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: next ? 'Enable' : 'Disable',
            style: next ? 'default' : 'destructive',
            onPress: () => {
              void (async () => {
                const res = await secureApi<unknown>('ops.bannersUpdate', {
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

  const submitPosition = useCallback(async () => {
    const row = positionRow;
    if (!row) return;
    const position = Number(positionDraft);
    if (!position || position < 1) {
      setPositionMsg('Please enter a valid position');
      return;
    }
    setSavingPosition(true);
    setPositionMsg('');
    try {
      const res = await secureApi<unknown>('ops.bannersUpdatePosition', {
        _id: row._id,
        position,
      });
      if (!res.ok) {
        setPositionMsg(res.message || 'Failed to update position');
        return;
      }
      setPositionRow(null);
      void load();
    } finally {
      setSavingPosition(false);
    }
  }, [positionRow, positionDraft, load]);

  const deleteBanner = useCallback(
    (row: Row) => {
      Alert.alert('Delete banner', 'This banner will be permanently removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('ops.bannersDelete', { _id: row._id });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to delete banner');
                setSheetRow(null);
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
      { key: 'gameName', label: 'Game Name', width: 160, render: (r) => display(r.gameName) },
      { key: 'type', label: 'Type', width: 120, render: (r) => display(r.type) },
      {
        key: 'position',
        label: 'Position',
        width: 90,
        align: 'center',
        render: (r) => display(r.position),
      },
      { key: 'status', label: 'Status', width: 90, render: (r) => (r.status ? 'Active' : 'Inactive') },
      { key: 'imagePath', label: 'Image Path', width: 220, render: (r) => display(r.imagePath) },
    ],
    [],
  );

  const sheetActions: SheetAction[] = [];
  if (sheetRow) {
    if (canToggle) {
      sheetActions.push({
        label: sheetRow.status ? 'Disable' : 'Enable',
        tone: sheetRow.status ? 'warning' : 'primary',
        onPress: () => toggleStatus(sheetRow),
      });
    }
    sheetActions.push({
      label: 'Set position',
      tone: 'primary',
      onPress: () => {
        setPositionRow(sheetRow);
        setPositionDraft(sheetRow.position != null ? String(sheetRow.position) : '');
        setPositionMsg('');
        setSheetRow(null);
      },
    });
    if (canDelete) {
      sheetActions.push({
        label: 'Delete',
        tone: 'warning',
        onPress: () => deleteBanner(sheetRow),
      });
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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Banners List</Text>
          <Text style={styles.sub}>Total: {rows.length.toLocaleString('en-IN')}</Text>
        </View>
        {canAdd ? (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add banner</Text>
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
        emptyMessage="No banners found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.gameName) : ''}
        imageUri={sheetRow?.imagePath || undefined}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(sheetRow, 0),
                  multiline: c.key === 'imagePath',
                }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Set position modal */}
      <Modal
        visible={positionRow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPositionRow(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setPositionRow(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Set position{positionRow ? ` — ${display(positionRow.gameName)}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setPositionRow(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={styles.input}
                value={positionDraft}
                onChangeText={setPositionDraft}
                placeholder="Position (1-25)"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />
              <View style={styles.chipsRow}>
                {POSITION_OPTIONS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, positionDraft === String(n) && styles.chipActive]}
                    onPress={() => setPositionDraft(String(n))}
                  >
                    <Text
                      style={[styles.chipText, positionDraft === String(n) && styles.chipTextActive]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {positionMsg ? <Text style={styles.modalMsg}>{positionMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, savingPosition && styles.btnDisabled]}
                disabled={savingPosition}
                onPress={() => void submitPosition()}
              >
                <Text style={styles.submitBtnText}>{savingPosition ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add banner modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="slide"
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
              <Text style={styles.modalTitle} numberOfLines={1}>
                Add Banner
              </Text>
              <TouchableOpacity
                onPress={() => setAddOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Image URL *</Text>
              <TextInput
                style={styles.input}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>Game Name *</Text>
              <TextInput
                style={styles.input}
                value={gameName}
                onChangeText={setGameName}
                placeholder="Game name"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Type *</Text>
              <TextInput
                style={styles.input}
                value={type}
                onChangeText={setType}
                placeholder="Type"
                placeholderTextColor={colors.muted}
              />
              {addMsg ? <Text style={styles.modalMsg}>{addMsg}</Text> : null}
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.btnDisabled]}
                disabled={submitting}
                onPress={() => void submitAdd()}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(3) },
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
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  btnDisabled: { opacity: 0.5 },
  submitBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
