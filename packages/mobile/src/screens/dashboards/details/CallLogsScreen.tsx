/**
 * Call Logs — port of desktop CallLogsPage (list side).
 * callLogs.getDialerData + callLogs.botStatusSummary with DD/MM/YYYY dates.
 * Filters: date range, per-page, Mobile/DP ID/Call ID/State/Bot ID inputs,
 * status chips and comment chips. Non-callers see the bot status table and
 * can add comments (callLogs.updateCallData) by tapping the Comment cell.
 * Row actions (from the row detail sheet): Bot Call (callLogs.addToBotDialer),
 * End Call (callLogs.updateCallData), Connect Dialer (singleCallToDialer),
 * View Summary (direct POST to the process-call helper, same endpoint the
 * desktop bridge uses) and opening the recording URL. Add to Dialer sends
 * selected rows to a campaign via addToDialerBatch (desktop Dialer Call).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { getStoredUser } from '../../../lib/webShim';
import { openPanelTarget } from '../../../navigation/panelDetail';
import { colors } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { formatDdMmYyyy, todayIST } from '../../../utils/dates';
import { CAMPAIGN_LIST, campaignsForLoginUser } from '../../../utils/campaignList';
import { addToDialerBatch, singleCallToDialer } from '../../../utils/externalDialer';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { RecordingPlayerModal } from '../../../components/RecordingPlayerModal';
import { CallSummaryModal, CommentModal } from './callLogs/CallLogsPanels';
import { BotStatusPanel, type ReinitTarget } from './callLogs/BotStatusPanel';
import {
  DialerControls,
  PageSizePicker,
  SearchFilters,
  type CallLogTextFilter,
} from './callLogs/CallLogsControls';
import { CallLogsList } from './callLogs/CallLogsList';
import { CallLogsPagination } from './callLogs/CallLogsPagination';
import {
  REINIT_CHIPS,
  buildBotSummaryRows,
  callLogRowId,
  filterCallsClientSide,
  formatStatusLabel,
  getAssignedBotIds,
  hasValidBotPhone,
  isCallLogsCaller,
  mapRowToDialSetting,
  maskMobile,
  processCallSummary,
  reinitTargetKey,
  statusColor,
  toDialerLeadSource,
  toMinSec,
  type CallLogRow,
  type CallSummaryData,
  type BotStatusSummaryData,
  type ReinitStatus,
} from './callLogs/helpers';
import { styles } from './CallLogsScreen.styles';

/* --------------------------------- screen --------------------------------- */

export function CallLogsScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation<{
    navigate: (name: string, params?: Record<string, unknown>) => void;
  }>();
  // Read the stored user once — getStoredUser returns a fresh object each call,
  // which would otherwise recreate `load` every render and refetch in a loop.
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const isCaller = isCallLogsCaller(admin);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const assignedBots = useMemo(() => getAssignedBotIds(admin as never), [admin]);
  const campaignOptions = useMemo(
    () => campaignsForLoginUser(admin, { assignedOnly: isCaller }),
    [admin, isCaller],
  );

  const today = todayIST();
  const [draftStart, setDraftStart] = useState(today);
  const [draftEnd, setDraftEnd] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Draft text filters (applied on Search)
  const [mobNo, setMobNo] = useState('');
  const [dpId, setDpId] = useState('');
  const [sid, setSid] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [botIdFilter, setBotIdFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [commentFilter, setCommentFilter] = useState('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [botStatusOpen, setBotStatusOpen] = useState(false);
  const [reinitKeys, setReinitKeys] = useState<Set<string>>(() => new Set());
  const [applyTick, setApplyTick] = useState(0);

  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [botSummary, setBotSummary] = useState<BotStatusSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: CallLogRow; index: number } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [summaryBusyId, setSummaryBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<CallSummaryData | null>(null);

  const [campaignId, setCampaignId] = useState(() =>
    isCaller && campaignOptions.length === 1 ? campaignOptions[0].id.trim() : '',
  );
  const [dialerOpen, setDialerOpen] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [dialerMsg, setDialerMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Comment modal
  const [commentRow, setCommentRow] = useState<CallLogRow | null>(null);
  const [commentChoice, setCommentChoice] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const genRef = React.useRef(0);
  const filterDraftRef = React.useRef({ mobNo, dpId, sid, stateFilter, botIdFilter });
  filterDraftRef.current = { mobNo, dpId, sid, stateFilter, botIdFilter };

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    try {
      const f = filterDraftRef.current;
      const apiStatus =
        selectedStatus === 'All'
          ? ''
          : selectedStatus === 'Not Received'
            ? 'completed'
            : selectedStatus;

      let botId: number[] | null;
      if (assignedBots.length > 0) {
        const chosen = Number(f.botIdFilter);
        botId = f.botIdFilter && assignedBots.includes(chosen) ? [chosen] : assignedBots;
      } else if (!f.botIdFilter) {
        botId = null;
      } else {
        botId = [Number(f.botIdFilter)];
      }

      const dates = {
        startDate: formatDdMmYyyy(startDate),
        endDate: formatDdMmYyyy(endDate),
      };
      const [listRes, sumRes] = await Promise.all([
        secureApi<{ calls?: CallLogRow[]; pagination?: { totalCount?: number } }>(
          'callLogs.getDialerData',
          {
            userId: '',
            filter: {
              mobileNo: f.mobNo || undefined,
              caller_user_id: f.dpId || undefined,
              sid: f.sid || undefined,
              state: f.stateFilter || undefined,
              status: apiStatus,
              ...dates,
              index: page,
              limit: pageSize,
              botId,
              comments: commentFilter === 'All' ? '' : commentFilter,
            },
          },
        ),
        secureApi<BotStatusSummaryData>('callLogs.botStatusSummary', dates),
      ]);
      if (gen !== genRef.current) return; // stale response

      if (!listRes.ok) {
        setError(listRes.message || 'Failed to load call logs');
        setRows([]);
        setTotal(0);
      } else {
        const data = listRes.data || {};
        const raw = data.calls || [];
        const next = filterCallsClientSide(raw, selectedStatus, assignedBots);
        setRows(next);
        setSelectedIds(new Set());
        setTotal(Number(data.pagination?.totalCount ?? next.length));
        setError('');
      }
      if (sumRes.ok && sumRes.data) {
        setBotSummary(sumRes.data);
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, page, pageSize, selectedStatus, commentFilter, assignedBots]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load, applyTick]);

  const applyFilters = useCallback(() => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    if (page !== 1) setPage(1);
    else setApplyTick((t) => t + 1);
  }, [draftStart, draftEnd, page]);

  const clearFilters = useCallback(() => {
    setMobNo('');
    setDpId('');
    setSid('');
    setStateFilter('');
    setBotIdFilter('');
    setSelectedStatus('All');
    setCommentFilter('All');
    if (page !== 1) setPage(1);
    else setApplyTick((t) => t + 1);
  }, [page]);

  const openComment = useCallback((row: CallLogRow) => {
    setCommentChoice('');
    setCommentText('');
    setCommentRow(row);
  }, []);

  const saveComment = useCallback(async () => {
    if (!commentRow) return;
    const value = commentChoice && commentChoice !== 'other' ? commentChoice : commentText.trim();
    if (!value) return;
    setCommentSaving(true);
    try {
      const res = await secureApi('callLogs.updateCallData', {
        call_sid: String(commentRow.call_sid || ''),
        comments: value,
        commented_by: String((admin as { name?: string } | null)?.name || ''),
      });
      if (!res.ok || res.success === false) {
        setError(res.message || 'Failed to save comment');
        return;
      }
      setCommentRow(null);
      void load();
    } finally {
      setCommentSaving(false);
    }
  }, [commentRow, commentChoice, commentText, admin, load]);

  /* ---------- row actions (ported from desktop useCallLogsActions) ---------- */

  const toggleSelect = useCallback((row: CallLogRow) => {
    const id = callLogRowId(row);
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(callLogRowId(r)));

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (rows.length > 0 && rows.every((r) => prev.has(callLogRowId(r)))) return new Set();
      return new Set(rows.map(callLogRowId).filter(Boolean));
    });
  }, [rows]);

  const addToDialer = useCallback(async () => {
    setDialerMsg('');
    if (!campaignId) {
      setDialerMsg('Campaign should not be empty');
      return;
    }
    const chosen = rows.filter((r) => selectedIds.has(callLogRowId(r)));
    if (!chosen.length) {
      setDialerMsg('Select at least one row');
      return;
    }
    const campaign =
      campaignOptions.find((c) => c.id.trim() === campaignId.trim()) ??
      CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId.trim());
    setPushing(true);
    try {
      const res = await addToDialerBatch({
        campaignId,
        serverId: campaign?.serverId ?? (admin as { serverId?: string } | null)?.serverId,
        leads: chosen.map(toDialerLeadSource),
      });
      setDialerMsg(res.message);
      if (res.ok) setSelectedIds(new Set());
    } finally {
      setPushing(false);
    }
  }, [admin, campaignId, campaignOptions, rows, selectedIds]);

  const connectDialer = useCallback(
    async (row: CallLogRow) => {
      setActionLoading(true);
      setActionMsg('');
      try {
        const res = await singleCallToDialer({
          lead: toDialerLeadSource(row),
          extensionId: (admin as { extensionId?: string[] | string } | null)?.extensionId,
          adminName:
            typeof (admin as { name?: string } | null)?.name === 'string'
              ? String((admin as { name?: string }).name)
              : 'ADMIN',
          serverId: (admin as { serverId?: unknown } | null)?.serverId,
        });
        setActionMsg(res.message);
      } finally {
        setActionLoading(false);
      }
    },
    [admin],
  );

  const pushBotRows = useCallback(
    async (target: CallLogRow[], opts?: { keepSheet?: boolean }) => {
      const settings = target
        .map(mapRowToDialSetting)
        .filter((s) => hasValidBotPhone(s.phone_number));
      if (!settings.length) {
        setActionMsg('No valid phone numbers to push');
        Alert.alert('Reinit', 'No valid phone numbers to push');
        return false;
      }
      setActionLoading(true);
      setActionMsg('');
      try {
        const chunkSize = 10;
        let pushed = 0;
        let lastMessage = '';
        for (let i = 0; i < settings.length; i += chunkSize) {
          const chunk = settings.slice(i, i + chunkSize);
          const res = await secureApi('callLogs.addToBotDialer', {
            userId: String((admin as { _id?: string } | null)?._id || ''),
            created_by: String((admin as { name?: string } | null)?.name || ''),
            dialout_settings: chunk,
          });
          if (!res.ok || res.success === false) {
            const msg = res.message || `Failed after pushing ${pushed} of ${settings.length} leads`;
            setActionMsg(msg);
            Alert.alert('Reinit failed', msg);
            return false;
          }
          pushed += chunk.length;
          lastMessage = res.message || '';
        }
        setActionMsg(lastMessage || `Call Initiated Successfully (${pushed} leads).`);
        if (!opts?.keepSheet) setSelected(null);
        void load();
        return true;
      } finally {
        setActionLoading(false);
      }
    },
    [admin, load],
  );

  const reinitiateStatuses = useCallback(
    async (targets: Array<{ botId: number; status: ReinitStatus }>) => {
      if (!targets.length) {
        Alert.alert('Reinit', 'Select at least one No-Answer, Failed, or Deleted status');
        return;
      }
      setActionLoading(true);
      setActionMsg('');
      try {
        const results = await Promise.all(
          targets.map(async ({ botId, status }) => {
            if (status === 'deleted') {
              const res = await secureApi<CallLogRow[]>('callLogs.fetchDeleted', {
                startDate,
                endDate,
                botId,
              });
              return {
                ok: res.ok,
                message: res.message,
                rows: Array.isArray(res.data) ? res.data : [],
              };
            }
            const res = await secureApi<{ calls?: CallLogRow[] }>('callLogs.getDialerData', {
              userId: '',
              filter: {
                status,
                startDate: formatDdMmYyyy(startDate),
                endDate: formatDdMmYyyy(endDate),
                botId: [botId],
                index: 1,
                limit: 5000,
              },
            });
            const raw = Array.isArray(res.data?.calls) ? res.data.calls : [];
            return {
              ok: res.ok,
              message: res.message,
              rows: raw.filter(
                (row) =>
                  String(row.status || '').toLowerCase() === status &&
                  Number(row.bot_id) === Number(botId),
              ),
            };
          }),
        );
        const failed = results.filter((result) => !result.ok);
        if (failed.length) {
          Alert.alert(
            'Reinit',
            failed[0]?.message || `Failed to fetch ${failed.length} selection(s)`,
          );
        }
        const uniqueRows = Array.from(
          new Map(
            results
              .filter((result) => result.ok)
              .flatMap((result) => result.rows)
              .map((row, index) => [
                String(row.call_sid || row._id || `${row.bot_id}:${index}`),
                row,
              ]),
          ).values(),
        );
        if (!uniqueRows.length) {
          Alert.alert('Reinit', 'No calls found to reinitiate');
          return;
        }
        await pushBotRows(uniqueRows, { keepSheet: true });
        setReinitKeys(new Set());
      } finally {
        setActionLoading(false);
      }
    },
    [endDate, pushBotRows, startDate],
  );

  const endCall = useCallback(
    async (row: CallLogRow) => {
      setActionLoading(true);
      setActionMsg('');
      try {
        const res = await secureApi('callLogs.updateCallData', {
          call_sid: String(row.call_sid || ''),
          status: 'no-answer',
          commented_by: String((admin as { name?: string } | null)?.name || ''),
        });
        if (!res.ok || res.success === false) {
          setActionMsg(res.message || 'Failed to end call');
          return;
        }
        setActionMsg('Call ended');
        setSelected(null);
        void load();
      } finally {
        setActionLoading(false);
      }
    },
    [admin, load],
  );

  const openRecording = useCallback((row: CallLogRow) => {
    const rawUrl = String(row.recording_url || '').trim();
    if (!rawUrl) {
      Alert.alert('Recording', 'Recording URL is not available.');
      return;
    }
    setSelected(null);
    setTimeout(() => setRecordingUrl(rawUrl), Platform.OS === 'ios' ? 350 : 80);
  }, []);

  const viewSummary = useCallback(async (row: CallLogRow) => {
    const id = callLogRowId(row);
    setSelected(null);
    setSummaryData(null);
    setSummaryBusyId(id);
    setActionLoading(true);
    setActionMsg('');
    // Let the row-detail native modal finish dismissing before opening another.
    await new Promise((resolve) => setTimeout(resolve, 250));
    setSummaryOpen(true);
    try {
      const res = await processCallSummary(String(row.call_sid || ''));
      if (!res.ok) {
        setActionMsg(res.message || 'Analysis is in progress.');
        return;
      }
      setSummaryData(res.data || null);
    } catch {
      setActionMsg('Could not load call summary.');
    } finally {
      setSummaryBusyId(null);
      setActionLoading(false);
    }
  }, []);

  const openUserReport = useCallback(
    (row: CallLogRow) => {
      const userId = String(row.caller_user_id || '').trim();
      if (!userId) {
        Alert.alert('User Report', 'User ID is not available for this call.');
        return;
      }
      setSelected(null);
      openPanelTarget(navigation, {
        href: '/user-report',
        state: {
          userId,
          userName: String(row.client_name || ''),
        },
      });
    },
    [navigation],
  );

  /** Action buttons for the selected row — mirrors the desktop Action column. */
  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!selected) return [];
    const row = selected.row;
    const status = String(row.status || '');
    const actions: SheetAction[] = [
      {
        label: 'Details',
        tone: 'primary',
        onPress: () => openUserReport(row),
      },
      {
        label: 'Comment',
        onPress: () => {
          openComment(row);
          setSelected(null);
        },
      },
    ];
    if (status !== 'queued' && status !== 'deleted') {
      if (status === 'in-progress') {
        actions.push({
          label: actionLoading ? 'Ending…' : 'End Call',
          tone: 'warning',
          disabled: actionLoading,
          onPress: () => void endCall(row),
        });
      }
      actions.push({
        label: actionLoading ? 'Connecting…' : 'Connect Dialer',
        disabled: actionLoading,
        onPress: () => void connectDialer(row),
      });
    }
    if (status === 'completed' && row.recording_url) {
      const summaryLoading = summaryBusyId === callLogRowId(row);
      actions.push(
        {
          label: summaryLoading ? 'Loading…' : 'View Summary',
          disabled: summaryLoading,
          onPress: () => void viewSummary(row),
        },
        {
          label: 'Play Recording',
          onPress: () => openRecording(row),
        },
      );
    }
    return actions;
  }, [
    selected,
    actionLoading,
    summaryBusyId,
    openUserReport,
    openComment,
    endCall,
    connectDialer,
    openRecording,
    viewSummary,
  ]);

  const rowOffset = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const summaryRows = useMemo(() => buildBotSummaryRows(botSummary), [botSummary]);
  const reinitTargets = useMemo<ReinitTarget[]>(
    () =>
      summaryRows.flatMap((row) =>
        REINIT_CHIPS.filter((chip) => Number(row[chip.rowKey]) > 0).map((chip) => ({
          key: reinitTargetKey(row.botId, chip.status),
          botId: row.botId,
          status: chip.status,
        })),
      ),
    [summaryRows],
  );
  const selectedReinit = reinitTargets.filter((t) => reinitKeys.has(t.key));
  const allReinitSelected =
    reinitTargets.length > 0 && selectedReinit.length === reinitTargets.length;

  const toggleReinitTarget = useCallback((key: string) => {
    setReinitKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllReinit = useCallback(() => {
    setReinitKeys(allReinitSelected ? new Set() : new Set(reinitTargets.map((t) => t.key)));
  }, [allReinitSelected, reinitTargets]);

  const columns = useMemo<DataTableColumn<CallLogRow>[]>(() => {
    const cols: DataTableColumn<CallLogRow>[] = [
      {
        key: 'sel',
        label: allSelected ? '☑' : '☐',
        width: 36,
        render: (r) => (selectedIds.has(callLogRowId(r)) ? '☑' : '☐'),
        color: (r) => (selectedIds.has(callLogRowId(r)) ? colors.primary : colors.muted),
        onCellPress: toggleSelect,
        onHeaderPress: toggleAll,
      },
      { key: 'sr', label: '#', width: 46, render: (_r, i) => String(rowOffset + i + 1) },
      {
        key: 'name',
        label: 'Name',
        width: 110,
        render: (r) => String(r.client_name || '—'),
        color: (r) => (String(r.caller_user_id || '').trim() ? colors.primary : colors.foreground),
        onCellPress: (r) => openUserReport(r),
      },
      { key: 'dpId', label: 'DP ID', width: 180, render: (r) => String(r.caller_user_id || '—') },
    ];
    if (!isCaller) {
      cols.push({
        key: 'mobile',
        label: 'Mobile No',
        width: 110,
        render: (r) => maskMobile(r.phone_number, canShowMobile),
      });
    }
    cols.push(
      { key: 'app', label: 'App Code', width: 70, render: (r) => appCodeForName(r.app_name) },
      { key: 'state', label: 'State', width: 100, render: (r) => String(r.state || '—') },
      {
        key: 'status',
        label: 'Status',
        width: 120,
        render: (r) => formatStatusLabel(r),
        badge: (r) => statusColor(r),
        subtext: (r) => {
          const parts: string[] = [];
          const dur = toMinSec(r.call_duration);
          if (dur) parts.push(dur);
          if (r.recording_url) parts.push('Recording');
          return parts.join(' · ') || undefined;
        },
      },
    );
    if (!isCaller) {
      cols.push({
        key: 'callId',
        label: 'Call ID',
        width: 150,
        render: (r) => {
          const status = String(r.status || '');
          if (status === 'queued' || status === 'deleted') return '—';
          return String(r.call_sid || '—');
        },
      });
    }
    cols.push(
      { key: 'botId', label: 'Bot ID', width: 60, render: (r) => String(r.bot_id ?? '—') },
      {
        key: 'completedAt',
        label: 'Completed At',
        width: 145,
        render: (r) =>
          r.completed_at
            ? new Date(String(r.completed_at)).toLocaleString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })
            : '—',
      },
    );
    cols.push(
      {
        key: 'comment',
        label: 'Comment ✎',
        width: 120,
        render: (r) => String(r.comments || '—'),
        onCellPress: openComment,
      },
      {
        key: 'commentedBy',
        label: 'Comment By',
        width: 110,
        render: (r) =>
          String(r.commented_by || (r as { commentedBy?: unknown }).commentedBy || '—'),
      },
    );
    if (!isCaller) {
      cols.push({
        key: 'deletedBy',
        label: 'Deleted By',
        width: 130,
        render: (r) => {
          const by = String(r.deleted_by || (r as { deletedBy?: unknown }).deletedBy || '—');
          const at = r.deleted_at || (r as { deletedAt?: unknown }).deletedAt;
          return at ? `${by} · ${new Date(String(at)).toLocaleString()}` : by;
        },
      });
    }
    return cols;
  }, [
    rowOffset,
    isCaller,
    canShowMobile,
    openComment,
    openUserReport,
    allSelected,
    selectedIds,
    toggleSelect,
    toggleAll,
  ]);

  const textFilters: CallLogTextFilter[] = [
    { label: 'Mobile No', value: mobNo, onChangeText: setMobNo, keyboard: 'phone-pad' },
    { label: 'DP ID', value: dpId, onChangeText: setDpId },
    ...(!isCaller ? [{ label: 'Call ID', value: sid, onChangeText: setSid }] : []),
    { label: 'State', value: stateFilter, onChangeText: setStateFilter },
    ...(assignedBots.length === 0
      ? [
          {
            label: 'Bot ID',
            value: botIdFilter,
            onChangeText: setBotIdFilter,
            keyboard: 'number-pad' as const,
          },
        ]
      : []),
  ];

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
      <Text style={styles.title}>Call Logs</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · Tap a row for all details
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={applyFilters}
      />

      <SearchFilters
        open={filtersOpen}
        loading={loading}
        textFilters={textFilters}
        selectedStatus={selectedStatus}
        commentFilter={commentFilter}
        onToggle={() => setFiltersOpen((open) => !open)}
        onStatusChange={(status) => {
          setSelectedStatus(status);
          setPage(1);
        }}
        onCommentChange={(comment) => {
          setCommentFilter(comment);
          setPage(1);
        }}
        onClear={clearFilters}
        onSearch={applyFilters}
      />

      <PageSizePicker
        pageSize={pageSize}
        onChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <DialerControls
        open={dialerOpen}
        campaignId={campaignId}
        campaignOptions={campaignOptions}
        isCaller={isCaller}
        selectedCount={selectedIds.size}
        pushing={pushing}
        message={dialerMsg}
        onToggle={() => setDialerOpen((open) => !open)}
        onCampaignSelect={setCampaignId}
        onAdd={() => void addToDialer()}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {actionMsg ? (
        <View style={styles.actionMsgBox}>
          <Text style={styles.actionMsgText}>{actionMsg}</Text>
          <TouchableOpacity
            onPress={() => setActionMsg('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.actionMsgClose}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading data…</Text>
        </View>
      ) : (
        <>
          {!isCaller && summaryRows.length > 0 ? (
            <BotStatusPanel
              open={botStatusOpen}
              summaryRows={summaryRows}
              reinitTargets={reinitTargets}
              reinitKeys={reinitKeys}
              actionLoading={actionLoading}
              allReinitSelected={allReinitSelected}
              onToggle={() => setBotStatusOpen((open) => !open)}
              onToggleAll={toggleAllReinit}
              onToggleTarget={toggleReinitTarget}
              onReinit={(targets) => void reinitiateStatuses(targets)}
            />
          ) : null}

          <CallLogsList
            rows={rows}
            rowOffset={rowOffset}
            selectedIds={selectedIds}
            allSelected={allSelected}
            summaryBusyId={summaryBusyId}
            onToggleAll={toggleAll}
            onToggleSelect={toggleSelect}
            onSelectRow={(row, index) => setSelected({ row, index })}
            onComment={openComment}
            onViewSummary={(row) => void viewSummary(row)}
          />

          <CallLogsPagination
            page={page}
            total={total}
            totalPages={totalPages}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
          />
        </>
      )}

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.row.client_name || 'Call Details') : ''}
        fields={
          selected
            ? columns
                .filter((c) => c.key !== 'sr' && c.key !== 'name' && c.key !== 'sel')
                .map<SheetField>((c) => {
                  const value = c.render(selected.row, selected.index);
                  const sub = c.subtext?.(selected.row);
                  return {
                    label: c.label.replace(' ✎', ''),
                    value: sub ? `${value} · ${sub}` : value,
                    color: c.color?.(selected.row),
                    badgeColor: c.badge?.(selected.row),
                  };
                })
            : []
        }
        actions={sheetActions}
        onClose={() => setSelected(null)}
      />

      <CallSummaryModal
        visible={summaryOpen}
        loading={actionLoading}
        message={actionMsg}
        data={summaryData}
        onClose={() => {
          setSummaryOpen(false);
          setSummaryData(null);
          setActionMsg('');
        }}
      />

      <CommentModal
        row={commentRow}
        choice={commentChoice}
        text={commentText}
        saving={commentSaving}
        onChoice={setCommentChoice}
        onText={setCommentText}
        onSave={() => void saveComment()}
        onClose={() => setCommentRow(null)}
      />

      <RecordingPlayerModal
        visible={recordingUrl !== null}
        url={recordingUrl}
        onClose={() => setRecordingUrl(null)}
      />
    </ScrollView>
  );
}
