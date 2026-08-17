/**
 * Roles & Responsibilities — mobile port of desktop RolesResponsibilitiesPage.
 * roles.list + responsibilities.list load the data; roles.clone (add role),
 * responsibilities.add (add responsibility), roles.update (edit a role's name +
 * responsibilities) and roles.delete are the mutations. All mutations are gated
 * by the same permissions as desktop (View / Edit / Delete / Add).
 *
 * The roles table shows Name + a responsibilities-count subset; row tap opens
 * the detail sheet listing the full responsibility names plus Edit / Delete
 * actions. Add Role / Add Responsibility / Edit use bottom-sheet forms; Edit
 * groups responsibilities by Group with checkboxes (matching desktop).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { asList } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../../auth/permissions';
import { CoinPermissionScreen } from './CoinPermissionScreen';

type Responsibility = { _id: string; Enum?: string; Name?: string; Group?: string };
type Role = { _id: string; Name?: string; Responsibilities?: string[] };

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function RolesResponsibilitiesScreen() {
  const user = useMemo(() => getSessionUser(), []);
  const canView = hasPermission(Permissions.View_Roles_and_Responsibilities, user);
  const canEdit = hasPermission(Permissions.Edit_Role, user);
  const canDelete = hasPermission(Permissions.Delete_Role, user);
  const canAdd = hasPermission(Permissions.add_new_role_responsibility, user);
  // Web panel gates the Coin Permission button on this dedicated responsibility.
  const canCoinPerm = hasPermission('Add_Coin_Permission', user);

  const [roles, setRoles] = useState<Role[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Full-page drill-down instead of a modal: view a role, or edit it.
  const [pageRole, setPageRole] = useState<Role | null>(null);
  const [pageMode, setPageMode] = useState<'view' | 'edit' | null>(null);
  const [coinPermOpen, setCoinPermOpen] = useState(false);

  // Add Role (clone) form
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneRefId, setCloneRefId] = useState('');

  // Add Responsibility form
  const [respOpen, setRespOpen] = useState(false);
  const [respName, setRespName] = useState('');
  const [respGroup, setRespGroup] = useState('');
  const [respRoleName, setRespRoleName] = useState('');
  const [respMobile, setRespMobile] = useState('');

  // Edit Role form (rendered as its own page)
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editRespIds, setEditRespIds] = useState<string[]>([]);

  const respById = useMemo(() => {
    const map = new Map<string, Responsibility>();
    for (const r of responsibilities) map.set(r._id, r);
    return map;
  }, [responsibilities]);

  const groups = useMemo(() => {
    const names = [...new Set(responsibilities.map((r) => r.Group || 'Other'))];
    return names.sort((a, b) => a.localeCompare(b));
  }, [responsibilities]);

  const responsibilityNames = useCallback(
    (ids: string[] | undefined) =>
      (ids || [])
        .map((id) => respById.get(id)?.Name)
        .filter(Boolean)
        .join(', '),
    [respById],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, respRes] = await Promise.all([
        secureApi<unknown>('roles.list', {}),
        secureApi<unknown>('responsibilities.list', {}),
      ]);
      if (!rolesRes.ok) {
        setError(rolesRes.message || 'Failed to load roles');
        setRoles([]);
      } else {
        setRoles(asList<Role>(rolesRes.data));
      }
      if (!respRes.ok) {
        setError((prev) => prev || respRes.message || 'Failed to load responsibilities');
        setResponsibilities([]);
      } else {
        setResponsibilities(asList<Responsibility>(respRes.data));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const handleClone = useCallback(async () => {
    if (!cloneName.trim()) {
      Alert.alert('Enter role name');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { Name: cloneName.trim() };
      if (cloneRefId) payload.Reference_Role_ID = cloneRefId;
      const res = await secureApi<unknown>('roles.clone', payload);
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to create role');
        return;
      }
      setCloneOpen(false);
      setCloneName('');
      setCloneRefId('');
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [cloneName, cloneRefId, load]);

  const handleAddResponsibility = useCallback(async () => {
    if (!respName.trim()) {
      Alert.alert('Name should not be empty');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { Name: respName.trim() };
      if (respGroup.trim()) payload.Group = respGroup.trim();
      if (respRoleName.trim()) payload.Role_Name = respRoleName.trim();
      if (respMobile.trim()) payload.SubAdmin_Mobile = respMobile.trim();
      const res = await secureApi<unknown>('responsibilities.add', payload);
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to add responsibility');
        return;
      }
      setRespOpen(false);
      setRespName('');
      setRespGroup('');
      setRespRoleName('');
      setRespMobile('');
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [respName, respGroup, respRoleName, respMobile, load]);

  const openEdit = useCallback((role: Role) => {
    setEditId(role._id);
    setEditName(role.Name || '');
    setEditRespIds([...(role.Responsibilities || [])]);
    setPageRole(role);
    setPageMode('edit');
  }, []);

  const toggleResp = useCallback((id: string, checked: boolean) => {
    setEditRespIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      return prev.filter((x) => x !== id);
    });
  }, []);

  const handleUpdate = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert('Please enter name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi<unknown>('roles.update', {
        _id: editId,
        Name: editName.trim(),
        Responsibilities: editRespIds,
      });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to update role');
        return;
      }
      setPageMode(null);
      setPageRole(null);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [editId, editName, editRespIds, load]);

  const handleDelete = useCallback(
    (role: Role) => {
      Alert.alert('Are you sure?', 'Do you want to delete this role?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSubmitting(true);
              try {
                const res = await secureApi<unknown>('roles.delete', { Role_ID: role._id });
                if (!res.ok) {
                  setError(res.message || 'Failed to delete role');
                  setPageRole(null);
                  setPageMode(null);
                  return;
                }
                setPageRole(null);
                setPageMode(null);
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

  if (!canView) {
    return (
      <View style={styles.noPerm}>
        <Text style={styles.noPermText}>You do not have permission to view this page.</Text>
      </View>
    );
  }

  // ---------- Coin Permission page ----------
  if (coinPermOpen) {
    return <CoinPermissionScreen onBack={() => setCoinPermOpen(false)} />;
  }

  // ---------- Edit Role page ----------
  if (pageMode === 'edit' && pageRole) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => setPageMode('view')}>
            <Text style={styles.backLink}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Role</Text>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={editName}
            onChangeText={setEditName}
            placeholder="Name"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.sectionLabel}>Responsibilities</Text>
          {groups.map((group) => (
            <View key={group} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>{group}</Text>
              {responsibilities
                .filter((r) => (r.Group || 'Other') === group)
                .map((r) => {
                  const checked = editRespIds.includes(r._id);
                  return (
                    <TouchableOpacity
                      key={r._id}
                      style={styles.checkRow}
                      onPress={() => toggleResp(r._id, !checked)}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                        {checked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                      </View>
                      <Text style={styles.checkLabel}>{r.Name || r._id}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))}
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnGhost]}
              onPress={() => setPageMode('view')}
              disabled={submitting}
            >
              <Text style={styles.formBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formBtn, styles.formBtnPrimary, submitting && styles.btnDisabled]}
              onPress={() => void handleUpdate()}
              disabled={submitting}
            >
              <Text style={styles.formBtnPrimaryText}>{submitting ? 'Saving…' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ---------- View Role page ----------
  if (pageMode === 'view' && pageRole) {
    const role = roles.find((r) => r._id === pageRole._id) || pageRole;
    const names = (role.Responsibilities || [])
      .map((id) => respById.get(id)?.Name)
      .filter(Boolean) as string[];
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => {
              setPageMode(null);
              setPageRole(null);
            }}
          >
            <Text style={styles.backLink}>‹ Back to Roles</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{display(role.Name)}</Text>
          <Text style={styles.subCount}>{names.length} responsibilities</Text>

          <View style={styles.formActions}>
            {canEdit ? (
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary]}
                onPress={() => openEdit(role)}
              >
                <Text style={styles.formBtnPrimaryText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            {canDelete ? (
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnDanger]}
                onPress={() => handleDelete(role)}
              >
                <Text style={styles.formBtnPrimaryText}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>Responsibilities</Text>
          {names.length === 0 ? (
            <Text style={styles.noPermText}>No responsibilities assigned.</Text>
          ) : (
            names.map((n, i) => (
              <View key={`${n}-${i}`} style={styles.respItem}>
                <Text style={styles.respItemText}>• {n}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
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
        <Text style={styles.title}>Roles & Responsibilities</Text>
      </View>

      {canAdd || canCoinPerm ? (
        <View style={styles.actionsRow}>
          {canCoinPerm ? (
            <TouchableOpacity style={styles.headBtn} onPress={() => setCoinPermOpen(true)}>
              <Text style={styles.headBtnText}>Coin Permission</Text>
            </TouchableOpacity>
          ) : null}
          {canAdd ? (
            <>
              <TouchableOpacity
                style={styles.headBtn}
                onPress={() => {
                  setCloneName('');
                  setCloneRefId('');
                  setCloneOpen(true);
                }}
              >
                <Text style={styles.headBtnText}>＋ Add Role</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headBtn}
                onPress={() => {
                  setRespName('');
                  setRespGroup('');
                  setRespOpen(true);
                }}
              >
                <Text style={styles.headBtnText}>＋ Add Responsibility</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && roles.length === 0 ? <Text style={styles.noPermText}>Loading…</Text> : null}
      {!loading && roles.length === 0 ? <Text style={styles.noPermText}>No roles found</Text> : null}
      {roles.map((role, i) => {
        const count = role.Responsibilities?.length || 0;
        return (
          <TouchableOpacity
            key={`row-${i}-${String(role._id ?? '')}`}
            style={styles.roleCard}
            activeOpacity={0.7}
            onPress={() => {
              setPageRole(role);
              setPageMode('view');
            }}
          >
            <View style={styles.roleCardTop}>
              <Text style={styles.roleCardName} numberOfLines={1}>
                {display(role.Name)}
              </Text>
              <View style={styles.roleCountPill}>
                <Text style={styles.roleCountText}>{count}</Text>
              </View>
            </View>
            <Text style={styles.roleCardSub} numberOfLines={2}>
              {responsibilityNames(role.Responsibilities) || 'No responsibilities assigned'}
            </Text>
            <Text style={styles.roleCardHint}>Tap for details & actions</Text>
          </TouchableOpacity>
        );
      })}

      {/* Add Role (clone) */}
      <Modal visible={cloneOpen} transparent animationType="slide" onRequestClose={() => setCloneOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => !submitting && setCloneOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Add Role</Text>
            <Text style={styles.fieldLabel}>Role Name</Text>
            <TextInput
              style={styles.input}
              value={cloneName}
              onChangeText={setCloneName}
              placeholder="Role Name"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Reference Role (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.chip, cloneRefId === '' && styles.chipActive]}
                onPress={() => setCloneRefId('')}
              >
                <Text style={[styles.chipText, cloneRefId === '' && styles.chipTextActive]}>Empty Role</Text>
              </TouchableOpacity>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role._id}
                  style={[styles.chip, cloneRefId === role._id && styles.chipActive]}
                  onPress={() => setCloneRefId(role._id)}
                >
                  <Text style={[styles.chipText, cloneRefId === role._id && styles.chipTextActive]}>
                    {role.Name || role._id}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setCloneOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, submitting && styles.btnDisabled]}
                onPress={() => void handleClone()}
                disabled={submitting}
              >
                <Text style={styles.formBtnPrimaryText}>{submitting ? 'Creating…' : 'Create Role'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Responsibility */}
      <Modal visible={respOpen} transparent animationType="slide" onRequestClose={() => setRespOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => !submitting && setRespOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Add Responsibility</Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={respName}
              onChangeText={setRespName}
              placeholder="Name"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Group (optional)</Text>
            <TextInput
              style={styles.input}
              value={respGroup}
              onChangeText={setRespGroup}
              placeholder="Group"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Role Name (optional)</Text>
            <TextInput
              style={styles.input}
              value={respRoleName}
              onChangeText={setRespRoleName}
              placeholder="Role Name"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Mobile Number (optional)</Text>
            <TextInput
              style={styles.input}
              value={respMobile}
              onChangeText={setRespMobile}
              placeholder="Mobile Number"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setRespOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, submitting && styles.btnDisabled]}
                onPress={() => void handleAddResponsibility()}
                disabled={submitting}
              >
                <Text style={styles.formBtnPrimaryText}>{submitting ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  noPerm: { flex: 1, backgroundColor: 'transparent', padding: spacing(4) },
  noPermText: { color: colors.muted, fontSize: 14 },
  headerRow: { marginBottom: spacing(3) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  backLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: spacing(2) },
  subCount: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  respItem: { paddingVertical: spacing(1.5) },
  respItemText: { color: colors.foreground, fontSize: 13 },
  formBtnDanger: { backgroundColor: colors.destructive },
  actionsRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3), flexWrap: 'wrap' },
  headBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  headBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  roleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  roleCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roleCardName: { color: colors.foreground, fontSize: 15, fontWeight: '700', flex: 1, marginRight: spacing(2) },
  roleCountPill: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(0.75),
  },
  roleCountText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  roleCardSub: { color: colors.muted, fontSize: 12, marginTop: spacing(1.5) },
  roleCardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1.5), fontStyle: 'italic' },
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
  editSheet: { maxHeight: '85%' },
  formTitle: { color: colors.foreground, fontSize: 17, fontWeight: '700', marginBottom: spacing(2) },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: spacing(2) },
  sectionLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
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
  chipsRow: { flexDirection: 'row', gap: spacing(2), paddingVertical: spacing(1) },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  respScroll: { maxHeight: 320, marginTop: spacing(1) },
  groupBlock: { marginBottom: spacing(2) },
  groupLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: spacing(1) },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), paddingVertical: spacing(1.5) },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.primaryForeground, fontSize: 13, fontWeight: '700' },
  checkLabel: { color: colors.foreground, fontSize: 13, flex: 1 },
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
