/**
 * Pending Feedback — port of desktop FeedbackPage.
 * ops.feedbackGetAll { pageNo, itemsPerPage, filter:{ feedBackStatus:'Pending' }, dates when
 * both applied }. Row tap opens a detail modal; Respond (Edit_Feedback) and Delete actions.
 */
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { colors } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { usePagedSecureQuery } from '../../../hooks/usePagedSecureQuery';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import { display } from '../../../utils/display';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { styles } from './FeedbackScreen.styles';

type Row = {
  _id?: string;
  name?: string;
  mobile?: string;
  message?: string;
  feedbackResponse?: string;
  createdOn?: string;
  [key: string]: unknown;
};

type FeedbackUpdateResponse = {
  message?: string;
};

const PAGE_SIZE = 25;

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
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Respond modal.
  const [replyRow, setReplyRow] = useState<Row | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [savingReply, setSavingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState('');

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = {
      pageNo: page,
      itemsPerPage: PAGE_SIZE,
      filter: { feedBackStatus: 'Pending' },
    };
    if (startDate && endDate) {
      payload.startDate = startDate;
      payload.endDate = endDate;
    }
    return payload;
  }, [page, startDate, endDate]);

  const { rows, total, totalPages, loading, error, load, setError } = usePagedSecureQuery<Row>({
    action: 'ops.feedbackGetAll',
    buildPayload,
    autoDeps: [page, startDate, endDate],
    errorMessage: 'Failed to load feedback',
  });

  useEffect(() => {
    setSheetRow(null);
  }, [rows]);

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
    [load, setError],
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

  const keyExtractor = useCallback(
    (row: Row, index: number) => `row-${index}-${String(row._id ?? '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <FeedbackCard row={row} index={index} page={page} onPress={() => setSheetRow(row)} />
    ),
    [page],
  );

  const listHeader = (
    <>
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
    </>
  );

  const listFooter = (
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
  );

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No pending feedback"
        refreshing={loading}
        onRefresh={() => void load()}
        refreshEnabled={replyRow === null}
      />

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
    </View>
  );
}

type FeedbackCardProps = {
  row: Row;
  index: number;
  page: number;
  onPress: () => void;
};

const FeedbackCard = memo(function FeedbackCard({ row, index, page, onPress }: FeedbackCardProps) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onPress}>
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
  );
});
