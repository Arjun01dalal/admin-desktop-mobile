/**
 * Push Notifications — mobile port of desktop PushNotificationsPage /
 * laxminarayan admin PushNotifications.tsx.
 *
 * List + filter + create/edit + pause/resume/cancel/send-now/restart.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  asPaged,
  emptyPushCampaignForm,
  formatPushCampaignIst,
  fromIstInputValue,
  pushCampaignIntervalLabel,
  toIstInputValue,
  unpackUploadImagePath,
  type PushCampaign,
  type PushCampaignForm,
  type PushCampaignStatus,
} from '@astro/shared';
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { PAGE_SIZE_OPTIONS } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type ConfirmAction = 'pause' | 'resume' | 'cancel' | 'send-now' | 'restart';

const STATUS_OPTIONS = ['All', 'Active', 'Paused', 'Completed', 'Cancelled'] as const;

const ACTION_TO_SECURE: Record<ConfirmAction, string> = {
  pause: 'ops.pushCampaignPause',
  resume: 'ops.pushCampaignResume',
  cancel: 'ops.pushCampaignCancel',
  'send-now': 'ops.pushCampaignSendNow',
  restart: 'ops.pushCampaignRestart',
};

const ACTION_SUCCESS: Record<ConfirmAction, string> = {
  pause: 'Push notification paused',
  resume: 'Push notification resumed',
  cancel: 'Push notification cancelled',
  'send-now': 'Notification sent to all subscribed users',
  restart: 'Push notification started again',
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function statusColors(status: PushCampaignStatus): { color: string; backgroundColor: string } {
  if (status === 'active') return { color: '#0f5132', backgroundColor: '#d1e7dd' };
  if (status === 'paused') return { color: '#664d03', backgroundColor: '#fff3cd' };
  if (status === 'cancelled') return { color: '#842029', backgroundColor: '#f8d7da' };
  return { color: '#495057', backgroundColor: '#e9ecef' };
}

function confirmMessage(action: ConfirmAction): string {
  if (action === 'send-now') {
    return 'Send this notification to every device subscribed to all_app_topic_rn now?';
  }
  if (action === 'cancel') {
    return 'Cancel this push notification? It cannot be resumed later.';
  }
  if (action === 'pause') {
    return 'Pause this push notification? Scheduled sends will stop until you resume it.';
  }
  if (action === 'restart') {
    return 'Start this completed push notification again?';
  }
  return 'Resume this push notification?';
}

export function PushNotificationsScreen() {
  const [titleDraft, setTitleDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<string>('All');
  const [appliedTitle, setAppliedTitle] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PushCampaign[]>([]);
  const [sheetRow, setSheetRow] = useState<PushCampaign | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<PushCampaignForm>(emptyPushCampaignForm());
  const [imagePreview, setImagePreview] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemsPerPage: pageSize,
      };
      if (appliedTitle.trim()) payload.title = appliedTitle.trim();
      if (appliedStatus && appliedStatus !== 'All') {
        payload.status = appliedStatus.toLowerCase();
      }
      const res = await secureApi<unknown>('ops.pushCampaignList', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load push notifications');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<PushCampaign>(res.data);
      setSheetRow(null);
      setRows(paged.rows);
      setTotal(paged.total);
      setTotalPages(Math.max(1, paged.totalPages));
      if (page > paged.totalPages && paged.totalPages > 0) {
        setPage(paged.totalPages);
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, appliedTitle, appliedStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = useCallback(() => {
    setAppliedTitle(titleDraft);
    setAppliedStatus(statusDraft);
    setPage(1);
  }, [titleDraft, statusDraft]);

  const clearFilters = useCallback(() => {
    setTitleDraft('');
    setStatusDraft('All');
    setAppliedTitle('');
    setAppliedStatus('All');
    setPage(1);
  }, []);

  const updateField = useCallback((key: keyof PushCampaignForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openCreate = useCallback(() => {
    setEditingId('');
    setForm(emptyPushCampaignForm());
    setImagePreview('');
    setImageBase64('');
    setImageFileName('');
    setRemoveImage(false);
    setFormMsg('');
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((item: PushCampaign) => {
    setEditingId(item._id);
    setForm({
      title: item.title || '',
      body: item.body || '',
      startAt: toIstInputValue(item.startAt),
      endAt: toIstInputValue(item.endAt),
      sendOnce: Boolean(item.sendOnce),
      repeat: Boolean(item.intervalValue && item.intervalUnit),
      intervalValue: String(item.intervalValue || 1),
      intervalUnit: item.intervalUnit || 'hours',
    });
    setImagePreview(item.imageUrl || '');
    setImageBase64('');
    setImageFileName('');
    setRemoveImage(false);
    setFormMsg('');
    setFormOpen(true);
  }, []);

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setFormMsg('Could not read the selected image');
      return;
    }
    if (asset.fileSize && asset.fileSize > 1024 * 1024) {
      setFormMsg('Image must be 1 MB or smaller');
      return;
    }
    const mime = asset.mimeType || 'image/jpeg';
    const name =
      asset.fileName || `push_${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`;
    setImageFileName(name);
    setImageBase64(`data:${mime};base64,${asset.base64}`);
    setImagePreview(`data:${mime};base64,${asset.base64}`);
    setRemoveImage(false);
    setFormMsg('');
  }, []);

  const clearSelectedImage = useCallback(() => {
    setImageBase64('');
    setImageFileName('');
    setImagePreview('');
    setRemoveImage(true);
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!form.title.trim()) return 'Enter title';
    if (!form.body.trim()) return 'Enter message';
    if (form.body.trim().length > 500) return 'Message cannot exceed 500 characters';
    if (form.sendOnce) return null;
    if (!form.startAt) return 'Enter start time';
    if (!form.endAt) return 'Enter end time';
    if (form.endAt <= form.startAt) return 'End time must be after start time';
    if (form.endAt <= toIstInputValue(new Date().toISOString())) {
      return 'End time must be in the future';
    }
    return null;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const err = validateForm();
    if (err) {
      setFormMsg(err);
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      body: form.body.trim(),
      sendOnce: form.sendOnce,
    };
    if (form.sendOnce) {
      if (editingId) {
        payload.intervalValue = null;
        payload.intervalUnit = null;
      }
    } else {
      payload.startAt = fromIstInputValue(form.startAt);
      payload.endAt = fromIstInputValue(form.endAt);
      if (form.repeat) {
        payload.intervalValue = Number(form.intervalValue) || 1;
        payload.intervalUnit = form.intervalUnit;
      } else if (editingId) {
        payload.intervalValue = null;
        payload.intervalUnit = null;
      }
    }
    if (editingId) payload._id = editingId;

    setSubmitting(true);
    setFormMsg('');
    try {
      if (imageBase64 && imageFileName) {
        const upload = await secureApi<unknown>('ops.bannersUploadImageEncrypted', {
          File_Name: `push-notifications/${Date.now()}-${imageFileName}`,
          Image: imageBase64,
        });
        if (!upload.ok) {
          setFormMsg(upload.message || 'Image upload failed');
          return;
        }
        const imagePath = unpackUploadImagePath(upload.data);
        if (!imagePath) {
          setFormMsg('Image upload failed');
          return;
        }
        payload.imageUrl = imagePath;
      } else if (editingId && removeImage) {
        payload.imageUrl = '';
      }

      const res = await secureApi<unknown>(
        editingId ? 'ops.pushCampaignUpdate' : 'ops.pushCampaignCreate',
        payload,
      );
      if (!res.ok) {
        setFormMsg(res.message || 'Request failed');
        return;
      }
      Alert.alert(
        'Success',
        form.sendOnce
          ? 'Push notification sent'
          : editingId
            ? 'Push notification updated'
            : 'Push notification created',
      );
      setFormOpen(false);
      setSheetRow(null);
      if (!editingId && page !== 1) setPage(1);
      else void load();
    } finally {
      setSubmitting(false);
    }
  }, [
    validateForm,
    form,
    editingId,
    imageBase64,
    imageFileName,
    removeImage,
    page,
    load,
  ]);

  const runAction = useCallback(
    (id: string, action: ConfirmAction) => {
      Alert.alert('Confirm', confirmMessage(action), [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: action === 'cancel' ? 'destructive' : 'default',
          onPress: () => {
            void (async () => {
              setSubmitting(true);
              try {
                const res = await secureApi<unknown>(ACTION_TO_SECURE[action], { _id: id });
                if (!res.ok) {
                  Alert.alert(res.message || 'Request failed');
                  return;
                }
                Alert.alert('Success', ACTION_SUCCESS[action]);
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

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return [
      { label: 'Title', value: display(sheetRow.title) },
      { label: 'Message', value: display(sheetRow.body), multiline: true },
      { label: 'Start (IST)', value: formatPushCampaignIst(sheetRow.startAt) },
      { label: 'End (IST)', value: formatPushCampaignIst(sheetRow.endAt) },
      { label: 'Repeat', value: pushCampaignIntervalLabel(sheetRow) },
      { label: 'Status', value: display(sheetRow.status) },
      { label: 'Last sent', value: formatPushCampaignIst(sheetRow.lastSentAt) },
      { label: 'Count', value: String(sheetRow.sendCount || 0) },
      { label: 'Created by', value: display(sheetRow.createdByName) },
    ];
  }, [sheetRow]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const row = sheetRow;
    const actions: SheetAction[] = [];
    if (row.status === 'active' || row.status === 'paused' || row.status === 'completed') {
      actions.push({
        label: 'Edit',
        tone: 'default',
        onPress: () => openEdit(row),
      });
    }
    if (row.status === 'completed') {
      actions.push({
        label: 'Start',
        tone: 'primary',
        onPress: () => runAction(row._id, 'restart'),
      });
    }
    if (row.status === 'active') {
      actions.push({
        label: 'Pause',
        tone: 'default',
        onPress: () => runAction(row._id, 'pause'),
      });
    }
    if (row.status === 'paused') {
      actions.push({
        label: 'Resume',
        tone: 'primary',
        onPress: () => runAction(row._id, 'resume'),
      });
    }
    if (row.status === 'active' || row.status === 'paused') {
      actions.push({
        label: 'Send now',
        tone: 'primary',
        onPress: () => runAction(row._id, 'send-now'),
      });
      actions.push({
        label: 'Cancel',
        tone: 'warning',
        onPress: () => runAction(row._id, 'cancel'),
      });
    }
    return actions;
  }, [sheetRow, openEdit, runAction]);

  return (
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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Push Notifications</Text>
          <Text style={styles.sub}>
            Topic all_app_topic_rn (IST) · Total: {total.toLocaleString('en-IN')}
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBox}>
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          style={styles.input}
          value={titleDraft}
          onChangeText={setTitleDraft}
          placeholder="Search by title"
          placeholderTextColor={colors.muted}
          onSubmitEditing={applyFilters}
          returnKeyType="search"
        />
        <Text style={styles.fieldLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, statusDraft === opt && styles.chipActive]}
              onPress={() => setStatusDraft(opt)}
            >
              <Text style={[styles.chipText, statusDraft === opt && styles.chipTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.fieldLabel}>Per page</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, pageSize === opt && styles.chipActive]}
              onPress={() => {
                setPageSize(opt);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, pageSize === opt && styles.chipTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.filterActions}>
          <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={clearFilters}>
            <Text style={styles.formBtnGhostText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formBtn, styles.formBtnPrimary, loading && styles.btnDisabled]}
            onPress={applyFilters}
            disabled={loading}
          >
            <Text style={styles.formBtnPrimaryText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No push notifications yet</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const pill = statusColors(row.status);
          return (
            <TouchableOpacity
              key={`row-${index}-${row._id}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.title)}
                </Text>
                <Text style={[styles.statusPill, pill]}>{row.status}</Text>
              </View>
              {row.imageUrl ? (
                <Image source={{ uri: row.imageUrl }} style={styles.thumb} />
              ) : null}
              <Text style={styles.cardBody} numberOfLines={2}>
                {display(row.body)}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {pushCampaignIntervalLabel(row)} · Sent {row.sendCount || 0}x
              </Text>
              <Text style={styles.cardHint}>Tap for details & actions</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.title) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal
        visible={formOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setFormOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => !submitting && setFormOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <ScrollView
            style={styles.formSheet}
            contentContainerStyle={styles.formSheetContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.formTitle}>
              {editingId ? 'Edit Push Notification' : 'Create Push Notification'}
            </Text>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => updateField('title', v)}
              placeholder="Title"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Message ({form.body.length}/500)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.body}
              onChangeText={(v) => updateField('body', v)}
              placeholder="Message"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Image (optional, max 1 MB)</Text>
            <View style={styles.imageRow}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={() => void pickImage()}>
                <Text style={styles.formBtnGhostText}>Choose image</Text>
              </TouchableOpacity>
              {imagePreview ? (
                <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={clearSelectedImage}>
                  <Text style={styles.formBtnGhostText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {imagePreview ? (
              <Image source={{ uri: imagePreview }} style={styles.preview} />
            ) : null}

            <TouchableOpacity
              style={styles.radioRow}
              onPress={() =>
                setForm((prev) => ({ ...prev, sendOnce: true, repeat: false }))
              }
            >
              <Text style={styles.radioMark}>{form.sendOnce ? '●' : '○'}</Text>
              <Text style={styles.radioLabel}>Send once now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.radioRow}
              onPress={() => updateField('sendOnce', false)}
            >
              <Text style={styles.radioMark}>{!form.sendOnce ? '●' : '○'}</Text>
              <Text style={styles.radioLabel}>Schedule</Text>
            </TouchableOpacity>

            {!form.sendOnce ? (
              <>
                <Text style={styles.fieldLabel}>Start time (IST)</Text>
                <TextInput
                  style={styles.input}
                  value={form.startAt}
                  onChangeText={(v) => updateField('startAt', v)}
                  placeholder="YYYY-MM-DDTHH:mm"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
                <Text style={styles.fieldLabel}>End time (IST)</Text>
                <TextInput
                  style={styles.input}
                  value={form.endAt}
                  onChangeText={(v) => updateField('endAt', v)}
                  placeholder="YYYY-MM-DDTHH:mm"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => updateField('repeat', !form.repeat)}
                >
                  <Text style={styles.radioMark}>{form.repeat ? '☑' : '☐'}</Text>
                  <Text style={styles.radioLabel}>Repeat on an interval</Text>
                </TouchableOpacity>
                {form.repeat ? (
                  <View style={styles.intervalRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={form.intervalValue}
                      onChangeText={(v) => updateField('intervalValue', v)}
                      keyboardType="number-pad"
                      placeholder="Every"
                      placeholderTextColor={colors.muted}
                    />
                    <TouchableOpacity
                      style={[styles.chip, form.intervalUnit === 'hours' && styles.chipActive]}
                      onPress={() => updateField('intervalUnit', 'hours')}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.intervalUnit === 'hours' && styles.chipTextActive,
                        ]}
                      >
                        Hours
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chip, form.intervalUnit === 'days' && styles.chipActive]}
                      onPress={() => updateField('intervalUnit', 'days')}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          form.intervalUnit === 'days' && styles.chipTextActive,
                        ]}
                      >
                        Days
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : null}

            {formMsg ? <Text style={styles.formMsg}>{formMsg}</Text> : null}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setFormOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.formBtnGhostText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, submitting && styles.btnDisabled]}
                onPress={() => void handleSubmit()}
                disabled={submitting}
              >
                <Text style={styles.formBtnPrimaryText}>
                  {submitting
                    ? 'Saving…'
                    : form.sendOnce && !editingId
                      ? 'Send'
                      : editingId
                        ? 'Update'
                        : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {rows.length > 0 ? (
        <View style={styles.pager}>
          <Text
            style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
            onPress={() => page > 1 && setPage((p) => p - 1)}
          >
            ‹ Prev
          </Text>
          <Text style={styles.pagerLabel}>
            Page {page} / {totalPages}
          </Text>
          <Text
            style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
            onPress={() => page < totalPages && setPage((p) => p + 1)}
          >
            Next ›
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = makeStyles({
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  filterBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  filterActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  chipRow: { marginTop: spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    marginRight: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(37,99,235,0.12)' },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(1),
  },
  cardIndex: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  cardTitle: { color: colors.foreground, fontSize: 15, fontWeight: '700', flex: 1 },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    marginBottom: spacing(1.5),
    backgroundColor: colors.surfaceAlt,
  },
  cardBody: { color: colors.foreground, fontSize: 13, marginBottom: spacing(1) },
  cardMeta: { color: colors.muted, fontSize: 11 },
  cardHint: { color: colors.muted, fontSize: 11, marginTop: spacing(1.5) },
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
  multiline: { minHeight: 96 },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '88%',
  },
  formSheetContent: { padding: spacing(4), paddingBottom: spacing(8) },
  formTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  imageRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(1) },
  preview: {
    width: 96,
    height: 96,
    borderRadius: radius.md,
    marginTop: spacing(2),
    backgroundColor: colors.surfaceAlt,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  radioMark: { color: colors.primary, fontSize: 16, width: 20 },
  radioLabel: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
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
  formMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  btnDisabled: { opacity: 0.5 },
});
