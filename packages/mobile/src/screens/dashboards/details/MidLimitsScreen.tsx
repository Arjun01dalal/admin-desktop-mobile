/**
 * MID Limits — mobile port of desktop MidLimitsPage.
 * Loads MIDs from deposits.mids + limits from midLimits.get; edit via midLimits.upsert;
 * alert recipients via midLimits.getRecipients / midLimits.setRecipients.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  applyMidLimitUpsert,
  buildAlertRecipientDisplayList,
  buildRecipientsSavePayload,
  buildSubAdminOptions,
  buildTelegramChatIdsDraftFromConfig,
  collectMidLimitsMap,
  filterMidLimitRows,
  filterSubAdminOptions,
  formatAlertRecipientsSummary,
  formatMidLimitAmount,
  getSubAdminTelegramLabel,
  midLimitGatewayLabel,
  mergeMidLimitRows,
  mergeSavedRecipientSelection,
  parseAlertRecipientsFromLimitsGet,
  parseLimitDraft,
  parseMidOptions,
  parseRecipientsConfig,
  resolveMidLimitRecord,
  type AlertRecipientDisplay,
  type MidLimitRow,
  type RecipientsConfig,
  type RoleGroup,
  type SubAdminOption,
} from '@astro/shared/midLimits';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import {
  canEditMidLimits,
  canViewMidLimits,
  getSessionUser,
} from '../../../auth/permissions';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatUpdatedOn(value: string | undefined): string {
  if (!value) return '—';
  return `${formatDisplayDate(value)} ${formatDisplayTime(value)}`;
}

export function MidLimitsScreen() {
  const user = useMemo(() => getSessionUser(), []);
  const canView = canViewMidLimits(user);
  const canEdit = canEditMidLimits(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<MidLimitRow[]>([]);
  const [search, setSearch] = useState('');
  const [sheetRow, setSheetRow] = useState<MidLimitRow | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<MidLimitRow | null>(null);
  const [limitDraft, setLimitDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientsSaving, setRecipientsSaving] = useState(false);
  const [subAdminOptions, setSubAdminOptions] = useState<SubAdminOption[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedSubAdminIds, setSelectedSubAdminIds] = useState<string[]>([]);
  const [telegramChatIdsDraft, setTelegramChatIdsDraft] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [recipientsMsg, setRecipientsMsg] = useState('');
  const [alertRecipients, setAlertRecipients] = useState<RecipientsConfig | null>(null);
  const [alertRecipientDisplays, setAlertRecipientDisplays] = useState<AlertRecipientDisplay[]>(
    [],
  );

  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const [midRes, limitsRes, subRes] = await Promise.all([
        secureApi('deposits.mids', {}),
        secureApi('midLimits.get', {}),
        secureApi<{ byRole?: RoleGroup[] }>('caller.subadminsByRole', { filter: {} }),
      ]);
      if (gen !== genRef.current) return;

      if (!limitsRes.ok) {
        setError(limitsRes.message || 'Failed to load MID limits');
      }
      if (!midRes.ok) {
        setError((prev) => prev || midRes.message || 'Failed to load MID names');
      }

      const midData = midRes.ok ? midRes.data : [];
      const limitsData = limitsRes.ok ? limitsRes.data : null;
      const subOptions = subRes.ok ? buildSubAdminOptions(subRes.data) : [];
      setSubAdminOptions(subOptions);

      const recipientsConfig = parseAlertRecipientsFromLimitsGet(limitsData);
      setAlertRecipients(recipientsConfig);
      setAlertRecipientDisplays(
        buildAlertRecipientDisplayList(recipientsConfig, subOptions),
      );

      const options = parseMidOptions(midData);
      const limitsMap = await collectMidLimitsMap(
        limitsData,
        options,
        async (mid) => {
          const res = await secureApi('midLimits.get', { mid });
          return res.ok ? res.data : null;
        },
      );

      const merged = mergeMidLimitRows(midData, limitsMap);
      setRows(merged);
      setSheetRow(null);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(
    () => filterMidLimitRows(rows, search),
    [rows, search],
  );

  const openEdit = useCallback((row: MidLimitRow) => {
    setActiveRow(row);
    setLimitDraft(row.limit != null ? String(row.limit) : '');
    setFormMsg('');
    setSheetRow(null);
    setEditOpen(true);
  }, []);

  const loadSubAdminOptions = useCallback(async () => {
    if (subAdminOptions.length) return subAdminOptions;

    const res = await secureApi<{ byRole?: RoleGroup[] }>('caller.subadminsByRole', {
      filter: {},
    });
    if (!res.ok) {
      Alert.alert('Error', res.message || 'Failed to load sub-admins');
      setSubAdminOptions([]);
      return [];
    }
    const list = buildSubAdminOptions(res.data);
    setSubAdminOptions(list);
    return list;
  }, [subAdminOptions]);

  const openRecipientsDialog = useCallback(async () => {
    setRecipientsOpen(true);
    setRecipientsLoading(true);
    setRecipientSearch('');
    setRecipientsMsg('');
    try {
      const [recipientsRes, subAdminList] = await Promise.all([
        secureApi('midLimits.getRecipients', {}),
        loadSubAdminOptions(),
      ]);

      if (!recipientsRes.ok) {
        setRecipientsMsg(recipientsRes.message || 'Failed to load alert recipients');
        setSelectedSubAdminIds([]);
        setTelegramChatIdsDraft('');
        setAlertsEnabled(true);
        return;
      }

      const config = parseRecipientsConfig(recipientsRes.data);
      const selected = mergeSavedRecipientSelection(config, subAdminList);
      setSelectedSubAdminIds(selected);
      setTelegramChatIdsDraft(buildTelegramChatIdsDraftFromConfig(config));
      setAlertsEnabled(config.enabled !== false);
    } finally {
      setRecipientsLoading(false);
    }
  }, [loadSubAdminOptions]);

  const toggleSubAdminId = useCallback((id: string) => {
    setSelectedSubAdminIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const filteredSubAdminOptions = useMemo(
    () => filterSubAdminOptions(subAdminOptions, recipientSearch),
    [recipientSearch, subAdminOptions],
  );

  const handleSaveRecipients = useCallback(async () => {
    const built = buildRecipientsSavePayload(
      selectedSubAdminIds,
      subAdminOptions,
      alertsEnabled,
      telegramChatIdsDraft,
    );
    if (!built.ok) {
      setRecipientsMsg(built.error);
      return;
    }

    setRecipientsSaving(true);
    setRecipientsMsg('');
    try {
      const res = await secureApi('midLimits.setRecipients', built.payload);
      if (!res.ok) {
        setRecipientsMsg(res.message || 'Failed to save alert recipients');
        return;
      }
      Alert.alert('Saved', 'Alert recipients saved');
      setRecipientsOpen(false);
      void load();
    } finally {
      setRecipientsSaving(false);
    }
  }, [alertsEnabled, selectedSubAdminIds, subAdminOptions, telegramChatIdsDraft, load]);

  const handleSaveLimit = useCallback(async () => {
    if (!activeRow) return;
    const limit = parseLimitDraft(limitDraft);
    if (limit == null) {
      setFormMsg('Enter a valid limit (0 or greater)');
      return;
    }

    setSaving(true);
    setFormMsg('');
    try {
      const res = await secureApi('midLimits.upsert', {
        mid: activeRow.mid,
        limit,
        updatedBy: {
          userId: user?._id || '',
          userName: user?.name || '',
        },
      });
      if (!res.ok) {
        setFormMsg(res.message || 'Failed to update MID limit');
        return;
      }

      const getRes = await secureApi('midLimits.get', { mid: activeRow.mid });
      const record = resolveMidLimitRecord(
        getRes.ok ? getRes.data : res.data,
        activeRow.mid,
        limit,
      );
      record.updatedBy = record.updatedBy ?? {
        userId: user?._id || '',
        userName: user?.name || '',
      };

      setRows((prev) => applyMidLimitUpsert(prev, record));
      Alert.alert('Saved', `Limit updated for ${activeRow.mid}`);
      setEditOpen(false);
      setActiveRow(null);
    } finally {
      setSaving(false);
    }
  }, [activeRow, limitDraft, user?._id, user?.name]);

  const sheetFields = useMemo((): SheetField[] => {
    if (!sheetRow) return [];
    return [
      { label: 'MID', value: sheetRow.mid },
      { label: 'Gateway', value: display(midLimitGatewayLabel(sheetRow)) },
      {
        label: 'Limit',
        value: formatMidLimitAmount(sheetRow.limit),
        color: sheetRow.limit != null ? colors.primary : colors.muted,
      },
      { label: 'Updated By', value: display(sheetRow.updatedBy?.userName) },
      { label: 'Updated On', value: formatUpdatedOn(sheetRow.updatedOn) },
    ];
  }, [sheetRow]);

  const sheetActions = useMemo((): SheetAction[] | undefined => {
    if (!sheetRow || !canEdit) return undefined;
    return [
      {
        label: 'Edit limit',
        tone: 'primary',
        onPress: () => openEdit(sheetRow),
      },
    ];
  }, [canEdit, openEdit, sheetRow]);

  if (!canView) {
    return (
      <View style={styles.deniedWrap}>
        <MaterialIcons name="lock-outline" size={40} color={colors.muted} />
        <Text style={styles.deniedTitle}>Access restricted</Text>
        <Text style={styles.deniedText}>
          You do not have permission to view MID Limits.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.overline}>Payin</Text>
        <Text style={styles.title}>MID Limits</Text>
        <Text style={styles.subtitle}>
          View all MIDs and set or update deposit limits.
        </Text>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search MID or gateway"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
          {canEdit ? (
            <TouchableOpacity
              style={styles.alertBtn}
              onPress={() => void openRecipientsDialog()}
              disabled={loading || saving || recipientsLoading}
            >
              <MaterialIcons name="notifications-active" size={16} color="#1a1200" />
              <Text style={styles.alertBtnText}>Alerts</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.alertInfoBox}>
          <View style={styles.alertInfoHeader}>
            <MaterialIcons
              name="notifications-active"
              size={16}
              color={alertRecipients?.enabled === false ? colors.muted : '#ff9f0a'}
            />
            <Text style={styles.alertInfoTitle}>Alert notifications</Text>
            <View
              style={[
                styles.alertStatusChip,
                alertRecipients?.enabled === false && styles.alertStatusChipOff,
              ]}
            >
              <Text
                style={[
                  styles.alertStatusChipText,
                  alertRecipients?.enabled === false && styles.alertStatusChipTextOff,
                ]}
              >
                {alertRecipients?.enabled === false ? 'Disabled' : 'Enabled'}
              </Text>
            </View>
          </View>
          {alertRecipientDisplays.length ? (
            <View style={styles.alertRecipientList}>
              {alertRecipientDisplays.map((item) => (
                <View key={item.key} style={styles.alertRecipientChip}>
                  <Text style={styles.alertRecipientChipText} numberOfLines={2}>
                    {item.detail ? `${item.label} · ${item.detail}` : item.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.alertInfoEmpty}>
              {formatAlertRecipientsSummary(alertRecipients, alertRecipientDisplays)}
            </Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{filteredRows.length}</Text>
            <Text style={styles.statLabel}>MIDs</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>
              {filteredRows.filter((r) => r.limit != null).length}
            </Text>
            <Text style={styles.statLabel}>With limit</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !rows.length ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Loading MID limits…</Text>
          </View>
        ) : filteredRows.length ? (
          <View style={styles.list}>
            {filteredRows.map((row, index) => (
              <TouchableOpacity
                key={row.mid}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => setSheetRow(row)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardMid} numberOfLines={1}>
                      {row.mid}
                    </Text>
                    <Text style={styles.cardGateway} numberOfLines={1}>
                      {display(midLimitGatewayLabel(row))}
                    </Text>
                  </View>
                  <View style={styles.indexBadge}>
                    <Text style={styles.indexBadgeText}>{index + 1}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View style={styles.limitBlock}>
                    <Text style={styles.limitLabel}>Limit</Text>
                    <Text
                      style={[
                        styles.limitValue,
                        row.limit == null && styles.limitUnset,
                      ]}
                    >
                      {formatMidLimitAmount(row.limit)}
                    </Text>
                  </View>
                  {canEdit ? (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEdit(row)}
                    >
                      <MaterialIcons name="edit" size={16} color={colors.primary} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {row.updatedBy?.userName ? (
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    Updated by {row.updatedBy.userName}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="account-balance-wallet" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>No MIDs found</Text>
            <Text style={styles.emptyText}>
              {search.trim() ? 'Try a different search term.' : 'Pull down to refresh.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <RowDetailSheet
        visible={!!sheetRow}
        title={sheetRow?.mid || 'MID'}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => !saving && setEditOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={() => !saving && setEditOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Set MID Limit</Text>
            <Text style={styles.modalHint}>MID: {activeRow?.mid || '—'}</Text>
            <Text style={styles.fieldLabel}>Limit</Text>
            <TextInput
              style={styles.fieldInput}
              value={limitDraft}
              onChangeText={setLimitDraft}
              placeholder="e.g. 500000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              autoFocus
            />
            {formMsg ? <Text style={styles.modalMsg}>{formMsg}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                disabled={saving}
                onPress={() => setEditOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={() => void handleSaveLimit()}
              >
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={recipientsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !recipientsSaving && setRecipientsOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={() => !recipientsSaving && setRecipientsOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalSheet, styles.recipientsSheet]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Alert Recipients</Text>
            <Text style={styles.modalHint}>
              Select sub-admins. Telegram Chat IDs are optional — sent only when entered.
            </Text>

            {recipientsLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading recipients…</Text>
              </View>
            ) : (
              <>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Alerts enabled</Text>
                  <Switch
                    value={alertsEnabled}
                    onValueChange={setAlertsEnabled}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                <Text style={styles.chatIdsLabel}>Telegram Chat IDs (optional)</Text>
                <TextInput
                  style={styles.chatIdsInput}
                  value={telegramChatIdsDraft}
                  onChangeText={setTelegramChatIdsDraft}
                  placeholder="1234567890, 9876543210"
                  placeholderTextColor={colors.muted}
                  keyboardType="numbers-and-punctuation"
                  multiline
                  numberOfLines={2}
                />
                <Text style={styles.chatIdsHint}>
                  Optional comma-separated numeric chat IDs
                </Text>

                <View style={styles.searchWrap}>
                  <MaterialIcons name="search" size={18} color={colors.muted} />
                  <TextInput
                    style={styles.searchInput}
                    value={recipientSearch}
                    onChangeText={setRecipientSearch}
                    placeholder="Search name, emp code, Telegram"
                    placeholderTextColor={colors.muted}
                    autoCapitalize="none"
                  />
                </View>

                <Text style={styles.recipientCount}>
                  Sub-admins ({selectedSubAdminIds.length} selected)
                </Text>

                <ScrollView style={styles.recipientList} keyboardShouldPersistTaps="handled">
                  {filteredSubAdminOptions.length ? (
                    filteredSubAdminOptions.map((sub) => {
                      const id = String(sub._id);
                      const telegramLabel = getSubAdminTelegramLabel(sub);
                      const checked = selectedSubAdminIds.includes(id);
                      return (
                        <TouchableOpacity
                          key={id}
                          style={styles.recipientRow}
                          onPress={() => toggleSubAdminId(id)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              checked && styles.checkboxChecked,
                            ]}
                          >
                            {checked ? (
                              <MaterialIcons name="check" size={14} color="#fff" />
                            ) : null}
                          </View>
                          <View style={styles.recipientInfo}>
                            <Text style={styles.recipientName} numberOfLines={1}>
                              {sub.name || id}
                            </Text>
                            <Text style={styles.recipientMeta} numberOfLines={1}>
                              Profile: {telegramLabel || 'Not set'}
                              {sub.empCode ? ` · Emp: ${sub.empCode}` : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>No sub-admins found</Text>
                  )}
                </ScrollView>

                {recipientsMsg ? (
                  <Text style={styles.modalMsg}>{recipientsMsg}</Text>
                ) : null}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    disabled={recipientsSaving}
                    onPress={() => setRecipientsOpen(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, recipientsSaving && styles.btnDisabled]}
                    disabled={recipientsSaving || recipientsLoading}
                    onPress={() => void handleSaveRecipients()}
                  >
                    <Text style={styles.saveBtnText}>
                      {recipientsSaving ? 'Saving…' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(12) },
  overline: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '800', marginTop: spacing(1) },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: spacing(1), lineHeight: 18 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing(3),
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 14,
    paddingVertical: spacing(2),
  },
  alertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1),
    backgroundColor: '#ff9f0a',
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  alertBtnText: { color: '#1a1200', fontWeight: '700', fontSize: 13 },
  alertInfoBox: {
    marginTop: spacing(3),
    backgroundColor: 'rgba(255,159,10,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.25)',
    borderRadius: radius.lg,
    padding: spacing(3),
  },
  alertInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    flexWrap: 'wrap',
  },
  alertInfoTitle: { color: colors.foreground, fontWeight: '800', fontSize: 13 },
  alertStatusChip: {
    backgroundColor: 'rgba(255,159,10,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  alertStatusChipOff: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertStatusChipText: { color: '#ff9f0a', fontSize: 11, fontWeight: '700' },
  alertStatusChipTextOff: { color: colors.muted },
  alertRecipientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    marginTop: spacing(2),
  },
  alertRecipientChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1),
    maxWidth: '100%',
  },
  alertRecipientChipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  alertInfoEmpty: { color: colors.muted, fontSize: 12, marginTop: spacing(2), lineHeight: 17 },
  statsRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  statValue: { color: colors.foreground, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(8),
    gap: spacing(2),
  },
  loadingText: { color: colors.muted, fontSize: 13 },
  list: { gap: spacing(2.5), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3.5),
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(2) },
  cardMain: { flex: 1, minWidth: 0 },
  cardMid: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  cardGateway: { color: colors.muted, fontSize: 12, marginTop: 2 },
  indexBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm,
    minWidth: 28,
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: spacing(1.5),
  },
  indexBadgeText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
  },
  limitBlock: { flex: 1 },
  limitLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  limitValue: { color: colors.primary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  limitUnset: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(2.5),
  },
  editBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  cardMeta: { color: colors.muted, fontSize: 11, marginTop: spacing(2) },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  emptyTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(2),
  },
  deniedTitle: { color: colors.foreground, fontSize: 18, fontWeight: '700' },
  deniedText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
    paddingTop: spacing(2),
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  recipientsSheet: { maxHeight: '88%' },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing(3),
  },
  modalTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  modalHint: { color: colors.muted, fontSize: 12, marginTop: spacing(1.5), lineHeight: 17 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: spacing(4) },
  fieldInput: {
    marginTop: spacing(1.5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    fontSize: 16,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  modalActions: {
    flexDirection: 'row',
    gap: spacing(2),
    marginTop: spacing(4),
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.foreground, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  saveBtnText: { color: colors.primaryForeground, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(4),
    paddingVertical: spacing(1),
  },
  switchLabel: { color: colors.foreground, fontWeight: '600', fontSize: 14 },
  chatIdsLabel: {
    color: colors.foreground,
    fontWeight: '700',
    fontSize: 13,
    marginTop: spacing(2),
  },
  chatIdsInput: {
    marginTop: spacing(1),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    color: colors.foreground,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(2),
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chatIdsHint: {
    color: colors.muted,
    fontSize: 11,
    marginTop: spacing(1),
    marginBottom: spacing(1),
  },
  recipientCount: {
    color: colors.foreground,
    fontWeight: '700',
    fontSize: 13,
    marginTop: spacing(3),
    marginBottom: spacing(1.5),
  },
  recipientList: {
    maxHeight: 280,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2.5),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  recipientInfo: { flex: 1, minWidth: 0 },
  recipientName: { color: colors.foreground, fontWeight: '700', fontSize: 14 },
  recipientMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
