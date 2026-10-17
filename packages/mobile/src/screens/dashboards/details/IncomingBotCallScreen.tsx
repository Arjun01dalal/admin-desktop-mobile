/**
 * Incoming Bot Call — mobile port of desktop IncomingBotCallPage / Laxmi.
 * List from backend `incomingBot.getAllExotel` (single API). Optional
 * `incomingBot.sync` pulls Exotel into DB.
 * Comments require `doc_id` → `incomingBot.addComment` only.
 * Summary still hits helper.callingbot.live process-call.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { useDeferredTimeout } from '../../../hooks/useDeferredTimeout';
import {
  buildIncomingBotSyncPayload,
  canViewIncomingBotCall,
  shouldHideIncomingBotPlayRecording,
  extractIncomingBotCallUsers,
  formatIncomingBotCommentAuthor,
  formatIncomingBotCommentWhen,
  formatIncomingBotSyncToast,
  getIncomingBotCallMobile,
  incomingBotDefaultDateInputValue,
  mapIncomingBotUsersToCalls,
  mergeIncomingBotCallsPreservingComments,
  mergeIncomingBotCommentOntoCalls,
  normalizeIncomingBotEmpCode,
  parseIncomingBotSyncStats,
  type IncomingBotCallerComment,
  type IncomingBotCallRow,
} from '@astro/shared';
import { colors, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import {
  getRoleId,
  getSessionUser,
  hasPermission,
  isCallerRole,
} from '../../../auth/permissions';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { RecordingPlayerModal } from '../../../components/RecordingPlayerModal';
import { SkyTalkEmbed } from '../../../components/SkyTalkEmbed';
import { DateField } from '../../../components/DateField';
import {
  processIncomingCall,
  type CallAnalysis,
  type CallSummaryData,
} from '../../../api/incomingBot';
import { styles } from './IncomingBotCallScreen.styles';
import { display } from '../../../utils/display';

type IncomingCall = IncomingBotCallRow;

function formatDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatDurationInMin(duration: string | number | undefined): string {
  const seconds = Number(duration);
  if (duration === undefined || duration === '' || Number.isNaN(seconds)) return '—';
  return `${(seconds / 60).toFixed(2)} min`;
}

function statusColor(status?: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'completed' || s === 'answered') return '#16a34a';
  if (s === 'busy' || s === 'no-answer' || s === 'no_answer') return '#d97706';
  if (s === 'failed' || s === 'canceled' || s === 'cancelled') return '#dc2626';
  if (s === 'in-progress' || s === 'ringing' || s === 'queued') return colors.primary;
  return colors.muted;
}

function buildSummaryRows(summaryData: CallSummaryData | null) {
  const raw = summaryData?.data?.analysis ?? summaryData?.data;
  if (!raw || typeof raw !== 'object') return [];

  const data = raw as CallAnalysis;
  const threat = data.threat;
  const priority = data.priority;
  const humanIntervention = data.human_intervention;
  const satisfaction = data.satisfaction;
  const frustration = data.frustration;
  const nuisance = data.nuisance;
  const repeatedComplaint = data.repeated_complaint;
  const piiDetails = data.pii_details;

  return [
    { title: 'Summary', value: data.summary, reason: '-' },
    { title: 'Transcript', value: summaryData?.data?.transcript || data.transcript, reason: '-' },
    { title: 'Priority', value: priority?.level, reason: priority?.reason },
    { title: 'Threat', value: threat?.flag, reason: threat?.reason || 'N/A' },
    {
      title: 'Human Intervention',
      value: humanIntervention?.required,
      reason: humanIntervention?.reason,
    },
    { title: 'Frustration', value: frustration?.level, reason: frustration?.reason },
    { title: 'Satisfaction', value: satisfaction?.value, reason: satisfaction?.reason || 'N/A' },
    { title: 'Nuisance', value: nuisance?.value, reason: nuisance?.reason },
    {
      title: 'Repeated Complaint',
      value: repeatedComplaint?.value,
      reason: repeatedComplaint?.reason,
    },
    { title: 'PII Details', value: piiDetails?.detected, reason: piiDetails?.types?.join(', ') },
    { title: 'Next Best Action', value: data.next_best_action, reason: '' },
  ];
}

/** Keep end ≥ start (admin-panel-domains Incoming Bot parity; no month-23 floor). */
function clampEndToStart(value: string, start: string): string {
  if (value && start && value < start) return start;
  return value;
}

export function IncomingBotCallScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const isFocused = useIsFocused();
  const { defer } = useDeferredTimeout();
  const canShowMobile = hasPermission('show_mobile');
  const canShowSkyTalk = hasPermission('show_skyTalk');
  const admin = useMemo(() => getSessionUser(), []);
  const loginEmpCode = useMemo(
    () => normalizeIncomingBotEmpCode(admin?.empCode),
    [admin?.empCode],
  );
  const loginRoleId = useMemo(() => getRoleId(admin), [admin]);
  const loginUserId = useMemo(() => String(admin?._id || '').trim(), [admin?._id]);
  const isCaller = useMemo(() => isCallerRole(admin), [admin]);
  const hidePlayRecording = useMemo(
    () =>
      shouldHideIncomingBotPlayRecording({
        isCaller,
        roleId: loginRoleId,
        userId: loginUserId,
      }),
    [isCaller, loginRoleId, loginUserId],
  );
  const [startDate, setStartDate] = useState(() => incomingBotDefaultDateInputValue());
  const [endDate, setEndDate] = useState(() => incomingBotDefaultDateInputValue());
  const [draftStart, setDraftStart] = useState(() => incomingBotDefaultDateInputValue());
  const [draftEnd, setDraftEnd] = useState(() => incomingBotDefaultDateInputValue());
  const [showSkyTalk, setShowSkyTalk] = useState(false);
  const [skyTalkRemountToken, setSkyTalkRemountToken] = useState(0);
  const skyTalkMounted = showSkyTalk && canShowSkyTalk && isFocused;

  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchSid, setSearchSid] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedSid, setAppliedSid] = useState('');

  const [rows, setRows] = useState<IncomingCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<IncomingCall | null>(null);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<CallSummaryData | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentDocId, setCommentDocId] = useState('');
  const [commentCallSid, setCommentCallSid] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewComments, setViewComments] = useState<IncomingBotCallerComment[]>([]);
  const [viewTitle, setViewTitle] = useState('');

  const genRef = useRef(0);
  const summaryGenRef = useRef(0);

  /** Dismiss RowDetailSheet before presenting another Modal (iOS nested-modal bug). */
  const openAfterSheetClose = useCallback(
    (open: () => void) => {
      setSheetRow(null);
      defer(open);
    },
    [defer],
  );

  const load = useCallback(
    async (override?: { startDate: string; endDate: string }) => {
      const rangeStart = override?.startDate ?? startDate;
      const rangeEnd = override?.endDate ?? endDate;
      const gen = ++genRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await secureApi('incomingBot.getAllExotel', {
          pageNo: 1,
          itemsPerPage: 500,
          startDate: rangeStart,
          endDate: rangeEnd,
          filter: {},
        });
        if (gen !== genRef.current) return;
        if (!res.ok) {
          setError(res.message || 'Failed to fetch incoming calls');
          setRows([]);
          return;
        }
        const users = extractIncomingBotCallUsers(res.data);
        const mapped = mapIncomingBotUsersToCalls(users);
        setSheetRow(null);
        setRows((prev) => mergeIncomingBotCallsPreservingComments(mapped, prev));
      } catch (err) {
        if (gen !== genRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch incoming calls');
        setRows([]);
      } finally {
        if (gen === genRef.current) setLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    void load();
    // Initial load only — date changes fetch via Apply
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncData = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await secureApi(
        'incomingBot.sync',
        buildIncomingBotSyncPayload(startDate, endDate),
      );
      if (!res.ok) {
        Alert.alert('Sync', res.message || 'Failed to sync data');
        return;
      }
      Alert.alert('Sync', formatIncomingBotSyncToast(parseIncomingBotSyncStats(res.data)));
      await load();
    } finally {
      setSyncing(false);
    }
  }, [syncing, startDate, endDate, load]);

  const applyFilters = useCallback(() => {
    const nextStart = draftStart.trim() || incomingBotDefaultDateInputValue();
    const nextEnd = clampEndToStart(
      draftEnd.trim() || nextStart,
      nextStart,
    );
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setAppliedFrom(searchFrom.trim());
    setAppliedTo(searchTo.trim());
    setAppliedSid(searchSid.trim());
    void load({ startDate: nextStart, endDate: nextEnd });
  }, [draftStart, draftEnd, searchFrom, searchTo, searchSid, load]);

  const filteredRows = useMemo(() => {
    const fromQ = appliedFrom.toLowerCase();
    const toQ = appliedTo.toLowerCase();
    const sidQ = appliedSid.toLowerCase();
    return rows.filter((call) => {
      if (
        !canViewIncomingBotCall(call.empCode, {
          loginEmpCode,
          roleId: loginRoleId,
          userId: loginUserId,
        })
      ) {
        return false;
      }
      if (
        fromQ &&
        !String(call.from || '')
          .toLowerCase()
          .includes(fromQ)
      )
        return false;
      if (
        toQ &&
        !String(call.to || '')
          .toLowerCase()
          .includes(toQ)
      )
        return false;
      if (
        sidQ &&
        !String(call.sid || '')
          .toLowerCase()
          .includes(sidQ)
      )
        return false;
      return true;
    });
  }, [rows, appliedFrom, appliedTo, appliedSid, loginEmpCode, loginRoleId, loginUserId]);

  const fetchSummary = useCallback(async (call: IncomingCall) => {
    const gen = ++summaryGenRef.current;
    const callSid = String(call.sid || '');
    setSummaryOpen(true);
    setSummaryData(null);
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(callSid)) {
        setSummaryError('Invalid call SID');
        return;
      }
      const { response: resp, data } = await processIncomingCall(callSid);
      if (gen !== summaryGenRef.current) return;
      if (!resp.ok || data?.status === 'failed') {
        setSummaryError(data?.message || 'Analysis is in progress.');
        return;
      }
      setSummaryData(data || null);
    } finally {
      if (gen === summaryGenRef.current) setSummaryLoading(false);
    }
  }, []);

  const openSummary = useCallback(
    (call: IncomingCall) => {
      openAfterSheetClose(() => {
        void fetchSummary(call);
      });
    },
    [openAfterSheetClose, fetchSummary],
  );

  const closeSummary = useCallback(() => {
    summaryGenRef.current += 1;
    setSummaryOpen(false);
    setSummaryLoading(false);
    setSummaryError(null);
    setSummaryData(null);
  }, []);

  const summaryRows = useMemo(() => buildSummaryRows(summaryData), [summaryData]);

  const playRecording = useCallback(
    (url?: string | null) => {
      if (!url) {
        Alert.alert('No recording available');
        return;
      }
      openAfterSheetClose(() => setRecordingUrl(String(url)));
    },
    [openAfterSheetClose],
  );

  const openUserReport = useCallback(
    (row: IncomingCall) => {
      const userId = String(row.dp_id || '').trim();
      if (!userId) {
        Alert.alert('User Report', 'DP ID is not available for this call.');
        return;
      }
      setSheetRow(null);
      openPanelTarget(navigation, {
        href: '/user-report',
        state: {
          userId,
          userName: String(row.name || userId),
        },
      });
    },
    [navigation],
  );

  const openAddComment = useCallback(
    (call: IncomingCall) => {
      const docId = String(call.doc_id || '').trim();
      if (!docId) {
        Alert.alert('Comment', 'Unable to add comment for this call');
        return;
      }
      const open = () => {
        setCommentDocId(docId);
        setCommentCallSid(String(call.sid || '').trim());
        setCommentInput('');
        setCommentOpen(true);
      };
      if (sheetRow) openAfterSheetClose(open);
      else open();
    },
    [openAfterSheetClose, sheetRow],
  );

  const submitComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text) {
      Alert.alert('Comment', 'Please enter a comment');
      return;
    }
    if (!commentDocId) {
      Alert.alert('Comment', 'Unable to add comment for this call');
      return;
    }

    const newComment: IncomingBotCallerComment = {
      comment: text,
      who: { userId: String(admin?._id || ''), userName: String(admin?.name || '') },
      date: new Date().toISOString(),
    };

    setCommentBusy(true);
    try {
      const res = await secureApi('incomingBot.addComment', {
        _id: commentDocId,
        comment: text,
      });
      if (!res.ok) {
        Alert.alert('Comment', res.message || 'Failed to add comment');
        return;
      }

      const patchOpts = {
        sid: commentCallSid,
        docId: commentDocId,
        comment: newComment,
      };

      setRows((prev) => mergeIncomingBotCommentOntoCalls(prev, patchOpts));
      setSheetRow((prev) =>
        prev ? mergeIncomingBotCommentOntoCalls([prev], patchOpts)[0] ?? prev : prev,
      );
      setCommentOpen(false);
      setCommentInput('');
      setCommentDocId('');
      setCommentCallSid('');
      Alert.alert('Comment', 'Comment added successfully');
    } finally {
      setCommentBusy(false);
    }
  }, [admin?._id, admin?.name, commentInput, commentDocId, commentCallSid]);

  const openViewComments = useCallback(
    (call: IncomingCall) => {
      const run = () => {
        setViewTitle(String(call.name || call.dp_id || call.sid || ''));
        setViewComments(call.comments || []);
        setViewOpen(true);
      };
      if (sheetRow) openAfterSheetClose(run);
      else run();
    },
    [openAfterSheetClose, sheetRow],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    const mobile = getIncomingBotCallMobile(sheetRow);
    const fromValue =
      sheetRow.dp_id && !canShowMobile ? '**********' : display(mobile || sheetRow.from);
    return [
      { label: 'From', value: fromValue },
      { label: 'Name', value: display(sheetRow.name) },
      { label: 'State', value: display(sheetRow.state) },
      { label: 'City', value: display(sheetRow.city) },
      { label: 'DP ID', value: display(sheetRow.dp_id) },
      { label: 'App Name', value: display(sheetRow.app_name) },
      { label: 'To', value: display(sheetRow.to) },
      { label: 'SID', value: display(sheetRow.sid), multiline: true },
      { label: 'Type', value: display(sheetRow.direction) },
      { label: 'Status', value: display(sheetRow.status) },
      { label: 'Duration (min)', value: formatDurationInMin(sheetRow.duration) },
      { label: 'Start Time', value: formatDateTime(sheetRow.start_time) },
      ...(hidePlayRecording
        ? []
        : [{ label: 'Recording', value: sheetRow.recording_url ? 'Available' : '—' }]),
    ];
  }, [sheetRow, canShowMobile, hidePlayRecording]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const row = sheetRow;
    const actions: SheetAction[] = [
      {
        label: 'Add Comment',
        tone: 'default',
        onPress: () => openAddComment(row),
      },
      {
        label: (() => {
          const count = row.comments?.length || 0;
          return count > 0 ? `View All Comments (${count})` : 'View All Comments';
        })(),
        tone: 'default',
        onPress: () => openViewComments(row),
      },
    ];
    if (row.dp_id) {
      actions.push({
        label: 'User Report',
        tone: 'primary',
        onPress: () => openUserReport(row),
      });
    }
    if (!hidePlayRecording && row.recording_url) {
      actions.push({
        label: 'Play Recording',
        tone: 'default',
        onPress: () => playRecording(row.recording_url),
      });
    }
    // Callers get transcript via summary; no audio play.
    actions.push({
      label: hidePlayRecording ? 'View Transcript' : 'View Summary',
      tone: 'primary',
      onPress: () => void openSummary(row),
    });
    return actions;
  }, [
    sheetRow,
    openAddComment,
    openViewComments,
    playRecording,
    openSummary,
    openUserReport,
    hidePlayRecording,
  ]);

  const keyExtractor = useCallback(
    (row: IncomingBotCallRow, index: number) =>
      `row-${index}-${String(row.sid || row.doc_id || '')}`,
    [],
  );

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<IncomingBotCallRow>) => (
      <IncomingBotCallCard
        row={row}
        index={index}
        canShowMobile={canShowMobile}
        hidePlayRecording={hidePlayRecording}
        onPress={() => setSheetRow(row)}
        onComment={() => openAddComment(row)}
        onViewComments={() => openViewComments(row)}
      />
    ),
    [canShowMobile, hidePlayRecording, openAddComment, openViewComments],
  );

  if (showSkyTalk && canShowSkyTalk) {
    return (
      <View style={styles.skyTalkRoot}>
        <View style={styles.skyTalkHeader}>
          <Text style={styles.title}>Sky Talk</Text>
          <TouchableOpacity
            style={styles.skyTalkToggleBtn}
            onPress={() => setShowSkyTalk(false)}
          >
            <Text style={styles.skyTalkToggleText}>Incoming Bot</Text>
          </TouchableOpacity>
        </View>
        <SkyTalkEmbed
          active={skyTalkMounted}
          remountToken={skyTalkRemountToken}
          style={styles.skyTalkFrame}
          webViewStyle={styles.skyTalkWebview}
          pausedContent={null}
        />
      </View>
    );
  }

  const listHeader = (
    <>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Incoming Bot Call</Text>
        {canShowSkyTalk ? (
          <TouchableOpacity
            style={styles.skyTalkToggleBtn}
            onPress={() => {
              setSkyTalkRemountToken(Date.now());
              setShowSkyTalk(true);
            }}
          >
            <Text style={styles.skyTalkToggleText}>Sky Talk</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterWrap}>
        <View style={styles.dateRow}>
          <View style={[styles.field, styles.dateField]}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <DateField
              style={styles.input}
              value={draftStart}
              onChange={(v) => {
                const next = v || draftStart;
                setDraftStart(next);
                if (draftEnd && next && draftEnd < next) setDraftEnd(next);
              }}
            />
          </View>
          <View style={[styles.field, styles.dateField]}>
            <Text style={styles.fieldLabel}>End Date</Text>
            <DateField
              style={styles.input}
              value={draftEnd}
              onChange={(v) => setDraftEnd(clampEndToStart(v, draftStart))}
            />
          </View>
        </View>
        <View style={styles.searchGrid}>
          <TextInput
            style={[styles.input, styles.searchCell]}
            value={searchFrom}
            onChangeText={setSearchFrom}
            placeholder="From"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.searchCell]}
            value={searchTo}
            onChangeText={setSearchTo}
            placeholder="To"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.searchCell]}
            value={searchSid}
            onChangeText={setSearchSid}
            placeholder="SID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.filterActions}>
          <TouchableOpacity
            style={[styles.applyBtn, styles.filterActionBtn, loading && styles.btnDisabled]}
            onPress={applyFilters}
            disabled={loading}
          >
            <Text style={styles.applyText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.syncBtn, styles.filterActionBtn, (syncing || loading) && styles.btnDisabled]}
            onPress={() => void handleSyncData()}
            disabled={syncing || loading}
          >
            <Text style={styles.syncText}>{syncing ? 'Syncing…' : 'Sync data'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sub}>
        {startDate}
        {endDate !== startDate ? ` → ${endDate}` : ''} · {filteredRows.length.toLocaleString('en-IN')}{' '}
        calls · Tap card for recording & summary
      </Text>
    </>
  );

  return (
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={filteredRows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        loading={loading}
        emptyMessage="No incoming calls found"
        refreshing={loading}
        onRefresh={() => void load()}
        refreshEnabled={!summaryOpen && !commentOpen && !viewOpen}
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.from) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal visible={summaryOpen} transparent animationType="slide" onRequestClose={closeSummary}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={closeSummary}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.summarySheet}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Call Summary</Text>
              <TouchableOpacity
                onPress={closeSummary}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing(6) }}
            >
              {summaryLoading ? (
                <Text style={styles.summaryEmpty}>Loading…</Text>
              ) : summaryError ? (
                <Text style={styles.summaryError}>{summaryError}</Text>
              ) : summaryData ? (
                summaryRows.map((item, si) => (
                  <View key={`sum-${si}-${item.title}`} style={styles.summaryCard}>
                    <Text style={styles.summaryAttr}>{item.title}</Text>
                    <Text style={styles.summaryValue}>{display(item.value)}</Text>
                    {item.reason && item.reason !== '-' ? (
                      <Text style={styles.summaryReason}>{display(item.reason)}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.summaryEmpty}>No summary data available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <RecordingPlayerModal
        visible={recordingUrl !== null}
        url={recordingUrl}
        onClose={() => setRecordingUrl(null)}
      />

      <Modal
        visible={commentOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !commentBusy && setCommentOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <TextInput
              style={styles.commentInput}
              value={commentInput}
              onChangeText={setCommentInput}
              placeholder="Please enter Comment"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              editable={!commentBusy}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnOutline}
                disabled={commentBusy}
                onPress={() => setCommentOpen(false)}
              >
                <Text style={styles.modalBtnOutlineText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, commentBusy && styles.btnDisabled]}
                disabled={commentBusy || !commentInput.trim()}
                onPress={() => void submitComment()}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {commentBusy ? '…' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={viewOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setViewOpen(false)}
      >
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => setViewOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.summarySheet}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>
                Comments{viewTitle ? ` — ${viewTitle}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setViewOpen(false)}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing(6) }}
            >
              {viewComments.length === 0 ? (
                <Text style={styles.summaryEmpty}>No Comments</Text>
              ) : (
                viewComments.map((c, i) => {
                  const who = formatIncomingBotCommentAuthor(c);
                  const when = formatIncomingBotCommentWhen(c);
                  return (
                    <View key={`vc-${i}`} style={styles.summaryCard}>
                      <Text style={styles.summaryValue}>{display(c.comment)}</Text>
                      <Text style={styles.summaryReason}>
                        By: {who}
                        {when ? ` · ${when}` : ''}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type IncomingBotCallCardProps = {
  row: IncomingBotCallRow;
  index: number;
  canShowMobile: boolean;
  hidePlayRecording: boolean;
  onPress: () => void;
  onComment: () => void;
  onViewComments: () => void;
};

const IncomingBotCallCard = memo(function IncomingBotCallCard({
  row,
  index,
  canShowMobile,
  hidePlayRecording,
  onPress,
  onComment,
  onViewComments,
}: IncomingBotCallCardProps) {
  const badge = statusColor(row.status);
  const mobile = getIncomingBotCallMobile(row);
  const fromLabel = row.dp_id && !canShowMobile ? '**********' : display(mobile || row.from);
  const hasComment = (row.comments?.length || 0) > 0;
  return (
    <TouchableOpacity
      style={[styles.card, hasComment ? styles.cardHasComment : styles.cardNoComment]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {display(row.name) !== '—' ? display(row.name) : fromLabel}
        </Text>
        <Text
          style={[styles.statusPill, { color: badge, backgroundColor: `${badge}22` }]}
          numberOfLines={1}
        >
          {display(row.status)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          From: {fromLabel}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          App: {display(row.app_name)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          {display(row.state)} · {display(row.city)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          DP: {display(row.dp_id)}
        </Text>
      </View>
      <View style={styles.cardSplitRow}>
        <Text style={styles.cardSplitLeft} numberOfLines={1}>
          {formatDateTime(row.start_time)}
        </Text>
        <Text style={styles.cardSplitRight} numberOfLines={1}>
          {hidePlayRecording
            ? 'Transcript'
            : row.recording_url
              ? '🎙 Recording'
              : 'No recording'}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.commentBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onComment();
          }}
        >
          <Text style={styles.commentBtnText}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.commentBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            onViewComments();
          }}
        >
          <Text style={styles.commentBtnText}>
            View All{(row.comments?.length || 0) > 0 ? ` (${row.comments?.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

