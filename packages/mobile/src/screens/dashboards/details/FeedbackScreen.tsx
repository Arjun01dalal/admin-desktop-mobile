/**
 * Pending Feedback — port of desktop FeedbackPage.
 * ops.feedbackGetAll { pageNo, itemsPerPage, filter:{ feedBackStatus:'Pending' }, dates when
 * both applied }. Row tap opens a detail modal; Respond (Edit_Feedback) and Delete actions.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { makeStyles } from '../../../styles/common';
import { asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  message?: string;
  feedbackResponse?: string;
  createdOn?: string;
  [key: string]: unknown;
};

type FeedbackResponse =
  | Row[]
  | {
      items?: Row[];
      feedback?: Row[];
      users?: Row[];
      totalPages?: number;
      total?: number;
    };

type FeedbackUpdateResponse = {
  message?: string;
};

const PAGE_SIZE = 25;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function FeedbackScreen() {
  const canShowMobile = hasPermission('show_mobile');
  const canRespond = hasPermission('Edit_Feedback');
  const admin = useMemo(() => getStoredUser<{ _id?: string; name?: string }>(), []);

  // Desktop starts with no date restriction.
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Respond modal.
  const [replyRow, setReplyRow] = useState<Row | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [savingReply, setSavingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemsPerPage: PAGE_SIZE,
        filter: { feedBackStatus: 'Pending' },
      };
      if (startDate && endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }
      const res = await secureApi<FeedbackResponse>('ops.feedbackGetAll', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load feedback');
        setRows([]);
        setTotalPages(1);
        setTotal(0);
        return;
      }
      const parsed = asPaged<Row>(res.data);
      setSheetRow(null);
      setRows(parsed.rows);
      setTotal(parsed.total ?? parsed.rows.length);
      setTotalPages(Math.max(1, parsed.totalPages ?? 1));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReply = useCallback(async () => {
    const text = replyDraft.trim();
    if (!text || !replyRow?._id) return;
    setSavingReply(true);
    setReplyMsg('');
    try {
      const res = await secureApi<FeedbackUpdateResponse>('ops.feedbackUpdate', {
        _id: replyRow._id,
        feedbackResponse: text,
        updatedBy: { name: admin?.name, _id: admin?._id },
      });
      if (!res.ok) {
        setReplyMsg(res.message || 'Failed to send reply');
        return;
      }
      setReplyRow(null);
      setReplyDraft('');
      void load();
    } finally {
      setSavingReply(false);
    }
  }, [replyDraft, replyRow, admin, load]);

  const deleteFeedback = useCallback(
    (row: Row) => {
      Alert.alert('Delete feedback', `Delete feedback from ${row.name || 'this user'}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('ops.feedbackDelete', { id: row._id });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to delete feedback');
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
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String((page - 1) * PAGE_SIZE + i + 1),
      },
      { key: 'id', label: 'ID', width: 150, render: (r) => display(r._id) },
      { key: 'name', label: 'Name', width: 120, render: (r) => display(r.name) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 100,
        render: (r) => (canShowMobile ? display(r.mobile) : r.mobile ? '**********' : '—'),
      },
      { key: 'message', label: 'Message', width: 200, render: (r) => display(r.message) },
      { key: 'reply', label: 'Reply', width: 150, render: (r) => display(r.feedbackResponse) },
      {
        key: 'date',
        label: 'Date',
        width: 150,
        render: (r) =>
          r.createdOn ? `${formatDisplayDate(r.createdOn)} ${formatDisplayTime(r.createdOn)}` : '—',
      },
    ],
    [page, canShowMobile],
  );

  const sheetActions: SheetAction[] = [];
  if (sheetRow) {
    if (canRespond) {
      sheetActions.push({
        label: 'Respond',
        tone: 'primary',
        onPress: () => {
          setReplyRow(sheetRow);
          setReplyDraft(String(sheetRow.feedbackResponse || ''));
          setReplyMsg('');
          setSheetRow(null);
        },
      });
    }
    sheetActions.push({
      label: 'Delete',
      tone: 'warning',
      onPress: () => deleteFeedback(sheetRow),
    });
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Pending Feedback</Text>
      <Text style={styles.sub}>
        {startDate && endDate ? `${startDate} → ${endDate}` : 'All dates'} · Total:{' '}
        {total.toLocaleString('en-IN')}
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
          setPage(1);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No pending feedback</Text> : null}
      <View style={styles.list}>
        {rows.map((row, index) => (
          <TouchableOpacity
            key={`row-${index}-${String(row._id ?? '')}`}
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => setSheetRow(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>#{(page - 1) * PAGE_SIZE + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.name)}
              </Text>
            </View>
            <Text style={styles.cardSplitLeft} numberOfLines={2}>
              Message: {display(row.message)}
            </Text>
            <View style={styles.cardSplitRow}>
              <Text style={styles.cardSplitLeft} numberOfLines={1}>
                Reply: {display(row.feedbackResponse)}
              </Text>
              <Text style={styles.cardSplitRight} numberOfLines={1}>
                {row.createdOn
                  ? `${formatDisplayDate(row.createdOn)} ${formatDisplayTime(row.createdOn)}`
                  : '—'}
              </Text>
            </View>
            <Text style={styles.cardHint}>Tap card for details & actions</Text>
          </TouchableOpacity>
        ))}
      </View>

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
                  multiline: c.key === 'message' || c.key === 'reply',
                }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Respond modal */}
      <Modal
        visible={replyRow !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setReplyRow(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setReplyRow(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                Respond{replyRow?.name ? ` — ${replyRow.name}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setReplyRow(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.replyMessage}>{display(replyRow?.message)}</Text>
            <View style={styles.replyRowWrap}>
              <TextInput
                style={styles.replyInput}
                value={replyDraft}
                onChangeText={setReplyDraft}
                placeholder="Write a reply…"
                placeholderTextColor={colors.muted}
                multiline
              />
              <TouchableOpacity
                style={[styles.replyBtn, (savingReply || !replyDraft.trim()) && styles.btnDisabled]}
                disabled={savingReply || !replyDraft.trim()}
                onPress={() => void submitReply()}
              >
                <Text style={styles.replyBtnText}>{savingReply ? 'Sending…' : 'Send'}</Text>
              </TouchableOpacity>
            </View>
            {replyMsg ? <Text style={styles.replyMsg}>{replyMsg}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
    </ScrollView>
  );
}

const styles = makeStyles({
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '80%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  sheetClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  replyMessage: { color: colors.muted, fontSize: 13, marginTop: spacing(2) },
  replyRowWrap: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing(3) },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginRight: spacing(2),
    maxHeight: 100,
  },
  replyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  replyBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  replyMsg: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
});
