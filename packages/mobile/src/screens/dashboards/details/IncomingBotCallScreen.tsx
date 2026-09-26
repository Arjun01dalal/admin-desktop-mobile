/**
 * Incoming Bot Call — mobile port of desktop IncomingBotCallPage / Laxmi.
 * List from backend `incomingBot.getAllExotel` (single API). Optional
 * `incomingBot.sync` pulls Exotel into DB. Call → dialer (BOT_INC).
 * Comments require `doc_id` → `incomingBot.addComment` only.
 * Summary still hits helper.callingbot.live process-call.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
import { useNavigation } from '@react-navigation/native';
import {
  buildIncomingBotSyncPayload,
  extractIncomingBotCallUsers,
  formatIncomingBotCommentAuthor,
  formatIncomingBotCommentWhen,
  formatIncomingBotSyncToast,
  getIncomingBotCallMobile,
  INCOMING_BOT_DIALER,
  incomingBotDefaultDateInputValue,
  incomingBotMinDateInputValue,
  mapIncomingBotUsersToCalls,
  mergeIncomingBotCallsPreservingComments,
  mergeIncomingBotCommentOntoCalls,
  parseIncomingBotSyncStats,
  type IncomingBotCallerComment,
  type IncomingBotCallRow,
} from '@astro/shared';
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { addToDialerBatch } from '../../../utils/externalDialer';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { RecordingPlayerModal } from '../../../components/RecordingPlayerModal';
import { DateField } from '../../../components/DateField';
import {
  processIncomingCall,
  type CallAnalysis,
  type CallSummaryData,
} from '../../../api/incomingBot';

type IncomingCall = IncomingBotCallRow;

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

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

function clampIncomingBotDate(value: string, minDate: string, floor?: string): string {
  let next = value || minDate;
  if (next < minDate) next = minDate;
  if (floor && next < floor) next = floor;
  return next;
}

export function IncomingBotCallScreen() {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const canShowMobile = hasPermission('show_mobile');
  const admin = useMemo(() => getStoredUser<{ _id?: string; name?: string }>(), []);
  const minDate = useMemo(() => incomingBotMinDateInputValue(), []);
  const [startDate, setStartDate] = useState(() => incomingBotDefaultDateInputValue());
  const [endDate, setEndDate] = useState(() => incomingBotDefaultDateInputValue());
  const [draftStart, setDraftStart] = useState(() => incomingBotDefaultDateInputValue());
  const [draftEnd, setDraftEnd] = useState(() => incomingBotDefaultDateInputValue());

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
  const [dialerBusySid, setDialerBusySid] = useState('');
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
  const openAfterSheetClose = useCallback((open: () => void) => {
    setSheetRow(null);
    setTimeout(open, Platform.OS === 'ios' ? 350 : 80);
  }, []);

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
    const nextStart = clampIncomingBotDate(draftStart.trim(), minDate);
    const nextEnd = clampIncomingBotDate(draftEnd.trim(), minDate, nextStart);
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setAppliedFrom(searchFrom.trim());
    setAppliedTo(searchTo.trim());
    setAppliedSid(searchSid.trim());
    void load({ startDate: nextStart, endDate: nextEnd });
  }, [draftStart, draftEnd, minDate, searchFrom, searchTo, searchSid, load]);

  const filteredRows = useMemo(() => {
    const fromQ = appliedFrom.toLowerCase();
    const toQ = appliedTo.toLowerCase();
    const sidQ = appliedSid.toLowerCase();
    return rows.filter((call) => {
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
  }, [rows, appliedFrom, appliedTo, appliedSid]);

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

  const connectToDialer = useCallback(async (call: IncomingCall) => {
    const phone = getIncomingBotCallMobile(call);
    if (!phone) {
      Alert.alert('Call', 'No phone number for this call');
      return;
    }
    setDialerBusySid(String(call.sid || ''));
    try {
      const res = await addToDialerBatch({
        campaignId: INCOMING_BOT_DIALER.campaignId,
        serverId: INCOMING_BOT_DIALER.serverId,
        listId: INCOMING_BOT_DIALER.listId,
        listName: INCOMING_BOT_DIALER.listName,
        leads: [
          {
            first_name: call.name || '',
            last_name: '',
            phone_number: phone,
            city: call.city ?? '',
            state: call.state ?? '',
            email: call.app_name ?? '',
            comments: call.app_name ?? '',
            province: call.dp_id || '',
          },
        ],
      });
      if (!res.ok) Alert.alert('Dialer', res.message || 'Dialer API failed');
      else Alert.alert('Dialer', res.message || 'Data sent successfully');
    } finally {
      setDialerBusySid('');
    }
  }, []);

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
      { label: 'Recording', value: sheetRow.recording_url ? 'Available' : '—' },
    ];
  }, [sheetRow, canShowMobile]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const row = sheetRow;
    const phone = getIncomingBotCallMobile(row);
    const actions: SheetAction[] = [
      {
        label:
          dialerBusySid === String(row.sid || '')
            ? 'Sending to dialer…'
            : 'Call (send to dialer)',
        tone: 'primary',
        disabled: dialerBusySid === String(row.sid || '') || !phone,
        onPress: () => void connectToDialer(row),
      },
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
    if (row.recording_url) {
      actions.push({
        label: 'Play Recording',
        tone: 'default',
        onPress: () => playRecording(row.recording_url),
      });
    }
    actions.push({ label: 'View Summary', tone: 'primary', onPress: () => void openSummary(row) });
    return actions;
  }, [
    sheetRow,
    dialerBusySid,
    connectToDialer,
    openAddComment,
    openViewComments,
    playRecording,
    openSummary,
    openUserReport,
  ]);

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
      <Text style={styles.title}>Incoming Bot Call</Text>

      <View style={styles.filterWrap}>
        <View style={styles.dateRow}>
          <View style={[styles.field, styles.dateField]}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <DateField
              style={styles.input}
              value={draftStart}
              onChange={(v) => {
                const next = clampIncomingBotDate(v, minDate);
                setDraftStart(next);
                if (draftEnd < next) setDraftEnd(next);
              }}
            />
          </View>
          <View style={[styles.field, styles.dateField]}>
            <Text style={styles.fieldLabel}>End Date</Text>
            <DateField
              style={styles.input}
              value={draftEnd}
              onChange={(v) => setDraftEnd(clampIncomingBotDate(v, minDate, draftStart))}
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

      {loading && filteredRows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && filteredRows.length === 0 ? (
        <Text style={styles.hint}>No incoming calls found</Text>
      ) : null}

      <View style={styles.list}>
        {filteredRows.map((row, index) => {
          const badge = statusColor(row.status);
          const mobile = getIncomingBotCallMobile(row);
          const fromLabel =
            row.dp_id && !canShowMobile ? '**********' : display(mobile || row.from);
          const dialerBusy = dialerBusySid === String(row.sid || '');
          const hasComment = (row.comments?.length || 0) > 0;
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row.sid || row.doc_id || '')}`}
              style={[styles.card, hasComment ? styles.cardHasComment : styles.cardNoComment]}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
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
                  {row.recording_url ? '🎙 Recording' : 'No recording'}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.callBtn, (!mobile || dialerBusy) && styles.btnDisabled]}
                  disabled={!mobile || dialerBusy}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    void connectToDialer(row);
                  }}
                >
                  <Text style={styles.callBtnText}>{dialerBusy ? 'Sending…' : 'Call'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openAddComment(row);
                  }}
                >
                  <Text style={styles.commentBtnText}>Comment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openViewComments(row);
                  }}
                >
                  <Text style={styles.commentBtnText}>
                    View All{(row.comments?.length || 0) > 0 ? ` (${row.comments?.length})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

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
    </ScrollView>
  );
}

const styles = makeStyles({
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', marginBottom: spacing(1) },
  sub: { color: colors.muted, fontSize: 12, marginBottom: spacing(3) },
  filterWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  dateRow: { flexDirection: 'row', gap: spacing(2) },
  dateField: { flex: 1 },
  field: { gap: spacing(1) },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
  },
  searchGrid: { flexDirection: 'row', gap: spacing(2) },
  searchCell: { flex: 1 },
  filterActions: { flexDirection: 'row', gap: spacing(2) },
  filterActionBtn: { flex: 1 },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  syncBtn: {
    backgroundColor: '#1976d2',
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 13, marginBottom: spacing(2) },
  list: { gap: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
  },
  cardNoComment: {
    backgroundColor: 'rgba(255,159,10,0.08)',
    borderColor: 'rgba(255,159,10,0.28)',
  },
  cardHasComment: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.28)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    marginBottom: spacing(1.5),
  },
  cardIndex: { color: colors.muted, fontSize: 11, fontWeight: '700', minWidth: 28 },
  cardTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700', flex: 1, minWidth: 0 },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(2),
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: 110,
    textAlign: 'center',
  },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
    marginBottom: spacing(0.5),
  },
  cardSplitLeft: { color: colors.muted, fontSize: 12, flex: 1, minWidth: 0 },
  cardSplitRight: { color: colors.muted, fontSize: 12, flexShrink: 0, maxWidth: '48%' },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    marginTop: spacing(2),
  },
  callBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  callBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 12 },
  commentBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  commentBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 12 },
  btnDisabled: { opacity: 0.55 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: spacing(5),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(4),
    gap: spacing(3),
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  commentInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    color: colors.foreground,
    backgroundColor: colors.surfaceAlt,
    fontSize: 14,
  },
  modalActions: { flexDirection: 'row', gap: spacing(2) },
  modalBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  modalBtnOutlineText: { color: colors.foreground, fontWeight: '600' },
  modalBtnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  modalBtnPrimaryText: { color: colors.primaryForeground, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdropTouch: { flex: 1 },
  summarySheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    maxHeight: '80%',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  summaryTitle: { color: colors.foreground, fontSize: 17, fontWeight: '700', flex: 1, paddingRight: 8 },
  close: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  summaryCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(2),
    gap: spacing(1),
  },
  summaryAttr: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  summaryValue: { color: colors.foreground, fontSize: 14 },
  summaryReason: { color: colors.muted, fontSize: 12 },
  summaryEmpty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
  summaryError: {
    color: colors.destructive,
    textAlign: 'center',
    marginVertical: spacing(6),
    fontSize: 14,
    paddingHorizontal: spacing(2),
  },
  screen: { flex: 1 },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
});
