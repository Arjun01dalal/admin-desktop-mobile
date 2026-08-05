/**
 * Call Logs — port of desktop CallLogsPage (list side).
 * callLogs.getDialerData + callLogs.botStatusSummary with DD/MM/YYYY dates.
 * Filters: date range, per-page, Mobile/DP ID/Call ID/State/Bot ID inputs,
 * status chips and comment chips. Non-callers see the bot status table and
 * can add comments (callLogs.updateCallData) by tapping the Comment cell.
 * Desktop-only actions (bot call / dialer / upload / pause) are not ported.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../../../api/client';
import { getRoleId, getRoleName, hasPermission } from '../../../auth/permissions';
import { CALLER_ROLE_IDS, RESP_SHOW_MOBILE } from '../../../auth/callerRoles';
import { getStoredUser } from '../../../lib/webShim';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { formatDdMmYyyy, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';

type CallLogRow = Record<string, unknown> & {
  call_sid?: string;
  _id?: string;
  client_name?: string;
  caller_user_id?: string;
  phone_number?: string;
  app_name?: string;
  state?: string;
  status?: string;
  call_duration?: unknown;
  bot_id?: number | string;
  completed_at?: string;
  comments?: string;
  commented_by?: string;
  deleted_by?: string;
  deleted_at?: string;
};

const PAGE_SIZES = [50, 100, 200, 500];
const STATUS_OPTIONS = ['All', 'completed', 'no-answer', 'Not Received'] as const;
const COMMENT_OPTIONS = [
  'Call Back',
  'Call Disconnect',
  'Do Not Call',
  'Finance Issue',
  'Interested',
  'Link Send',
  'Not Getting Time',
  'Not Interested',
  'Not Responding',
  'Call Received By Another Person',
  'Number Busy',
  'Out of Network',
  'Out of Service',
  'Play After Some Time',
  'Player Busy',
  'Player Not Avaliable',
  'Playing Customer',
  'Playing in Another App',
  'Switch Off',
  'Invalid Number',
  'Not Answer',
  'Money Issue',
  'Demo User',
  'User Block',
  'Call Transfer',
] as const;
const MAX_COMMENT_LENGTH = 200;

/** Columns kept in the list; everything else shows in the bottom sheet. */
const MAIN_KEYS = new Set(['sr', 'name', 'status', 'comment']);

/* ---------- helpers (ported from desktop callLogs/utils.ts) ---------- */

function toMinSec(second: unknown): string {
  const sec = parseInt(String(second ?? ''), 10);
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m <= 0 ? `${s} sec` : `${m} min ${s} sec`;
}

function getAssignedBotIds(user: {
  botIds?: Array<string | number> | string;
  botNo?: Array<string | number> | string;
} | null): number[] {
  const raw = user?.botIds ?? user?.botNo;
  if (raw == null || raw === '') return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,\s]+/)
        .filter(Boolean);
  return Array.from(
    new Set(list.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)),
  );
}

function normalizeCallerRoleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

/** Caller (not caller-head) — same rule as desktop isCallLogsCaller. */
function isCallLogsCaller(user: Record<string, unknown> | null): boolean {
  const roleId = getRoleId(user as never).trim();
  if (roleId && CALLER_ROLE_IDS.has(roleId)) return true;
  const name = normalizeCallerRoleName(getRoleName(user as never));
  if (!name) return false;
  if (name === 'caller' || name === 'caller_new' || name === 'callernew') return true;
  if (name.startsWith('caller_head')) return false;
  return name.startsWith('caller_');
}

function formatStatusLabel(item: CallLogRow): string {
  const status = String(item.status || '');
  if (status === 'queued') return 'Queued';
  if (status === 'deleted') return 'Deleted';
  if (['busy', 'no-answer', 'failed'].includes(status)) return 'no-answer';
  if (!item.call_duration && status !== 'in-progress') return 'Not Received';
  if (status === 'completed') return 'completed';
  return status || '-';
}

function statusColor(item: CallLogRow): string {
  const status = String(item.status || '');
  if (status === 'deleted') return colors.muted;
  if (status === 'queued') return '#facc15';
  if (['busy', 'no-answer', 'failed'].includes(status)) return colors.destructive;
  if (!item.call_duration && status !== 'in-progress') return '#facc15';
  if (status === 'completed') return colors.success;
  return colors.foreground;
}

function filterCallsClientSide(
  calls: CallLogRow[],
  selectedStatus: string,
  assignedBotIds: number[],
): CallLogRow[] {
  let next = calls;
  if (assignedBotIds.length > 0) {
    const allowed = new Set(assignedBotIds);
    next = next.filter((c) => allowed.has(Number(c.bot_id)));
  }
  if (selectedStatus === 'Not Received') {
    return next.filter((c) => c.status === 'completed' && !c.call_duration);
  }
  if (selectedStatus === 'completed') {
    return next.filter((c) => c.status === 'completed' && c.call_duration);
  }
  if (selectedStatus === 'no-answer') {
    return next.filter((c) => ['busy', 'no-answer', 'failed'].includes(String(c.status || '')));
  }
  return next;
}

type BotSummaryRow = {
  botId: number;
  state: string;
  noAnswer: number;
  completed: number;
  inProgress: number;
  failed: number;
  busy: number;
  queued: number;
  deleted: number;
};

function buildBotSummaryRows(summary: Record<string, unknown> | null): BotSummaryRow[] {
  if (!summary || typeof summary !== 'object') return [];
  const statusMap = (summary.status || {}) as Record<string, Record<string, number>>;
  const stateMap = (summary['in-progress-bots-states'] || {}) as Record<string, string>;
  const botIds = Array.from(
    new Set(
      Object.values(statusMap)
        .flatMap((bucket) => Object.keys(bucket || {}))
        .map(Number)
        .filter((n) => Number.isFinite(n)),
    ),
  ).sort((a, b) => a - b);
  return botIds.map((botId) => {
    const key = String(botId);
    return {
      botId,
      state: stateMap[key] || '-',
      noAnswer: Number(statusMap['no-answer']?.[key] ?? 0),
      completed: Number(statusMap.completed?.[key] ?? 0),
      inProgress: Number(statusMap['in-progress']?.[key] ?? 0),
      failed: Number(statusMap.failed?.[key] ?? 0),
      busy: Number(statusMap.busy?.[key] ?? 0),
      queued: Number(statusMap.queued?.[key] ?? 0),
      deleted: Number(statusMap.deleted?.[key] ?? 0),
    };
  });
}

function maskMobile(value: unknown, canShow: boolean): string {
  if (value === undefined || value === null || value === '') return '—';
  return canShow ? String(value) : '**********';
}

/* --------------------------------- screen --------------------------------- */

export function CallLogsScreen() {
  const isFocused = useIsFocused();
  const admin = getStoredUser<Record<string, unknown>>();
  const isCaller = isCallLogsCaller(admin);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const assignedBots = useMemo(() => getAssignedBotIds(admin as never), [admin]);

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
  const [applyTick, setApplyTick] = useState(0);

  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [botSummary, setBotSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<{ row: CallLogRow; index: number } | null>(null);

  // Comment modal
  const [commentRow, setCommentRow] = useState<CallLogRow | null>(null);
  const [commentChoice, setCommentChoice] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);

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
        botId =
          f.botIdFilter && assignedBots.includes(chosen) ? [chosen] : assignedBots;
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
        secureApi('callLogs.getDialerData', {
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
        }),
        secureApi('callLogs.botStatusSummary', dates),
      ]);
      if (gen !== genRef.current) return; // stale response

      if (!listRes.ok) {
        setError(listRes.message || 'Failed to load call logs');
        setRows([]);
        setTotal(0);
      } else {
        const data = (listRes.data || {}) as {
          calls?: CallLogRow[];
          pagination?: { totalCount?: number };
        };
        const raw = data.calls || [];
        const next = filterCallsClientSide(raw, selectedStatus, assignedBots);
        setRows(next);
        setTotal(Number(data.pagination?.totalCount ?? next.length));
        setError('');
      }
      if (sumRes.ok && sumRes.data) {
        setBotSummary(sumRes.data as Record<string, unknown>);
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate, page, pageSize, selectedStatus, commentFilter, assignedBots, applyTick]);

  useEffect(() => {
    if (isFocused) void load();
  }, [isFocused, load]);

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

  const rowOffset = (page - 1) * pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const summaryRows = useMemo(() => buildBotSummaryRows(botSummary), [botSummary]);

  const columns = useMemo<DataTableColumn<CallLogRow>[]>(() => {
    const cols: DataTableColumn<CallLogRow>[] = [
      { key: 'sr', label: '#', width: 46, render: (_r, i) => String(rowOffset + i + 1) },
      { key: 'name', label: 'Name', width: 110, render: (r) => String(r.client_name || '—') },
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
        width: 110,
        render: (r) => {
          const dur = toMinSec(r.call_duration);
          return dur ? `${formatStatusLabel(r)} · ${dur}` : formatStatusLabel(r);
        },
        color: (r) => statusColor(r),
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
    if (!isCaller) {
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
          render: (r) => String(r.commented_by || (r as { commentedBy?: unknown }).commentedBy || '—'),
        },
        {
          key: 'deletedBy',
          label: 'Deleted By',
          width: 130,
          render: (r) => {
            const by = String(r.deleted_by || (r as { deletedBy?: unknown }).deletedBy || '—');
            const at = r.deleted_at || (r as { deletedAt?: unknown }).deletedAt;
            return at ? `${by} · ${new Date(String(at)).toLocaleString()}` : by;
          },
        },
      );
    }
    return cols;
  }, [rowOffset, isCaller, canShowMobile, openComment]);

  const summaryColumns = useMemo<DataTableColumn<BotSummaryRow>[]>(
    () => [
      { key: 'botId', label: 'Bot', width: 50, render: (r) => String(r.botId) },
      { key: 'state', label: 'State', width: 110, render: (r) => r.state },
      { key: 'completed', label: 'Completed', width: 80, align: 'right', render: (r) => String(r.completed), color: () => colors.success },
      { key: 'noAnswer', label: 'No-Answer', width: 80, align: 'right', render: (r) => String(r.noAnswer), color: () => colors.destructive },
      { key: 'inProgress', label: 'In-Progress', width: 85, align: 'right', render: (r) => String(r.inProgress) },
      { key: 'failed', label: 'Failed', width: 60, align: 'right', render: (r) => String(r.failed) },
      { key: 'busy', label: 'Busy', width: 55, align: 'right', render: (r) => String(r.busy) },
      { key: 'queued', label: 'Queued', width: 65, align: 'right', render: (r) => String(r.queued) },
      { key: 'deleted', label: 'Deleted', width: 65, align: 'right', render: (r) => String(r.deleted) },
    ],
    [],
  );

  const textFilters: Array<{ label: string; value: string; set: (v: string) => void; keyboard?: 'phone-pad' | 'number-pad' }> = [
    { label: 'Mobile No', value: mobNo, set: setMobNo, keyboard: 'phone-pad' },
    { label: 'DP ID', value: dpId, set: setDpId },
    ...(!isCaller ? [{ label: 'Call ID', value: sid, set: setSid }] : []),
    { label: 'State', value: stateFilter, set: setStateFilter },
    ...(assignedBots.length === 0
      ? [{ label: 'Bot ID', value: botIdFilter, set: setBotIdFilter, keyboard: 'number-pad' as const }]
      : []),
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
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

      {/* Collapsible search filters */}
      <TouchableOpacity style={styles.collapseHeader} onPress={() => setFiltersOpen((o) => !o)}>
        <Text style={styles.collapseTitle}>Search Filters {filtersOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {filtersOpen && (
        <View style={styles.filterCard}>
          {textFilters.map((f) => (
            <View key={f.label} style={styles.filterRow}>
              <Text style={styles.filterLabel}>{f.label}</Text>
              <TextInput
                style={styles.filterInput}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.label}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={f.keyboard ?? 'default'}
              />
            </View>
          ))}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Text style={styles.chipRowLabel}>Status</Text>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, selectedStatus === s && styles.chipActive]}
                  onPress={() => {
                    setSelectedStatus(s);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.chipText, selectedStatus === s && styles.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Text style={styles.chipRowLabel}>Comment</Text>
              {['All', ...COMMENT_OPTIONS].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, commentFilter === c && styles.chipActive]}
                  onPress={() => {
                    setCommentFilter(c);
                    setPage(1);
                  }}
                >
                  <Text style={[styles.chipText, commentFilter === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters} disabled={loading}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchBtn} onPress={applyFilters} disabled={loading}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Per-page chips */}
      <View style={styles.chipRowSpaced}>
        <Text style={styles.chipRowLabel}>Per page</Text>
        {PAGE_SIZES.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, pageSize === n && styles.chipActive]}
            onPress={() => {
              setPageSize(n);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, pageSize === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading data…</Text>
        </View>
      ) : (
        <>
          {!isCaller && summaryRows.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Bot Status</Text>
              <DataTable
                columns={summaryColumns}
                rows={summaryRows}
                keyFor={(r) => String(r.botId)}
                emptyMessage="No bot data"
              />
            </>
          )}

          <Text style={styles.sectionTitle}>Calls</Text>
          <DataTable
            columns={columns.filter((c) => MAIN_KEYS.has(c.key))}
            rows={rows}
            keyFor={(r, i) => String(r.call_sid || r._id || i)}
            emptyMessage="No call logs"
            onRowPress={(row) => setSelected({ row, index: rows.indexOf(row) })}
            hint={
              isCaller
                ? 'Tap a row to see all details'
                : 'Tap a row for details · Tap a Comment cell to add a comment'
            }
          />

          {/* Pagination */}
          <View style={styles.pagerRow}>
            <TouchableOpacity
              style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <Text style={styles.pagerBtnText}>‹ Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pagerInfo}>
              {total > 0
                ? `${total.toLocaleString()} calls · page ${page} of ${totalPages}`
                : 'No calls'}
            </Text>
            <TouchableOpacity
              style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <Text style={styles.pagerBtnText}>Next ›</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? String(selected.row.client_name || 'Call Details') : ''}
        fields={
          selected
            ? columns.map<SheetField>((c) => ({
                label: c.label.replace(' ✎', ''),
                value: c.render(selected.row, selected.index),
                color: c.color?.(selected.row),
              }))
            : []
        }
        onClose={() => setSelected(null)}
      />

      {/* Comment modal */}
      <Modal visible={commentRow !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Comment</Text>
            <Text style={styles.modalSub}>
              {String(commentRow?.client_name || '')} · {String(commentRow?.caller_user_id || '')}
            </Text>
            <ScrollView style={styles.modalChips} showsVerticalScrollIndicator={false}>
              <View style={styles.chipWrap}>
                {[...COMMENT_OPTIONS, 'other'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, commentChoice === c && styles.chipActive]}
                    onPress={() => setCommentChoice(c)}
                  >
                    <Text style={[styles.chipText, commentChoice === c && styles.chipTextActive]}>
                      {c === 'other' ? 'Other…' : c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {(commentChoice === 'other' || !commentChoice) && (
              <TextInput
                style={styles.filterInput}
                value={commentText}
                onChangeText={(t) => setCommentText(t.slice(0, MAX_COMMENT_LENGTH))}
                placeholder="Custom comment"
                placeholderTextColor={colors.muted}
                maxLength={MAX_COMMENT_LENGTH}
              />
            )}
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={() => setCommentRow(null)}>
                <Text style={styles.clearBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={() => void saveComment()}
                disabled={commentSaving}
              >
                {commentSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.searchBtnText}>Save</Text>
                )}
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
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1), marginBottom: spacing(2) },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing(4),
    marginBottom: spacing(2),
  },
  collapseHeader: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    marginTop: spacing(3),
  },
  collapseTitle: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  filterCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    gap: spacing(2.5),
    marginTop: spacing(2),
  },
  filterRow: { gap: spacing(1) },
  filterLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  filterInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chipRowSpaced: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chipRowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
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
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(1),
  },
  clearBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  clearBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    minWidth: 72,
    alignItems: 'center',
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(10),
    gap: spacing(2),
  },
  loadingText: { color: colors.muted, fontSize: 13 },
  pagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing(3),
    gap: spacing(2),
  },
  pagerBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    backgroundColor: colors.surface,
  },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  pagerInfo: { color: colors.muted, fontSize: 12, flexShrink: 1, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
    gap: spacing(3),
    maxHeight: '80%',
  },
  modalTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  modalSub: { color: colors.muted, fontSize: 12 },
  modalChips: { maxHeight: 220 },
});
