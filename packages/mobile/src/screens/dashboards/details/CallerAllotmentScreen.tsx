/**
 * Caller Allotment — port of desktop CallerAllotmentPage.
 * Assign/remove caller heads + update Location / Extension / Bot / Server / Telegram.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { secureApi } from '../../../api/client';
import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  OFFICE_LOCATIONS,
} from '../../../auth/callerRoles';
import { RowDetailSheet } from './RowDetailSheet';

type SubAdmin = {
  _id: string;
  name?: string;
  realName?: string;
  empCode?: string;
  Role_ID?: string;
  block?: boolean;
  callerHead?: string | string[];
  officeLocation?: string;
  extensionId?: string[] | string;
  botIds?: string[] | string | number[];
  serverId?: string;
  telegram_username?: string;
};

type RoleGroup = {
  roleId: string;
  block?: boolean;
  subAdmins?: SubAdmin[];
};

type CallerHeadOption = { id: string; name: string };

type CallerRow = SubAdmin & {
  location: string;
  extensionNo: string;
  botNo: string;
  serverIds: string;
  telegramUserId: string;
};

type EditDraft = {
  location: string;
  extensionNo: string;
  botNo: string;
  serverIds: string;
  telegramUserId: string;
};

type EditMode = 'location' | 'ids' | 'head' | null;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || '—';
  return String(value);
}

function displayCallerHead(value: unknown): string {
  if (!value || value === 'not assigned') return '—';
  return display(value);
}

function formatIdList(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(',');
  if (value == null || value === '') return '';
  return String(value);
}

function parseBotIds(value: string): number[] {
  const ids = value
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isFinite(n));
  return Array.from(new Set(ids));
}

function parseExtensionIds(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toRow(subAdmin: SubAdmin, blockFallback?: boolean): CallerRow {
  return {
    ...subAdmin,
    block: subAdmin.block ?? blockFallback ?? false,
    location: subAdmin.officeLocation || '',
    extensionNo: '',
    botNo: '',
    serverIds: subAdmin.serverId || '',
    telegramUserId: subAdmin.telegram_username || '',
  };
}

function draftFromRow(row: CallerRow): EditDraft {
  return {
    location: row.location || '',
    extensionNo: row.extensionNo || '',
    botNo: row.botNo || '',
    serverIds: row.serverIds || '',
    telegramUserId: row.telegramUserId || '',
  };
}

export function CallerAllotmentScreen() {
  const [rows, setRows] = useState<CallerRow[]>([]);
  const [headOptions, setHeadOptions] = useState<CallerHeadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: CallerRow; index: number } | null>(
    null,
  );
  const [pickedHeadIds, setPickedHeadIds] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [draft, setDraft] = useState<EditDraft>({
    location: '',
    extensionNo: '',
    botNo: '',
    serverIds: '',
    telegramUserId: '',
  });

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
          (g.subAdmins ?? []).map((s) => toRow(s, g.block)),
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
    setEditMode(null);
    setDraft(draftFromRow(row));
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

  const setDraftField = useCallback(<K extends keyof EditDraft>(key: K, value: EditDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

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

  const updateOtherData = useCallback(async (scope: 'location' | 'ids') => {
    if (!selected) return;
    setBusy(true);
    try {
      const requests: Promise<{ ok: boolean; message?: string }>[] = [];

      if (scope === 'location' && draft.location.trim()) {
        requests.push(
          secureApi('ops.updateOfficeLocation', {
            _id: selected.row._id,
            officeLocation: draft.location.trim(),
          }),
        );
      }

      if (scope === 'ids') {
        const extensionId = parseExtensionIds(draft.extensionNo);
        const botIds = parseBotIds(draft.botNo);
        const attrPayload: Record<string, unknown> = { userId: selected.row._id };
        if (extensionId.length) attrPayload.extensionId = extensionId;
        if (draft.serverIds.trim()) attrPayload.serverId = draft.serverIds.trim();
        if (botIds.length) attrPayload.botIds = botIds;
        if (draft.telegramUserId.trim()) {
          attrPayload.telegramUsername = draft.telegramUserId.trim();
        }

        if (Object.keys(attrPayload).length > 1) {
          requests.push(secureApi('ops.updateSubadminAttributes', attrPayload));
        }
      }

      if (requests.length === 0) {
        Alert.alert(
          'Caller Allotment',
          scope === 'location'
            ? 'Select a caller location'
            : 'Enter Extension ID, Bot ID, Server ID, or Telegram ID',
        );
        return;
      }

      const results = await Promise.all(requests);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        Alert.alert('Failed', failed.message || 'Some updates failed to save');
      } else {
        Alert.alert('Updated', 'Data updated successfully');
        setEditMode(null);
        setSelected(null);
      }
      void load();
    } finally {
      setBusy(false);
    }
  }, [selected, draft, load]);

  return (
    <ScrollView
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
      <Text style={styles.title}>Caller Allotment</Text>
      <Text style={styles.hint}>
        Tap a caller, then choose what you want to update
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && rows.length === 0 ? <Text style={styles.emptyHint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.emptyHint}>No callers</Text> : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const blocked = Boolean(row.block);
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id ?? '')}`}
              style={[styles.card, blocked && styles.cardBlocked]}
              activeOpacity={blocked ? 1 : 0.75}
              disabled={blocked}
              onPress={() => openRow(row, index)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.name)}
                </Text>
                <Text style={[styles.statusPill, blocked ? styles.statusBlocked : styles.statusActive]}>
                  {blocked ? 'Blocked' : 'Active'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Emp: {display(row.empCode)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  Head: {displayCallerHead(row.callerHead)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Location</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.officeLocation || row.location)}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Real Name</Text>
                <Text style={styles.cardValue} numberOfLines={1}>
                  {display(row.realName)}
                </Text>
              </View>
              <View style={styles.idBlock}>
                <View style={styles.cardSplitRow}>
                  <Text style={styles.cardSplitLeft} numberOfLines={1}>
                    Ext: {formatIdList(row.extensionId) || '—'}
                  </Text>
                  <Text style={styles.cardSplitRight} numberOfLines={1}>
                    Server: {display(row.serverId)}
                  </Text>
                </View>
                <View style={styles.cardSplitRow}>
                  <Text style={styles.cardSplitLeft} numberOfLines={1}>
                    Bot: {formatIdList(row.botIds) || '—'}
                  </Text>
                  <Text style={styles.cardSplitRight} numberOfLines={1}>
                    Telegram: {display(row.telegram_username)}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardHint}>
                {blocked ? 'Blocked — updates disabled' : 'Tap card to update'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={!!selected}
        title={selected ? String(selected.row.name || selected.row.empCode || 'Caller') : ''}
        fields={[]}
        onClose={() => {
          setSelected(null);
          setEditMode(null);
        }}
        footer={
          selected && !selected.row.block ? (
            <View style={styles.editBlock}>
              <Text style={styles.editTitle}>Update caller</Text>
              <Text style={styles.editHint}>Choose one section at a time</Text>

              <View style={styles.menuGrid}>
                <TouchableOpacity
                  style={[styles.menuBtn, editMode === 'location' && styles.menuBtnActive]}
                  onPress={() => setEditMode(editMode === 'location' ? null : 'location')}
                >
                  <Text style={styles.menuIcon}>⌖</Text>
                  <Text style={[styles.menuText, editMode === 'location' && styles.menuTextActive]}>
                    Location
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuBtn, editMode === 'ids' && styles.menuBtnActive]}
                  onPress={() => setEditMode(editMode === 'ids' ? null : 'ids')}
                >
                  <Text style={styles.menuIcon}>#</Text>
                  <Text style={[styles.menuText, editMode === 'ids' && styles.menuTextActive]}>
                    IDs & Bot
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuBtn, editMode === 'head' && styles.menuBtnActive]}
                  onPress={() => setEditMode(editMode === 'head' ? null : 'head')}
                >
                  <Text style={styles.menuIcon}>♟</Text>
                  <Text style={[styles.menuText, editMode === 'head' && styles.menuTextActive]}>
                    Caller Head
                  </Text>
                </TouchableOpacity>
              </View>

              {editMode === 'location' ? (
                <View style={styles.editorCard}>
                  <Text style={styles.editorTitle}>Update location</Text>
                  <Text style={styles.currentText}>
                    Current: {display(selected.row.officeLocation || selected.row.location)}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {OFFICE_LOCATIONS.map((loc) => {
                        const on = draft.location === loc;
                        return (
                          <TouchableOpacity
                            key={loc}
                            style={[styles.chip, on && styles.chipActive]}
                            onPress={() => setDraftField('location', loc)}
                          >
                            <Text style={[styles.chipText, on && styles.chipTextActive]}>
                              {loc}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <TouchableOpacity
                    style={[styles.saveBtn, busy && styles.btnDisabled]}
                    disabled={busy || !draft.location}
                    onPress={() => void updateOtherData('location')}
                  >
                    <Text style={styles.saveBtnText}>
                      {busy ? 'Saving…' : 'Save Location'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {editMode === 'ids' ? (
                <View style={styles.editorCard}>
                  <Text style={styles.editorTitle}>Update IDs & bot</Text>
                  <Text style={styles.fieldCaption}>
                    Extension ID · Current: {formatIdList(selected.row.extensionId) || '—'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={draft.extensionNo}
                    onChangeText={(v) => setDraftField('extensionNo', v)}
                    placeholder="Comma separated extension IDs"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                  <Text style={styles.fieldCaption}>
                    Bot ID · Current: {formatIdList(selected.row.botIds) || '—'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={draft.botNo}
                    onChangeText={(v) => setDraftField('botNo', v)}
                    placeholder="e.g. 1,2,3"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.fieldCaption}>
                    Server ID · Current: {display(selected.row.serverId)}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={draft.serverIds}
                    onChangeText={(v) => setDraftField('serverIds', v)}
                    placeholder="Server ID"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                  <Text style={styles.fieldCaption}>
                    Telegram ID · Current: {display(selected.row.telegram_username)}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={draft.telegramUserId}
                    onChangeText={(v) => setDraftField('telegramUserId', v)}
                    placeholder="Telegram ID"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={[styles.saveBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={() => void updateOtherData('ids')}
                  >
                    <Text style={styles.saveBtnText}>
                      {busy ? 'Saving…' : 'Save IDs'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {editMode === 'head' ? (
                <View style={styles.editorCard}>
                  <Text style={styles.editorTitle}>Manage caller head</Text>
                  <Text style={styles.currentText}>
                    Current: {displayCallerHead(selected.row.callerHead)}
                  </Text>
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
                            <Text style={[styles.chipText, on && styles.chipTextActive]}>
                              {h.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  <View style={styles.headActions}>
                    <TouchableOpacity
                      style={[styles.saveBtn, styles.flexBtn, (busy || !selectedHeads.length) && styles.btnDisabled]}
                      disabled={busy || !selectedHeads.length}
                      onPress={() => void updateCallerHead()}
                    >
                      <Text style={styles.saveBtnText}>
                        {busy ? 'Saving…' : 'Assign'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.removeBtn, styles.flexBtn, (busy || !selectedHeads.length) && styles.btnDisabled]}
                      disabled={busy || !selectedHeads.length}
                      onPress={() => void removeCallerHead()}
                    >
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
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
  emptyHint: { color: colors.muted, marginTop: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(1) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardBlocked: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusActive: {
    color: '#166534',
    backgroundColor: 'rgba(22,163,74,0.18)',
  },
  statusBlocked: {
    color: '#991b1b',
    backgroundColor: 'rgba(220,38,38,0.18)',
  },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '55%',
    textAlign: 'right',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', width: '38%' },
  cardValue: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  idBlock: {
    marginTop: spacing(1),
    paddingTop: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  editBlock: { gap: spacing(1.5), marginBottom: spacing(2) },
  editTitle: { color: colors.foreground, fontWeight: '800', fontSize: 16 },
  editHint: { color: colors.muted, fontSize: 12, marginTop: -spacing(1) },
  menuGrid: { flexDirection: 'row', gap: spacing(1.5) },
  menuBtn: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(0.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing(1.5),
  },
  menuBtnActive: { borderColor: colors.primary, backgroundColor: 'rgba(245,179,1,0.12)' },
  menuIcon: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  menuText: { color: colors.foreground, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  menuTextActive: { color: colors.primary },
  editorCard: {
    gap: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    padding: spacing(2.5),
  },
  editorTitle: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
  currentText: { color: colors.muted, fontSize: 12 },
  fieldCaption: { color: colors.foreground, fontWeight: '700', fontSize: 12 },
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.foreground,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    fontSize: 13,
  },
  saveBtn: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing(0.5),
  },
  saveBtnText: { color: colors.primaryForeground, fontSize: 13, fontWeight: '800' },
  removeBtn: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructive,
  },
  removeBtnText: { color: colors.destructive, fontSize: 13, fontWeight: '800' },
  headActions: { flexDirection: 'row', gap: spacing(1.5) },
  flexBtn: { flex: 1 },
  btnDisabled: { opacity: 0.45 },
});
