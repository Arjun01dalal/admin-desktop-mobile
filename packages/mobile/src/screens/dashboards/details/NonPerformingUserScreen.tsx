/**
 * Non Performing User — port of desktop NonPerformingUserPage.
 * ops.nonPerformingUser { pageNo, itemPerPage, startDate?, endDate?, filter } (filter always
 * present, dates only when both applied). Row tap opens a detail modal with all columns.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useNavigation } from '@react-navigation/native';
import { appCodeForName, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { floorNum } from '../../../dashboards/mergeMetrics';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime } from '../../../utils/dates';
import {
  DetailFilterBar,
  type SearchFieldKey,
  type SearchFieldOption,
} from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  name?: string;
  clientName?: string;
  email?: string;
  mobile?: string;
  balance?: number | string;
  totalAmount?: number | string;
  state?: string;
  city?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  createdOn?: string;
  updatedOn?: string;
  nonPerformingComments?: CommentItem[];
  comments?: CommentItem[];
  [key: string]: unknown;
};

type CommentItem = {
  comment?: string;
  who?: { userId?: string; userName?: string };
  userName?: string;
  commented_by?: string;
  date?: string;
  createdOn?: string;
  createdAt?: string;
  [key: string]: unknown;
};

/** Desktop tolerant comment lookup (nonPerformingComments | comments | …). */
function commentsOf(row: Row | null): CommentItem[] {
  if (!row) return [];
  const c =
    row.nonPerformingComments ||
    (row as Record<string, unknown>).nonPerformingComment ||
    (row as Record<string, unknown>).newRegistrationComments ||
    row.comments ||
    [];
  return Array.isArray(c) ? (c as CommentItem[]) : [];
}

const PAGE_SIZE = 25;

const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'dpId', label: 'Dp ID' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'balance', label: 'Balance' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === null || value === undefined || value === '') return '—';
  return canShow ? String(value) : '**********';
}

function formatTs(ts?: string): string {
  if (!ts) return '—';
  return `${formatDisplayDate(ts)} ${formatDisplayTime(ts)}`;
}

export function NonPerformingUserScreen() {
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const canShowMobile = hasPermission('show_mobile');

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigation.navigate('/user-report', {
        userId: String(userId),
        userName: String(userName || ''),
      });
    },
    [navigation],
  );

  // Desktop starts with no date restriction; dates apply only when both are entered.
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appClientName, setAppClientName] = useState('');
  const [searchField, setSearchField] = useState<SearchFieldKey>('name');
  const [searchDraft, setSearchDraft] = useState('');
  const [appliedSearch, setAppliedSearch] = useState<{ field: SearchFieldKey; text: string }>({
    field: 'name',
    text: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  // Comments modal (desktop Add Comment + View Comments dialogs).
  const [commentsRow, setCommentsRow] = useState<Row | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [commentMsg, setCommentMsg] = useState('');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      // Desktop buildFilter: name, _id (dpId), mobile, numeric balance, state, city, clientName.
      const filter: Record<string, unknown> = {};
      const text = appliedSearch.text.trim();
      if (text) {
        if (appliedSearch.field === 'dpId') filter._id = text;
        else if (appliedSearch.field === 'balance') {
          if (!Number.isNaN(Number(text))) filter.balance = Number(text);
        } else filter[appliedSearch.field] = text;
      }
      if (appClientName) filter.clientName = appClientName;
      const res = await secureApi<unknown>('ops.nonPerformingUser', {
        pageNo: page,
        itemPerPage: PAGE_SIZE,
        ...(startDate && endDate ? { startDate, endDate } : {}),
        filter,
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load non performing users');
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
  }, [page, startDate, endDate, appliedSearch, appClientName]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitComment = useCallback(async () => {
    const text = commentDraft.trim();
    if (!text || !commentsRow?._id) return;
    setSavingComment(true);
    setCommentMsg('');
    try {
      const res = await secureApi<unknown>('ops.addNonPerformingComment', {
        _id: commentsRow._id,
        comment: text,
        who: { userId: admin?._id, userName: admin?.name },
      });
      if (!res.ok) {
        setCommentMsg(res.message || 'Failed to add comment');
        return;
      }
      const newComment: CommentItem = {
        comment: text,
        who: { userId: String(admin?._id || ''), userName: String(admin?.name || '') },
        date: new Date().toISOString(),
      };
      // Instant UI update (desktop does the same, then refetches).
      const apply = (r: Row) =>
        r._id === commentsRow._id
          ? { ...r, nonPerformingComments: [...commentsOf(r), newComment] }
          : r;
      setRows((prev) => prev.map(apply));
      setCommentsRow((prev) => (prev ? apply(prev) : prev));
      setCommentDraft('');
      setCommentMsg('Comment added successfully');
    } finally {
      setSavingComment(false);
    }
  }, [commentDraft, commentsRow, admin]);

  const openComments = useCallback((row: Row) => {
    setSheetRow(null);
    setCommentsRow(row);
    setCommentDraft('');
    setCommentMsg('');
  }, []);

  const fieldRows = useCallback(
    (r: Row) => [
      { label: 'Dp ID', value: display(r._id) },
      { label: 'App Code', value: appCodeForName(String(r.clientName || '')) },
      { label: 'Email', value: display(r.email) },
      { label: 'Mobile', value: maskMobile(r.mobile, canShowMobile) },
      { label: 'Balance', value: floorNum(r.balance ?? 0).toLocaleString('en-IN') },
      { label: 'Deposit Amount', value: floorNum(r.totalAmount ?? 0).toLocaleString('en-IN') },
      { label: 'State', value: display(r.state) },
      { label: 'City', value: display(r.city) },
      {
        label: 'App Version',
        value: `${display(r.currentAppVersion)} / ${display(r.updatedAppVersion)}`,
      },
      { label: 'Created', value: formatTs(r.createdOn) },
      { label: 'Last Activity', value: formatTs(r.updatedOn) },
    ],
    [canShowMobile],
  );

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const count = commentsOf(sheetRow).length;
    const acts: SheetAction[] = [
      {
        label: count > 0 ? `View Comment (${count})` : 'View Comment',
        tone: 'primary',
        onPress: () => openComments(sheetRow),
      },
    ];
    if (sheetRow._id) {
      acts.push({
        label: 'User Report',
        tone: 'default',
        onPress: () => {
          const id = sheetRow._id;
          const name = sheetRow.name;
          setSheetRow(null);
          openUserReport(id, name);
        },
      });
    }
    return acts;
  }, [sheetRow, openComments, openUserReport]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Non Performing User</Text>
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
        appClientName={appClientName}
        onAppChange={(v) => {
          setAppClientName(v);
          setPage(1);
        }}
        searchFields={SEARCH_FIELDS}
        searchField={searchField}
        onSearchFieldChange={setSearchField}
        searchText={searchDraft}
        onSearchTextChange={setSearchDraft}
        onSearchSubmit={() => {
          setAppliedSearch({ field: searchField, text: searchDraft });
          setPage(1);
        }}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No data available</Text> : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const commentCount = commentsOf(row).length;
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>
                  #{(page - 1) * PAGE_SIZE + index + 1}
                </Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.name)}
                </Text>
                <TouchableOpacity
                  style={styles.viewCommentBtn}
                  onPress={() => openComments(row)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Text style={styles.viewCommentBtnText}>
                    {commentCount > 0 ? `View Comment (${commentCount})` : 'View Comment'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Balance</Text>
                <Text style={styles.cardValue}>
                  {floorNum(row.balance ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Deposit</Text>
                <Text style={styles.cardValue}>
                  {floorNum(row.totalAmount ?? 0).toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>App</Text>
                <Text style={styles.cardValue}>
                  {appCodeForName(String(row.clientName || ''))}
                </Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Mobile</Text>
                <Text style={styles.cardValue}>{maskMobile(row.mobile, canShowMobile)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardLabel}>Last Activity</Text>
                <Text style={styles.cardValue}>{formatTs(row.updatedOn)}</Text>
              </View>
              <Text style={styles.cardHint}>Tap card for full details</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={
          sheetRow
            ? fieldRows(sheetRow).map<SheetField>((f) => ({
                label: f.label,
                value: f.value,
              }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Comments modal (view + add) */}
      <Modal
        visible={commentsRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentsRow(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setCommentsRow(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                Comments{commentsRow?.name ? ` — ${commentsRow.name}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setCommentsRow(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="Write a comment…"
                placeholderTextColor={colors.muted}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.commentBtn,
                  (savingComment || !commentDraft.trim()) && styles.commentBtnDisabled,
                ]}
                disabled={savingComment || !commentDraft.trim()}
                onPress={() => void submitComment()}
              >
                <Text style={styles.commentBtnText}>{savingComment ? 'Saving…' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
            {commentMsg ? <Text style={styles.commentMsg}>{commentMsg}</Text> : null}
            <ScrollView
              style={styles.commentList}
              contentContainerStyle={{ paddingBottom: spacing(8) }}
              showsVerticalScrollIndicator={false}
            >
              {commentsOf(commentsRow).length === 0 ? (
                <Text style={styles.commentEmpty}>No comments yet</Text>
              ) : (
                commentsOf(commentsRow)
                  .slice()
                  .reverse()
                  .map((item, idx) => {
                    const ts = item.date || item.createdOn || item.createdAt;
                    return (
                      <View key={idx} style={styles.commentCard}>
                        <Text style={styles.commentText}>{display(item.comment)}</Text>
                        <View style={styles.commentMeta}>
                          <Text style={styles.commentMetaText}>
                            By: {display(item.who?.userName || item.userName || item.commented_by)}
                          </Text>
                          {ts ? <Text style={styles.commentMetaText}>{formatTs(String(ts))}</Text> : null}
                        </View>
                      </View>
                    );
                  })
              )}
            </ScrollView>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(3), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    gap: spacing(1),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(1.5),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  viewCommentBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    flexShrink: 0,
  },
  viewCommentBtnText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '700',
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    paddingVertical: 2,
  },
  cardLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', width: '40%' },
  cardValue: { color: colors.foreground, fontSize: 12, flex: 1, textAlign: 'right' },
  cardHint: { color: colors.muted, fontSize: 11, marginTop: spacing(1.5) },
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerLabel: { color: colors.muted, fontSize: 13 },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(10),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '100%',
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
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing(3) },
  commentInput: {
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
  commentBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  commentBtnDisabled: { opacity: 0.5 },
  commentBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  commentMsg: { color: colors.muted, fontSize: 12, marginTop: spacing(2) },
  commentList: { marginTop: spacing(3) },
  commentEmpty: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: spacing(4),
  },
  commentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(2),
  },
  commentText: { color: colors.foreground, fontSize: 14 },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing(2),
  },
  commentMetaText: { color: colors.muted, fontSize: 11 },
});
