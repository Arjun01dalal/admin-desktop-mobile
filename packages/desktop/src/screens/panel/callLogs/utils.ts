import * as XLSX from 'xlsx';
import { getRoleId, getRoleName } from '@/auth/permissions';
import { CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';
import type { AuthUser } from '@/types/gcalc';
import { STATE_LANGUAGE_MAP } from './constants';
import type {
  CallLogRow,
  DialerConnectDetails,
  DialerLead,
} from './types';
import { MAX_EXCEL_LEADS } from './types';

export type DialLead = {
  phone_number: string;
  app_name: string;
  language: string;
  client_name: string;
  id: string;
  state: string;
  city: string;
  email: string;
  botId: number;
  reason: string;
};

export function cleanObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        !(typeof value === 'string' && value.trim() === ''),
    ),
  ) as Partial<T>;
}

export function toMinSec(second: unknown): string {
  const sec = parseInt(String(second ?? ''), 10);
  if (!Number.isFinite(sec) || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m <= 0 ? `${s} sec` : `${m} min ${s} sec`;
}

/** Normalize assigned bot IDs from login user (`botIds` or `botNo`). */
export function getAssignedBotIds(user: {
  botIds?: Array<string | number> | string;
  botNo?: Array<string | number> | string;
} | null | undefined): number[] {
  const raw = user?.botIds ?? user?.botNo;
  if (raw == null || raw === '') return [];
  const list = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(/[,\s]+/)
        .filter(Boolean);
  return Array.from(
    new Set(
      list
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  );
}

/** Normalize role label for caller checks. */
function normalizeCallerRoleName(value: string): string {
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
  user: {
    Role_ID?: string;
    role?: string;
    Role_Name?: string;
    roles?: AuthUser['roles'];
  } | null | undefined,
): boolean {
  const roleId = getRoleId(user ?? null).trim();
  if (roleId && CALLER_ROLE_IDS.has(roleId)) return true;

  const name = normalizeCallerRoleName(getRoleName(user ?? null));
  if (!name) return false;
  if (name === 'caller' || name === 'caller_new' || name === 'callernew') {
    return true;
  }
  // caller_nonPerforming / caller_unique_pending / etc. — not heads
  if (name.startsWith('caller_head')) return false;
  return name.startsWith('caller_');
}

export function formatStatusLabel(item: CallLogRow): string {
  const status = String(item.status || '');
  const duration = item.call_duration;

  if (status === 'queued') return 'Queued';
  if (status === 'deleted') return 'Deleted';
  if (['busy', 'no-answer', 'failed'].includes(status)) return 'no-answer';
  if (!duration && status !== 'in-progress') return 'Not Received';
  if (status === 'completed') return 'completed';
  return status || '-';
}

export type StatusBadgeTone =
  | 'completed'
  | 'no-answer'
  | 'busy'
  | 'deleted'
  | 'default';

export function statusBadgeTone(item: CallLogRow): StatusBadgeTone {
  const status = String(item.status || '');
  if (status === 'deleted') return 'deleted';
  if (status === 'queued') return 'busy';
  if (['busy', 'no-answer', 'failed'].includes(status)) return 'no-answer';
  if (!item.call_duration && status !== 'in-progress') return 'busy';
  if (status === 'completed') return 'completed';
  return 'default';
}

export function mapRowToDialSetting(item: CallLogRow) {
  const lastPlayed = item.last_played_date
    ? new Date(String(item.last_played_date))
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        .toLowerCase()
    : undefined;

  return cleanObject({
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
  });
}

/** Only whitelisted fields for external dialer connect. */
export function toDialerConnectDetails(row: CallLogRow): DialerConnectDetails {
  return {
    call_sid: row.call_sid,
    client_name: row.client_name,
    phone_number: row.phone_number,
    city: row.city,
    state: row.state,
    app_name: row.app_name,
    caller_user_id: row.caller_user_id,
    _id: row._id,
  };
}

export function toDialerLead(item: CallLogRow): DialerLead {
  return {
    first_name: item.client_name || '',
    last_name: '',
    phone_number: item.phone_number || '',
    city: item.city ?? '',
    state: item.state ?? '',
    email: item.app_name ?? '',
    comments: item.app_name ?? '',
    province: item.caller_user_id || item._id || '',
  };
}

export function extractDialLeadsFromExcel(file: File): Promise<DialLead[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
        });

        if (!jsonData.length) {
          reject(new Error('Excel file is empty'));
          return;
        }
        if (jsonData.length > MAX_EXCEL_LEADS) {
          reject(new Error(`Excel exceeds max ${MAX_EXCEL_LEADS} rows`));
          return;
        }

        const excelColumns = Object.keys(jsonData[0]);
        const missing = ['number', 'state', 'botId'].filter((c) => !excelColumns.includes(c));
        if (missing.length) {
          reject(new Error(`Invalid Excel file. Missing columns: ${missing.join(', ')}`));
          return;
        }

        resolve(
          jsonData.map((row) => {
            const state = String(row.state || '');
            const rawPhone = String(row.number || '').replace(/\D/g, '');
            const botId = Number(row.botId);
            return {
              phone_number: rawPhone,
              app_name: 'OS Games',
              language: STATE_LANGUAGE_MAP[state] ?? 'hindi',
              client_name: 'Sir',
              id: '',
              state,
              city: '',
              email: '',
              botId: Number.isFinite(botId) && botId > 0 ? botId : 1,
              reason: String(row.reason || 'New Leads').slice(0, 200),
            };
          }),
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to read Excel'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function filterCallsClientSide(
  calls: CallLogRow[],
  selectedStatus: string,
  assignedBotIds: number[] = [],
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
    return next.filter((c) =>
      ['busy', 'no-answer', 'failed'].includes(String(c.status || '')),
    );
  }
  return next;
}

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

/** Normalize bot-call-status-summary API into table rows. */
export function buildBotSummaryRows(
  summary: Record<string, unknown> | null | undefined,
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

type SummaryFlag = {
  flag?: unknown;
  reason?: string;
  level?: unknown;
  required?: unknown;
  value?: unknown;
  detected?: unknown;
  types?: string[];
};

export type CallRecordRow = {
  title: string;
  value: string;
  reason: string;
};

/**
 * Laxmi CallLogModal rows from helper.callingbot.live/process-call payload.
 * Accepts either `{ data: { analysis, transcript } }` or nested analysis object.
 */
export function buildCallRecordRows(
  summaryData: Record<string, unknown> | null | undefined,
): CallRecordRow[] {
  if (!summaryData || typeof summaryData !== 'object') return [];

  const envelope =
    summaryData.data && typeof summaryData.data === 'object'
      ? (summaryData.data as Record<string, unknown>)
      : summaryData;
  const raw =
    envelope.analysis && typeof envelope.analysis === 'object'
      ? (envelope.analysis as Record<string, unknown>)
      : envelope;

  if (!raw || typeof raw !== 'object') return [];

  const threat = raw.threat as SummaryFlag | undefined;
  const priority = raw.priority as SummaryFlag | undefined;
  const humanIntervention = raw.human_intervention as SummaryFlag | undefined;
  const satisfaction = raw.satisfaction as SummaryFlag | undefined;
  const frustration = raw.frustration as SummaryFlag | undefined;
  const nuisance = raw.nuisance as SummaryFlag | undefined;
  const repeatedComplaint = raw.repeated_complaint as SummaryFlag | undefined;
  const piiDetails = raw.pii_details as SummaryFlag | undefined;

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
    { title: 'Priority', value: priority?.level, reason: priority?.reason },
    { title: 'Threat', value: threat?.flag, reason: threat?.reason || 'N/A' },
    {
      title: 'Human Intervention',
      value: humanIntervention?.required,
      reason: humanIntervention?.reason,
    },
    {
      title: 'Frustration',
      value: frustration?.level,
      reason: frustration?.reason,
    },
    {
      title: 'Satisfaction',
      value: satisfaction?.value,
      reason: satisfaction?.reason || 'N/A',
    },
    { title: 'Nuisance', value: nuisance?.value, reason: nuisance?.reason },
    {
      title: 'Repeated Complaint',
      value: repeatedComplaint?.value,
      reason: repeatedComplaint?.reason,
    },
    {
      title: 'PII Details',
      value: piiDetails?.detected,
      reason: piiDetails?.types?.length ? piiDetails.types.join(', ') : 'None',
    },
    { title: 'Next Best Action', value: raw.next_best_action, reason: '' },
  ];

  return rows.map((r) => ({
    title: r.title,
    value: cell(r.value),
    reason: r.reason == null || r.reason === '' ? '' : String(r.reason),
  }));
}
