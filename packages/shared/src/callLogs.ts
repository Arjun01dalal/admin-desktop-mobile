/**
 * Call Logs — constants and pure helpers shared by desktop + mobile.
 * UI colors, networking, and spreadsheet I/O stay in platform packages.
 */

import { CALLER_ROLE_IDS } from './callerRoles';
import { getRoleId, getRoleName, type PermissionStorage, type PermissionUser } from './permissions';

/** Call Logs status filter options. */
export const CALL_STATUS_OPTIONS = ['All', 'completed', 'no-answer', 'Not Received'] as const;

export const BOT_STATUS_KEYS = [
  'no-answer',
  'completed',
  'in-progress',
  'failed',
  'busy',
  'queued',
  'deleted',
] as const;

export const BOT_STATUS_LABELS: Record<(typeof BOT_STATUS_KEYS)[number], string> = {
  'no-answer': 'No-Answer',
  completed: 'Completed',
  'in-progress': 'In-Progress',
  failed: 'Failed',
  busy: 'Busy',
  queued: 'Queued',
  deleted: 'Deleted',
};

/** Call Logs comment filter / dialler comment chips. */
export const COMMENT_FILTER_OPTIONS = [
  'All',
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

export const CALL_LOGS_POLL_INTERVAL_MS = 20_000;

export const MAX_CALL_COMMENT_LENGTH = 200;

/** Minimal fields used by status / filter helpers. */
export type CallLogStatusFields = {
  status?: string;
  call_duration?: unknown;
  bot_id?: number | string;
};

/** Minimal fields for dial-setting / customer-id helpers. */
export type CallLogDialFields = CallLogStatusFields & {
  call_sid?: string;
  _id?: string;
  client_name?: string;
  customerId?: string;
  caller_user_id?: string;
  phone_number?: string;
  app_name?: string;
  state?: string;
  city?: string;
  email?: string;
  reason?: string;
  language?: string;
  last_played_date?: string;
};

export function callLogRowId(row: Pick<CallLogDialFields, 'call_sid' | '_id'>): string {
  return String(row.call_sid || row._id || '');
}

/** DP / customer id from a call-log row (admin-panel `customerId` key). */
export function callLogCustomerId(
  row?: Pick<CallLogDialFields, 'customerId' | 'caller_user_id'> | null,
): string {
  return String(row?.customerId || row?.caller_user_id || '').trim();
}

export function toMinSec(second: unknown): string {
  const sec = parseInt(String(second ?? ''), 10);
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m <= 0 ? `${s} sec` : `${m} min ${s} sec`;
}

/** Normalize assigned bot IDs from login user (`botIds` or `botNo`). */
export function getAssignedBotIds(
  user:
    | {
        botIds?: Array<string | number> | string;
        botNo?: Array<string | number> | string;
      }
    | null
    | undefined,
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

/** Normalize role label for caller checks. */
export function normalizeCallerRoleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

/**
 * True for caller Role_IDs and caller-* role names
 * (caller, caller_new, caller_nonPerforming, caller_unique_pending, …).
 * Excludes caller_head variants.
 */
export function isCallLogsCaller(
  user: PermissionUser | null | undefined = null,
  storage?: PermissionStorage | null,
): boolean {
  const roleId = getRoleId(user ?? null, storage).trim();
  if (roleId && CALLER_ROLE_IDS.has(roleId)) return true;

  const name = normalizeCallerRoleName(getRoleName(user ?? null, storage));
  if (!name) return false;
  if (name === 'caller' || name === 'caller_new' || name === 'callernew') return true;
  if (name.startsWith('caller_head')) return false;
  return name.startsWith('caller_');
}

export function formatStatusLabel(item: CallLogStatusFields): string {
  const status = String(item.status || '');
  const duration = item.call_duration;

  if (status === 'queued') return 'Queued';
  if (status === 'deleted') return 'Deleted';
  if (['busy', 'no-answer', 'failed'].includes(status)) return 'no-answer';
  if (!duration && status !== 'in-progress') return 'Not Received';
  if (status === 'completed') return 'completed';
  return status || '-';
}

export type StatusBadgeTone = 'completed' | 'no-answer' | 'busy' | 'deleted' | 'default';

/** Pure status → tone mapping (platform maps tone → colors). */
export function statusBadgeTone(item: CallLogStatusFields): StatusBadgeTone {
  const status = String(item.status || '');
  if (status === 'deleted') return 'deleted';
  if (status === 'queued') return 'busy';
  if (['busy', 'no-answer', 'failed'].includes(status)) return 'no-answer';
  if (!item.call_duration && status !== 'in-progress') return 'busy';
  if (status === 'completed') return 'completed';
  return 'default';
}

export function filterCallsClientSide<T extends CallLogStatusFields>(
  calls: T[],
  selectedStatus: string,
  assignedBotIds: number[] = [],
): T[] {
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

export type ReinitStatus = 'deleted' | 'failed' | 'no-answer';

/** Bot summary row — keys match `BOT_STATUS_KEYS`. */
export type BotSummaryRow = {
  botId: number;
  state: string;
  'no-answer': number;
  completed: number;
  'in-progress': number;
  failed: number;
  busy: number;
  queued: number;
  deleted: number;
};

export const REINIT_CHIPS: Array<{
  rowKey: 'no-answer' | 'failed' | 'deleted';
  status: ReinitStatus;
  label: string;
}> = [
  { rowKey: 'no-answer', status: 'no-answer', label: 'No-Answer' },
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

/** Normalize bot-call-status-summary API into table rows. */
export function buildBotSummaryRows(
  summary: BotStatusSummaryData | Record<string, unknown> | null | undefined,
): BotSummaryRow[] {
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
      state: stateMap[key] || stateMap[botId as unknown as string] || '-',
      'no-answer': Number(statusMap['no-answer']?.[key] ?? 0),
      completed: Number(statusMap.completed?.[key] ?? 0),
      'in-progress': Number(statusMap['in-progress']?.[key] ?? 0),
      failed: Number(statusMap.failed?.[key] ?? 0),
      busy: Number(statusMap.busy?.[key] ?? 0),
      queued: Number(statusMap.queued?.[key] ?? 0),
      deleted: Number(statusMap.deleted?.[key] ?? 0),
    };
  });
}

export function cleanDialObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        !(typeof value === 'string' && value.trim() === ''),
    ),
  ) as Partial<T>;
}

/** Map a call-log row to dialout_settings payload fields. */
export function mapRowToDialSetting(item: CallLogDialFields): Record<string, unknown> {
  const lastPlayed = item.last_played_date
    ? new Date(String(item.last_played_date))
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        .toLowerCase()
    : undefined;

  return cleanDialObject({
    phone_number: item.phone_number,
    app_name: item.app_name,
    last_played_date: lastPlayed,
    language: item.language ?? 'hindi',
    client_name: item.client_name,
    id: callLogCustomerId(item),
    state: item.state,
    city: item.city,
    email: item.email,
    reason: item.reason ?? 'User List',
    botId: item.bot_id ?? 1,
  });
}

export type CallRecordRow = {
  title: string;
  value: string;
  reason: string;
};

type CallSummaryFlag = {
  flag?: unknown;
  reason?: string;
  level?: unknown;
  required?: unknown;
  value?: unknown;
  detected?: unknown;
  types?: string[];
};

type CallSummaryAnalysis = {
  summary?: unknown;
  transcript?: string;
  next_best_action?: unknown;
  threat?: CallSummaryFlag;
  priority?: CallSummaryFlag;
  human_intervention?: CallSummaryFlag;
  satisfaction?: CallSummaryFlag;
  frustration?: CallSummaryFlag;
  nuisance?: CallSummaryFlag;
  repeated_complaint?: CallSummaryFlag;
  pii_details?: CallSummaryFlag;
};

/**
 * Laxmi CallLogModal rows from process-call payload.
 * Accepts `{ data: { analysis, transcript } }` or nested analysis object.
 */
export function buildCallRecordRows(
  summaryData:
    | {
        data?: CallSummaryAnalysis & {
          transcript?: string;
          analysis?: CallSummaryAnalysis;
        };
      }
    | null
    | undefined,
): CallRecordRow[] {
  const envelope = summaryData?.data;
  if (!envelope || typeof envelope !== 'object') return [];
  const raw = (envelope.analysis ?? envelope) as CallSummaryAnalysis;

  const threat = raw.threat ?? {};
  const priority = raw.priority ?? {};
  const humanIntervention = raw.human_intervention ?? {};
  const satisfaction = raw.satisfaction ?? {};
  const frustration = raw.frustration ?? {};
  const nuisance = raw.nuisance ?? {};
  const repeatedComplaint = raw.repeated_complaint ?? {};
  const piiDetails = raw.pii_details ?? {};

  const cell = (v: unknown, fallback = '—') => {
    if (v == null || v === '') return fallback;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };

  const rows = [
    { title: 'Summary', value: raw.summary, reason: '-' },
    {
      title: 'Transcript',
      value: envelope.transcript || raw.transcript,
      reason: '-',
    },
    { title: 'Priority', value: priority.level, reason: priority.reason },
    { title: 'Threat', value: threat.flag, reason: threat.reason || 'N/A' },
    {
      title: 'Human Intervention',
      value: humanIntervention.required,
      reason: humanIntervention.reason,
    },
    {
      title: 'Frustration',
      value: frustration.level,
      reason: frustration.reason,
    },
    {
      title: 'Satisfaction',
      value: satisfaction.value,
      reason: satisfaction.reason || 'N/A',
    },
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
    { title: 'Next Best Action', value: raw.next_best_action, reason: '' },
  ];

  return rows.map((r) => ({
    title: r.title,
    value: cell(r.value),
    reason: r.reason == null || r.reason === '' ? '' : String(r.reason),
  }));
}

/** Alias used by mobile Call Logs panels. */
export const buildSummaryRows = buildCallRecordRows;
