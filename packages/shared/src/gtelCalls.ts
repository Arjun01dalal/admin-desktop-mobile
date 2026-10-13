/**
 * Gtel Calls — shared types & parsers (admin-panel-domains GtelCalls).
 * List: GET /dialer/calls · Details: GET /dialer/call/{callId}
 * Click-to-call: POST /dialer/click-to-call · Hangup: POST /dialer/hangup
 */

import { CALLER_ROLE_IDS } from './callerRoles';
import { hasPermission, Permissions, type PermissionUser } from './permissions';

export type GtelCall = {
  _id?: string;
  callId?: string;
  server?: string;
  phoneNumber?: string;
  extension?: string;
  status?: string;
  statusByDialer?: string;
  disposition?: string | null;
  dispositionUpdatedAt?: string | null;
  duration?: number;
  recordingUrl?: string | null;
  callDate?: string;
  clickedAt?: string;
  hangupRequestedAt?: string | null;
  createdOn?: string;
  dialerUniqueId?: string;
  transcription?: string;
  username?: string;
  userName?: string;
  name?: string;
  state?: string;
  city?: string;
  dpi_id?: string;
  dp_id?: string;
  userId?: string;
  empCode?: string;
  emp_code?: string;
  clientName?: string;
  app_name?: string;
  appName?: string;
  personalConnectCategories?: string[] | string | null;
  lastActivity?: string;
  activeUser?: string;
  user?: {
    name?: string;
    userName?: string;
    username?: string;
    state?: string;
    city?: string;
    dpid?: string;
    dpi_id?: string;
    dp_id?: string;
    _id?: string;
    empCode?: string;
    emp_code?: string;
    clientName?: string;
    app_name?: string;
    appName?: string;
    lastActivity?: string;
    last_activity?: string;
    activeUser?: string;
    active_user?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type GtelFilters = {
  from: string;
  to: string;
  extension: string;
  phoneNumber: string;
  disposition: string;
  empCode: string;
};

export type GtelSummaryCard = { key: string; label: string; value: number };

export type GtelCallsPage = {
  rows: GtelCall[];
  total: number;
  totalPages: number;
  summary: Record<string, unknown> | null;
};

export const DEFAULT_GTEL_PAGE_SIZE = 50;
export const GTEL_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 250] as const;

/** Admin-panel hard-coded overrides (parity). */
export const GTEL_SHOW_MOBILE_OVERRIDE = '9676849375';
export const GTEL_SHOW_C2C_OVERRIDE = '8956381336';

/** Gate: `show_c2cBtn` responsibility or hard-coded override mobile (admin parity). */
export function canShowGtelC2c(user: PermissionUser | null | undefined): boolean {
  const mobile = String(user?.mobile || '').trim();
  if (mobile === GTEL_SHOW_C2C_OVERRIDE) return true;
  return hasPermission(Permissions.show_c2cBtn, user ?? null);
}

const GREEN_DISPOSITIONS = new Set([
  'money issue',
  'will play later',
  'withdrawl issue',
  'withdrawal issue',
  'already playing customer',
  'interested/link sent',
  'interested / link sent',
]);

const SUMMARY_KEY_ORDER = [
  'total',
  'totalCalls',
  'totalCount',
  'count',
  'answered',
  'answeredCount',
  'ANSWER',
  'ANSWERED',
  'noAnswer',
  'noAnswerCount',
  'no_answer',
  'NO ANSWER',
  'NOANSWER',
  'busy',
  'BUSY',
  'failed',
  'FAILED',
  'completed',
  'COMPLETED',
  'cancelled',
  'canceled',
  'CANCELLED',
  'ringing',
  'RINGING',
  'missed',
  'MISSED',
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function gtelDisplay(...values: unknown[]): string {
  for (const value of values) {
    if (value == null || value === '') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '—';
}

export function getGtelUsername(call: GtelCall): string {
  return gtelDisplay(
    call.user?.name,
    call.user?.userName,
    call.user?.username,
    call.username,
    call.userName,
    call.name,
  );
}

export function getGtelAppName(call: GtelCall): string {
  return gtelDisplay(
    call.user?.clientName,
    call.user?.app_name,
    call.user?.appName,
    call.clientName,
    call.app_name,
    call.appName,
  );
}

export function getGtelState(call: GtelCall): string {
  return gtelDisplay(call.user?.state, call.state);
}

export function getGtelCity(call: GtelCall): string {
  return gtelDisplay(call.user?.city, call.city);
}

export function getGtelDpiId(call: GtelCall): string {
  return gtelDisplay(
    call.user?.dpid,
    call.user?.dpi_id,
    call.user?.dp_id,
    call.user?._id,
    call.dpi_id,
    call.dp_id,
    call.userId,
  );
}

export function getGtelCallerEmpCode(call: GtelCall): string {
  return gtelDisplay(call.empCode, call.emp_code);
}

export function getGtelUserEmpCode(call: GtelCall): string {
  return gtelDisplay(call.user?.empCode, call.user?.emp_code);
}

export function getGtelLastActivityRaw(call: GtelCall): string {
  return gtelDisplay(
    call.user?.lastActivity,
    call.user?.last_activity,
    call.user?.activeUser,
    call.user?.active_user,
    call.lastActivity,
    call.activeUser,
  );
}

export function getGtelPersonalConnect(call: GtelCall): { empty: boolean; text: string } {
  const raw = call.personalConnectCategories;
  if (raw == null || raw === '') return { empty: true, text: '—' };
  if (Array.isArray(raw)) {
    const values = raw.map((item) => String(item ?? '').trim()).filter(Boolean);
    if (!values.length) return { empty: true, text: '—' };
    return { empty: false, text: values.join(', ') };
  }
  const text = String(raw).trim();
  if (!text || text === '-' || text.toLowerCase() === 'null') {
    return { empty: true, text: '—' };
  }
  return { empty: false, text };
}

export function formatGtelDuration(seconds?: number): string {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return '—';
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function maskGtelPhone(phone?: string, canShow?: boolean): string {
  if (!phone) return '—';
  if (canShow) return phone;
  return '**********';
}

export function gtelStatusTone(status?: string | null): 'answer' | 'noAnswer' | 'completed' | 'muted' {
  const value = String(status || '').toUpperCase();
  if (value.includes('ANSWER') && !value.includes('NO')) return 'answer';
  if (value.includes('NO ANSWER') || value.includes('NOANSWER')) return 'noAnswer';
  if (value.includes('COMPLETED')) return 'completed';
  return 'muted';
}

export function gtelDispositionTone(
  disposition?: string | null,
): 'answer' | 'callback' | 'completed' | 'muted' {
  if (!disposition) return 'muted';
  const normalized = disposition.toLowerCase().replace(/\s+/g, ' ').trim();
  if (GREEN_DISPOSITIONS.has(normalized)) return 'answer';
  if (normalized.includes('call back')) return 'callback';
  return 'completed';
}

export function isGtelRowAlert(call: GtelCall): boolean {
  return getGtelPersonalConnect(call).empty === false;
}

function labelizeSummaryKey(key: string): string {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = {
    total: 'Total Calls',
    totalcalls: 'Total Calls',
    totalcount: 'Total Calls',
    count: 'Total Calls',
    answered: 'Answered',
    answeredcount: 'Answered',
    answer: 'Answered',
    noanswer: 'No Answer',
    noanswercount: 'No Answer',
    busy: 'Busy',
    failed: 'Failed',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    completed: 'Completed',
    ringing: 'Ringing',
    missed: 'Missed',
    connected: 'Connected',
  };
  if (aliases[normalized]) return aliases[normalized];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function extractGtelSummary(...sources: unknown[]): Record<string, unknown> | null {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    const record = source as Record<string, unknown>;
    const nestedData = asRecord(record.data);
    const nestedPayload = asRecord(record.payload);
    const candidate =
      record.summary ??
      record.Summary ??
      nestedData.summary ??
      nestedData.Summary ??
      nestedPayload.summary ??
      nestedPayload.Summary;
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return null;
}

export function buildGtelSummaryCards(
  summary: Record<string, unknown> | null,
  calls: GtelCall[],
  total: number,
): GtelSummaryCard[] {
  const pageAnswered = calls.filter((call) => {
    const s = String(call.statusByDialer || '').toUpperCase();
    return s.includes('ANSWER') && !s.includes('NO');
  }).length;
  const pageNoAnswer = calls.filter((call) =>
    String(call.statusByDialer || '')
      .toUpperCase()
      .includes('NO ANSWER'),
  ).length;

  if (summary && typeof summary === 'object') {
    const entries = Object.entries(summary).filter(([, value]) => {
      if (value == null || value === '') return false;
      if (typeof value === 'object') return false;
      return Number.isFinite(Number(value));
    });

    const rank = (key: string) => {
      const exact = SUMMARY_KEY_ORDER.indexOf(key);
      if (exact >= 0) return exact;
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fuzzy = SUMMARY_KEY_ORDER.findIndex(
        (item) => item.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized,
      );
      return fuzzy >= 0 ? fuzzy : SUMMARY_KEY_ORDER.length + 1;
    };

    const cards = entries
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([key, value]) => ({
        key,
        label: labelizeSummaryKey(key),
        value: Number(value),
      }));

    const hasTotal = cards.some((card) =>
      ['total', 'totalcalls', 'totalcount', 'count'].includes(
        card.key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ),
    );

    return hasTotal ? cards : [{ key: 'total', label: 'Total Calls', value: total }, ...cards];
  }

  return [
    { key: 'total', label: 'Total Calls', value: total },
    { key: 'answered', label: 'Answered (page)', value: pageAnswered },
    { key: 'noAnswer', label: 'No Answer (page)', value: pageNoAnswer },
  ];
}

function unwrapBody(data: unknown): Record<string, unknown> | unknown[] {
  if (Array.isArray(data)) return data;
  const root = asRecord(data);
  const nested = asRecord(root.payload);
  if (Object.keys(nested).length) return nested;
  const nestedData = asRecord(root.data);
  if (Object.keys(nestedData).length) return nestedData;
  return root;
}

export function extractGtelDispositions(data: unknown): string[] {
  const body = unwrapBody(data);
  const list = Array.isArray(body)
    ? body
    : Array.isArray(asRecord(body).dispositions)
      ? (asRecord(body).dispositions as unknown[])
      : [];
  return list
    .map((item) =>
      typeof item === 'string'
        ? item
        : String(
            asRecord(item).name ?? asRecord(item).label ?? asRecord(item).value ?? '',
          ),
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectRawExtensions(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectRawExtensions(item));
  return String(value)
    .split(/[,\s|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toIntegerExtension(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'null') return null;
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (trimmed.includes('_')) {
    const suffix = trimmed.split('_').pop()?.trim() || '';
    if (/^\d+$/.test(suffix)) return suffix;
  }
  return trimmed.match(/\d+/)?.[0] || null;
}

export function getNumericExtension(extensionId: unknown): string {
  if (Array.isArray(extensionId)) {
    const found = extensionId.find((v) => /^\d+$/.test(String(v)));
    return found != null ? String(found) : '';
  }
  return toIntegerExtension(String(extensionId ?? '')) || '';
}

/** Extract integer extensions from `/SubAdmin/subadmins-by-role` byRole payload. */
export function extractGtelExtensions(data: unknown): string[] {
  const body = unwrapBody(data);
  const byRole = Array.isArray(asRecord(body).byRole)
    ? (asRecord(body).byRole as Record<string, unknown>[])
    : [];
  const extensions = new Set<string>();
  for (const role of byRole) {
    if (!CALLER_ROLE_IDS.has(String(role?.roleId || ''))) continue;
    const subAdmins = Array.isArray(role?.subAdmins) ? role.subAdmins : [];
    for (const admin of subAdmins) {
      const rec = asRecord(admin);
      for (const raw of [
        ...collectRawExtensions(rec.extensionId),
        ...collectRawExtensions(rec.extensionNo),
      ]) {
        const ext = toIntegerExtension(raw);
        if (ext) extensions.add(ext);
      }
    }
  }
  return Array.from(extensions).sort((a, b) => Number(a) - Number(b));
}

export function buildGtelCallsQuery(args: {
  pageNo: number;
  itemsPerPage: number;
  filters: GtelFilters;
  canShowMobile: boolean;
  shouldLockEmpCode: boolean;
  loginEmpCode: string;
  isCaller: boolean;
  loginExtensionId: string;
}): Record<string, string | number> {
  const { filters } = args;
  const params: Record<string, string | number> = {
    pageNo: args.pageNo,
    itemsPerPage: args.itemsPerPage,
  };
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.extension.trim()) params.extension = filters.extension.trim();
  if (args.canShowMobile && filters.phoneNumber.trim()) {
    params.phoneNumber = filters.phoneNumber.trim();
  }
  if (filters.disposition) params.disposition = filters.disposition;
  const empCodeFilter = args.shouldLockEmpCode
    ? args.loginEmpCode
    : filters.empCode.trim();
  if (empCodeFilter) params.empCode = empCodeFilter;
  if (
    empCodeFilter &&
    (args.shouldLockEmpCode || args.isCaller) &&
    args.loginExtensionId
  ) {
    params.extensionId = Number(args.loginExtensionId);
    if (!filters.extension.trim()) params.extension = args.loginExtensionId;
  }
  return params;
}

export function normalizeGtelCallsPage(
  data: unknown,
  itemsPerPage: number,
  empCodeFilter?: string,
): GtelCallsPage {
  const body = unwrapBody(data);
  const payload = Array.isArray(body) ? {} : body;
  const items = Array.isArray(body)
    ? body
    : Array.isArray(payload.items)
      ? payload.items
      : [];
  const rows = (items as GtelCall[]).filter((call) => call && typeof call === 'object');
  const filtered = empCodeFilter
    ? rows.filter(
        (call) => String(call?.empCode || call?.emp_code || '').trim() === empCodeFilter,
      )
    : rows;
  const total = Number(payload.total ?? filtered.length) || 0;
  const totalPages =
    Number(payload.totalPages) ||
    Math.max(1, Math.ceil(total / Math.max(1, itemsPerPage)) || 1);
  return {
    rows: filtered,
    total,
    totalPages: Math.max(1, totalPages),
    summary: extractGtelSummary(payload, data),
  };
}

export function createGtelCallId(): string {
  return `c2c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeGtelPhone(phone: unknown): string {
  return String(phone ?? '').replace(/\D/g, '');
}

export function emptyGtelFilters(today: string, lockedEmpCode = ''): GtelFilters {
  return {
    from: today,
    to: today,
    extension: '',
    phoneNumber: '',
    disposition: '',
    empCode: lockedEmpCode,
  };
}
