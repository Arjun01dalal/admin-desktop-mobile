/**
 * Social Media — mobile port of desktop SocialMediaPage.
 * ops.socialMediaGetAll lists links; ops.socialMediaCreate / ops.socialMediaUpdate /
 * ops.socialMediaDelete are the add / edit / delete mutations.
 *
 * Desktop's "gated share" trick (every 6th tap on a name copies the REAL link;
 * other taps copy a decoy) is preserved via the RN Share sheet — mobile has no
 * clipboard dependency, so "copy" is implemented as a native share of the URL.
 * Row tap opens the detail sheet with Share / Edit / Delete actions.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
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
  _id: string;
  name?: string;
  link?: string;
  [key: string]: unknown;
};

/** Shared decoy until the 6th name-tap unlocks the real link. */
const SHARE_DECOY_URL = 'https://astropixel.live/';
/** Every Nth tap on a name shares that row's real link. */
const COPY_LINK_EVERY_N_TAPS = 6;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function asList(data: unknown): Row[] {
  if (Array.isArray(data)) return data as Row[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const key of ['rows', 'data', 'list', 'items', 'payload', 'result']) {
      if (Array.isArray(d[key])) return d[key] as Row[];
    }
  }
  return [];
}

export function SocialMediaScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [formName, setFormName] = useState('');
  const [formLink, setFormLink] = useState('');
  const [activeId, setActiveId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameTapCountsRef = useRef<Record<string, number>>({});
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.socialMediaGetAll', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load social media links');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(asList(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shareLink = useCallback(async (row: Row) => {
    const key = row._id;
    const next = (nameTapCountsRef.current[key] || 0) + 1;
    nameTapCountsRef.current[key] = next;

    const realLink = String(row.link || '').trim();
    const unlock = next % COPY_LINK_EVERY_N_TAPS === 0;
    const toShare = unlock ? realLink : SHARE_DECOY_URL;

    if (unlock && !realLink) {
      Alert.alert('No link available');
      return;
    }
    try {
      await Share.share({ message: toShare });
    } catch {
      /* user dismissed */
    }
  }, []);

  const openAdd = useCallback(() => {
    setFormMode('add');
    setActiveId('');
    setFormName('');
    setFormLink('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: Row) => {
    setFormMode('edit');
    setActiveId(row._id);
    setFormName(row.name || '');
    setFormLink(row.link || '');
    setFormOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    const name = formName.trim();
    const link = formLink.trim();
    if (!name || !link) {
      Alert.alert('Enter Name and Link');
      return;
    }
    setSubmitting(true);
    try {
      const res =
        formMode === 'add'
          ? await secureApi<unknown>('ops.socialMediaCreate', { name, link })
          : await secureApi<unknown>('ops.socialMediaUpdate', { _id: activeId, name, link });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to save social media link');
        return;
      }
      setFormOpen(false);
      setSheetRow(null);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [formMode, formName, formLink, activeId, load]);

  const handleDelete = useCallback(
    (row: Row) => {
      Alert.alert('Are you sure?', 'This social media link will be permanently removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSubmitting(true);
              try {
                const res = await secureApi<unknown>('ops.socialMediaDelete', { _id: row._id });
                if (!res.ok) {
                  setError(res.message || 'Failed to delete social media link');
                  setSheetRow(null);
                  return;
                }
                setSheetRow(null);
                void load();
              } finally {
                setSubmitting(false);
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
      { key: 'name', label: 'Name', width: 220, render: (r) => display(r.name) },
    ],
    [],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return [
      { label: 'Name', value: display(sheetRow.name) },
      { label: 'Link', value: display(sheetRow.link), multiline: true },
    ];
  }, [sheetRow]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const row = sheetRow;
    return [
      { label: 'Share', tone: 'primary', onPress: () => void shareLink(row) },
      { label: 'Edit', tone: 'default', onPress: () => openEdit(row) },
      { label: 'Delete', tone: 'warning', onPress: () => handleDelete(row) },
    ];
  }, [sheetRow, shareLink, openEdit, handleDelete]);

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
        <Text style={styles.title}>Social Media</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No social media links found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to Share / Edit / Delete"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => !submitting && setFormOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>
              {formMode === 'add' ? 'Add Social Media' : 'Edit Social Media'}
            </Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Link</Text>
            <TextInput
              style={styles.input}
              value={formLink}
              onChangeText={setFormLink}
              placeholder="https://…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setFormOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, submitting && styles.btnDisabled]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                <Text style={styles.formBtnPrimaryText}>{submitting ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    marginBottom: spacing(3),
  },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(1),
  },
  formTitle: { color: colors.foreground, fontSize: 17, fontWeight: '700', marginBottom: spacing(2) },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: spacing(2) },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    marginTop: spacing(1),
  },
  formActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(4) },
  formBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBtnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  formBtnGhostText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  formBtnPrimary: { backgroundColor: colors.primary },
  formBtnPrimaryText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
});
