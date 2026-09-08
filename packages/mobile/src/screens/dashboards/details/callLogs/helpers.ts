/**
 * Types, option lists and pure helpers for the Call Logs screen
 * (ported from desktop `callLogs/utils.ts`).
 *
 * Everything here is state-free so the screen file only wires it to UI.
 */
import { CALL_STATUS_OPTIONS, COMMENT_FILTER_OPTIONS, pickPageSizes } from '@astro/shared';
import {
  processIncomingCall,
  type CallAnalysis,
  type CallSummaryData,
} from '../../../../api/incomingBot';
import { getRoleId, getRoleName } from '../../../../auth/permissions';
import { CALLER_ROLE_IDS } from '../../../../auth/callerRoles';
import { colors } from '../../../../theme';

export type { CallSummaryData };

export type CallLogRow = Record<string, unknown> & {
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
  recording_url?: string;
  last_played_date?: string;
  language?: string;
  city?: string;
  email?: string;
  reason?: string;
};

export const PAGE_SIZES = pickPageSizes([50, 100, 200, 500]);
export const STATUS_OPTIONS = CALL_STATUS_OPTIONS;
export const COMMENT_OPTIONS = COMMENT_FILTER_OPTIONS.filter((c) => c !== 'All');
export const MAX_COMMENT_LENGTH = 200;

export function callLogRowId(row: CallLogRow): string {
  return String(row.call_sid || row._id || '');
}

export function toDialerLeadSource(row: CallLogRow) {
  return {
    _id: String(row.caller_user_id || row._id || ''),
    name: row.client_name,
    mobile: row.phone_number,
    city: row.city,
    state: row.state,
    clientName: row.app_name,
  };
}

export function toMinSec(second: unknown): string {
  const sec = parseInt(String(second ?? ''), 10);
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m <= 0 ? `${s} sec` : `${m} min ${s} sec`;
}

export function getAssignedBotIds(
  user: {
    botIds?: Array<string | number> | string;
    botNo?: Array<string | number> | string;
  } | null,
): number[] {
  const raw = user?.botIds ?? user?.botNo;
  if (raw == null || raw === '') return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,\s]+/)
        .filter(Boolean);
  return Array.from(new Set(list.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)));
}

export function normalizeCallerRoleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

/** Caller (not caller-head) — same rule as desktop isCallLogsCaller. */
export function isCallLogsCaller(user: Record<string, unknown> | null): boolean {
  const roleId = getRoleId(user as never).trim();
  if (roleId && CALLER_ROLE_IDS.has(roleId)) return true;
  const name = normalizeCallerRoleName(getRoleName(user as never));
  if (!name) return false;
  if (name === 'caller' || name === 'caller_new' || name === 'callernew') return true;
  if (name.startsWith('caller_head')) return false;
  return name.startsWith('caller_');
}

export function formatStatusLabel(item: CallLogRow): string {
  const status = String(item.status || '');
  if (status === 'queued') return 'Queued';
  if (status === 'deleted') return 'Deleted';
  if (['busy', 'no-answer', 'failed'].includes(status)) return 'no-answer';
  if (!item.call_duration && status !== 'in-progress') return 'Not Received';
  if (status === 'completed') return 'completed';
  return status || '-';
}

export function statusColor(item: CallLogRow): string {
  const status = String(item.status || '');
  if (status === 'deleted') return colors.muted;
  if (status === 'queued') return '#facc15';
  if (['busy', 'no-answer', 'failed'].includes(status)) return colors.destructive;
  if (!item.call_duration && status !== 'in-progress') return '#facc15';
  if (status === 'completed') return colors.success;
  return colors.foreground;
}

export function filterCallsClientSide(
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

/* ------------------------------ bot summary ------------------------------- */

export type ReinitStatus = 'deleted' | 'failed' | 'no-answer';

export type BotSummaryRow = {
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

export const REINIT_CHIPS: Array<{
  rowKey: 'noAnswer' | 'failed' | 'deleted';
  status: ReinitStatus;
  label: string;
}> = [
  { rowKey: 'noAnswer', status: 'no-answer', label: 'No-Answer' },
  { rowKey: 'failed', status: 'failed', label: 'Failed' },
  { rowKey: 'deleted', status: 'deleted', label: 'Deleted' },
];

export function reinitTargetKey(botId: number, status: ReinitStatus): string {
  return `${botId}:${status}`;
}

export function hasValidBotPhone(value: unknown): boolean {
  return String(value ?? '').replace(/\D/g, '').length >= 8;
}

export type BotStatusSummaryData = {
  status?: Record<string, Record<string, number>>;
  'in-progress-bots-states'?: Record<string, string>;
};

export function buildBotSummaryRows(summary: BotStatusSummaryData | null): BotSummaryRow[] {
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

/** Port of desktop mapRowToDialSetting (callLogs/utils.ts). */
export function mapRowToDialSetting(item: CallLogRow): Record<string, unknown> {
  const lastPlayed = item.last_played_date
    ? new Date(String(item.last_played_date))
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        .toLowerCase()
    : undefined;
  const raw: Record<string, unknown> = {
    phone_number: item.phone_number,
    app_name: item.app_name,
    last_played_date: lastPlayed,
    language: item.language ?? 'hindi',
    client_name: item.client_name,
    id: item.caller_user_id,
    state: item.state,
    city: item.city,
    email: item.email,
    reason: item.reason ?? 'User List',
    botId: item.bot_id ?? 1,
  };
  return Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export function maskMobile(value: unknown, canShow: boolean): string {
  if (value === undefined || value === null || value === '') return '—';
  return canShow ? String(value) : '**********';
}

/* ------------------------------ call summary ------------------------------ */

/** Port of Laxmi CallLogModal / desktop buildCallRecordRows. */
export function buildSummaryRows(
  summaryData: CallSummaryData | null,
): Array<{ title: string; value: string; reason: string }> {
  const raw = summaryData?.data?.analysis ?? summaryData?.data;
  if (!raw || typeof raw !== 'object') return [];
  const data = raw as CallAnalysis;
  const priority = data.priority ?? {};
  const threat = data.threat ?? {};
  const humanIntervention = data.human_intervention ?? {};
  const satisfaction = data.satisfaction ?? {};
  const frustration = data.frustration ?? {};
  const nuisance = data.nuisance ?? {};
  const repeatedComplaint = data.repeated_complaint ?? {};
  const piiDetails = data.pii_details ?? {};
  const cell = (v: unknown, fallback = '—') => {
    if (v == null || v === '') return fallback;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };
  const rows = [
    { title: 'Summary', value: data.summary, reason: '-' },
    { title: 'Transcript', value: summaryData?.data?.transcript || data.transcript, reason: '-' },
    { title: 'Priority', value: priority.level, reason: priority.reason },
    { title: 'Threat', value: threat.flag, reason: threat.reason || 'N/A' },
    {
      title: 'Human Intervention',
      value: humanIntervention.required,
      reason: humanIntervention.reason,
    },
    { title: 'Frustration', value: frustration.level, reason: frustration.reason },
    { title: 'Satisfaction', value: satisfaction.value, reason: satisfaction.reason || 'N/A' },
    { title: 'Nuisance', value: nuisance.value, reason: nuisance.reason },
    {
      title: 'Repeated Complaint',
      value: repeatedComplaint.value,
      reason: repeatedComplaint.reason,
    },
    {
      title: 'PII Details',
      value: piiDetails.detected,
      reason: piiDetails.types?.length ? piiDetails.types.join(', ') : 'None',
    },
    { title: 'Next Best Action', value: data.next_best_action, reason: '' },
  ];
  return rows.map((r) => ({
    title: r.title,
    value: cell(r.value),
    reason: r.reason == null || r.reason === '' ? '' : String(r.reason),
  }));
}

/**
 * Mirror of desktop electron/secure processCallSummary: plain HTTPS POST to the
 * calling-bot helper (no auth/encryption), so it works without the Electron bridge.
 */
export async function processCallSummary(
  callSid: string,
): Promise<{ ok: boolean; message?: string; data?: CallSummaryData }> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(callSid)) {
    return { ok: false, message: 'Invalid call_sid' };
  }
  try {
    const { response, data } = await processIncomingCall(callSid);
    if (!response.ok || data?.status === 'failed') {
      return { ok: false, message: data?.message || 'Analysis failed', data: data ?? undefined };
    }
    return { ok: true, data: data ?? undefined, message: data?.message };
  } catch {
    return { ok: false, message: 'Analysis is in progress.' };
  }
}
