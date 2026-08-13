/**
 * MID Groups — mobile port of desktop MidGroupsPage / admin-panel Funds/MidGroups.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
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

type MidGroupMap = Record<string, string[]>;

function normalizeGroupMids(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : item && typeof item === 'object'
            ? String(
                (item as { mid?: unknown; name?: unknown; value?: unknown }).mid ??
                  (item as { name?: unknown }).name ??
                  (item as { value?: unknown }).value ??
                  '',
              )
            : '',
      )
      .map((m) => m.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return [];
}

function parseMidGroupsPayload(raw: unknown): { groups: MidGroupMap; whatsapp: string[] } {
  const root =
    raw && typeof raw === 'object'
      ? ((raw as { payload?: unknown; data?: unknown }).payload ??
          (raw as { data?: unknown }).data ??
          raw)
      : {};
  const groups: MidGroupMap = {};
  const obj = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};
  const source =
    obj.groups ??
    obj.midGroups ??
    obj.groupMap ??
    (typeof root === 'object' && !Array.isArray(root) ? root : null);

  if (Array.isArray(source)) {
    source.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const row = item as Record<string, unknown>;
      const name = `${row.group ?? row.name ?? row.key ?? ''}`.trim();
      if (!name || name === 'whatsappGlobalOnly' || name === 'whatsapp-global-only') return;
      groups[name] = normalizeGroupMids(row.mids ?? row.mid ?? row.values);
    });
  } else if (source && typeof source === 'object') {
    Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
      if (
        [
          'whatsappGlobalOnly',
          'whatsapp-global-only',
          'whatsappGlobal',
          'groups',
          'payload',
          'success',
          'message',
          'status',
        ].includes(key)
      ) {
        return;
      }
      if (Array.isArray(value) || typeof value === 'string') {
        groups[key] = normalizeGroupMids(value);
      } else if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>;
        groups[key] = normalizeGroupMids(nested.mids ?? nested.mid ?? nested.values);
      }
    });
  }

  return {
    groups,
    whatsapp: normalizeGroupMids(
      obj.whatsappGlobalOnly ??
        obj['whatsapp-global-only'] ??
        obj.whatsappGlobal ??
        obj.whatsapp,
    ),
  };
}

function initials(value: string): string {
  return (
    value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'G'
  );
}

export function MidGroupsScreen() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<MidGroupMap>({});
  const [whatsappMids, setWhatsappMids] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [draftMids, setDraftMids] = useState<Record<string, string>>({});
  const [whatsappDraft, setWhatsappDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('funds.midGroupsGet', {});
      if (!res.ok) {
        setError(res.message || 'Failed to load MID groups');
        setGroups({});
        setWhatsappMids([]);
        return;
      }
      const parsed = parseMidGroupsPayload(res.data);
      setGroups(parsed.groups);
      setWhatsappMids(parsed.whatsapp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredNames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .filter((name) => {
        if (!q) return true;
        if (name.toLowerCase().includes(q)) return true;
        return (groups[name] || []).some((mid) => mid.toLowerCase().includes(q));
      });
  }, [groups, search]);

  const totalMids = useMemo(
    () => Object.values(groups).reduce((sum, mids) => sum + mids.length, 0),
    [groups],
  );

  const runMutation = async (
    action:
      | 'funds.midGroupsAddGroup'
      | 'funds.midGroupsRemoveGroup'
      | 'funds.midGroupsAddMid'
      | 'funds.midGroupsRemoveMid'
      | 'funds.midGroupsWhatsappAdd'
      | 'funds.midGroupsWhatsappRemove',
    payload: Record<string, unknown>,
    successMsg: string,
  ) => {
    setBusy(true);
    try {
      const res = await secureApi(action, payload);
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Action failed');
        return;
      }
      Alert.alert('Done', successMsg);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const confirm = (title: string, message: string, onYes: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onYes },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading || busy}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>MID Groups</Text>
      <Text style={styles.sub}>
        Organize payin groups, assign MIDs, and manage WhatsApp global list.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Groups</Text>
          <Text style={styles.statValue}>{Object.keys(groups).length}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total MIDs</Text>
          <Text style={styles.statValue}>{totalMids}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>WA Global</Text>
          <Text style={styles.statValue}>{whatsappMids.length}</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={[styles.input, styles.flex]}
          placeholder="Search group or MID"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.btn} onPress={() => setAddOpen(true)}>
          <Text style={styles.btnText}>+ Group</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>WhatsApp Global Only</Text>
      <View style={[styles.card, styles.waCard]}>
        <Text style={styles.cardTitle}>WhatsApp Global MIDs</Text>
        <Text style={styles.cardMeta}>
          {whatsappMids.length} MID{whatsappMids.length === 1 ? '' : 's'}
        </Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex]}
            placeholder="Add WhatsApp MID"
            placeholderTextColor={colors.muted}
            value={whatsappDraft}
            onChangeText={setWhatsappDraft}
          />
          <TouchableOpacity
            style={styles.btn}
            disabled={busy}
            onPress={() => {
              const mid = whatsappDraft.trim();
              if (!mid) {
                Alert.alert('Validation', 'Enter MID');
                return;
              }
              setWhatsappDraft('');
              void runMutation(
                'funds.midGroupsWhatsappAdd',
                { mids: [mid] },
                'WhatsApp global MID added',
              );
            }}
          >
            <Text style={styles.btnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {whatsappMids.length === 0 ? (
          <Text style={styles.hint}>No WhatsApp global MIDs yet</Text>
        ) : (
          whatsappMids.map((mid) => (
            <View key={`wa-${mid}`} style={styles.midRow}>
              <Text style={styles.midText}>{mid}</Text>
              <TouchableOpacity
                onPress={() =>
                  confirm('Remove MID?', `Remove WhatsApp global MID "${mid}"?`, () =>
                    void runMutation(
                      'funds.midGroupsWhatsappRemove',
                      { mids: [mid] },
                      'WhatsApp global MID removed',
                    ),
                  )
                }
              >
                <Text style={styles.danger}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={styles.section}>
        Payin Groups ({filteredNames.length}/{Object.keys(groups).length})
      </Text>
      {filteredNames.length === 0 ? (
        <Text style={styles.hint}>No groups found</Text>
      ) : (
        filteredNames.map((groupName) => {
          const mids = groups[groupName] || [];
          return (
            <View key={groupName} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(groupName)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{groupName}</Text>
                  <Text style={styles.cardMeta}>
                    {mids.length} MID{mids.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    confirm(
                      'Remove group?',
                      `Remove group "${groupName}" and all its MIDs?`,
                      () =>
                        void runMutation(
                          'funds.midGroupsRemoveGroup',
                          { group: groupName },
                          `Group "${groupName}" removed`,
                        ),
                    )
                  }
                >
                  <Text style={styles.danger}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.flex]}
                  placeholder="Add MID"
                  placeholderTextColor={colors.muted}
                  value={draftMids[groupName] || ''}
                  onChangeText={(v) =>
                    setDraftMids((prev) => ({ ...prev, [groupName]: v }))
                  }
                />
                <TouchableOpacity
                  style={styles.btn}
                  disabled={busy}
                  onPress={() => {
                    const mid = (draftMids[groupName] || '').trim();
                    if (!mid) {
                      Alert.alert('Validation', 'Enter MID');
                      return;
                    }
                    setDraftMids((prev) => ({ ...prev, [groupName]: '' }));
                    void runMutation(
                      'funds.midGroupsAddMid',
                      { group: groupName, mids: [mid] },
                      `MID added to ${groupName}`,
                    );
                  }}
                >
                  <Text style={styles.btnText}>Add</Text>
                </TouchableOpacity>
              </View>
              {mids.length === 0 ? (
                <Text style={styles.hint}>No MIDs in this group</Text>
              ) : (
                mids.map((mid) => (
                  <View key={`${groupName}-${mid}`} style={styles.midRow}>
                    <Text style={styles.midText}>{mid}</Text>
                    <TouchableOpacity
                      onPress={() =>
                        confirm('Remove MID?', `Remove MID "${mid}" from ${groupName}?`, () =>
                          void runMutation(
                            'funds.midGroupsRemoveMid',
                            { group: groupName, mids: [mid] },
                            `MID removed from ${groupName}`,
                          ),
                        )
                      }
                    >
                      <Text style={styles.danger}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          );
        })
      )}

      <Modal visible={addOpen} transparent animationType="slide">
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.cardTitle}>Add Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              placeholderTextColor={colors.muted}
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setAddOpen(false);
                  setNewGroupName('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => {
                  const group = newGroupName.trim();
                  if (!group) {
                    Alert.alert('Validation', 'Enter group name');
                    return;
                  }
                  setAddOpen(false);
                  setNewGroupName('');
                  void runMutation(
                    'funds.midGroupsAddGroup',
                    { group, mids: [] },
                    `Group "${group}" added`,
                  );
                }}
              >
                <Text style={styles.btnText}>Add</Text>
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
  content: { padding: spacing(4), paddingBottom: spacing(10), gap: spacing(2) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: spacing(2) },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(2),
  },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.foreground, fontWeight: '700', fontSize: 18, marginTop: 2 },
  toolbar: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  section: {
    color: colors.foreground,
    fontWeight: '700',
    fontSize: 15,
    marginTop: spacing(2),
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(2),
  },
  waCard: { borderColor: 'rgba(245,179,1,0.45)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,179,1,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  cardTitle: { color: colors.foreground, fontWeight: '700', fontSize: 15 },
  cardMeta: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing(2), alignItems: 'center' },
  flex: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  btnText: { color: colors.primaryForeground, fontWeight: '700' },
  cancelBtn: { paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  cancelText: { color: colors.muted, fontWeight: '600' },
  midRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  midText: { color: colors.foreground, flex: 1, marginRight: 8 },
  danger: { color: colors.destructive, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.destructive },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(4),
    gap: spacing(2),
  },
});
