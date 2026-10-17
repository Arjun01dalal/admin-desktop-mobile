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

/** Status bucket used by mobile/desktop summary filter chips. */
export type GtelStatusFilter = '' | 'answered' | 'noAnswer' | 'failed' | 'pending';

export type GtelFilters = {
  from: string;
  to: string;
  extension: string;
  phoneNumber: string;
  disposition: string;
  empCode: string;
  /** Dialer status bucket — sent as statusByDialer when set. */
  status: GtelStatusFilter;
};

export const GTEL_STATUS_FILTER_CARDS: {
  key: Exclude<GtelStatusFilter, ''>;
  label: string;
  /** Value sent to GET /dialer/calls?statusByDialer= */
  apiValue: string;
}[] = [
  { key: 'answered', label: 'Answered', apiValue: 'ANSWER' },
  { key: 'noAnswer', label: 'No Answer', apiValue: 'NO ANSWER' },
  { key: 'failed', label: 'Failed', apiValue: 'FAILED' },
  { key: 'pending', label: 'Pending', apiValue: 'PENDING' },
];

/** Match a call row to a summary status bucket (status + statusByDialer). */
export function gtelCallMatchesStatus(
  call: GtelCall,
  filter: GtelStatusFilter,
): boolean {
  if (!filter) return true;
  const raw = `${call.statusByDialer || ''} ${call.status || ''}`.toUpperCase();
  if (filter === 'answered') {
    return raw.includes('ANSWER') && !raw.includes('NO');
  }
  if (filter === 'noAnswer') {
    return (
      raw.includes('NO ANSWER') ||
      raw.includes('NOANSWER') ||
      raw.includes('NO_ANSWER')
    );
  }
  if (filter === 'failed') return raw.includes('FAIL');
  if (filter === 'pending') {
    return (
      raw.includes('PEND') ||
      raw.includes('RING') ||
      raw.includes('QUEUE') ||
      raw.includes('INIT')
    );
  }
  return true;
}

/** Pick summary count for a status bucket from API summary / cards. */
export function gtelSummaryCountForStatus(
  summary: Record<string, unknown> | null,
  cards: GtelSummaryCard[],
  key: Exclude<GtelStatusFilter, ''>,
): number {
  const aliases: Record<Exclude<GtelStatusFilter, ''>, string[]> = {
    answered: ['answered', 'answeredcount', 'answer', 'answeredcalls'],
    noAnswer: ['noanswer', 'noanswercount', 'no_answer', 'notanswered'],
    failed: ['failed', 'failedcount', 'fail'],
    pending: ['pending', 'pendingcount', 'ringing', 'queued'],
  };
  const wanted = new Set(aliases[key]);
  for (const card of cards) {
    const norm = card.key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (wanted.has(norm)) return Number(card.value) || 0;
  }
  if (summary) {
    for (const [k, v] of Object.entries(summary)) {
      const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (wanted.has(norm) && Number.isFinite(Number(v))) return Number(v);
    }
  }
  return 0;
}

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

function nestedCustomer(call: GtelCall): Record<string, unknown> {
  for (const key of ['customer', 'Customer', 'user', 'User', 'client', 'Client'] as const) {
    const nested = call[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return {};
}

function pickCallField(call: GtelCall, keys: string[]): unknown {
  const customer = nestedCustomer(call);
  for (const key of keys) {
    const nested = customer[key];
    if (nested != null && String(nested).trim() !== '') return nested;
  }
  for (const key of keys) {
    const direct = call[key];
    if (direct != null && String(direct).trim() !== '') return direct;
  }
  return null;
}

export function getGtelUsername(call: GtelCall): string {
  return gtelDisplay(
    pickCallField(call, ['username', 'userName', 'name', 'clientName', 'fullName']),
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
  // Prefer nested customer/user id — avoid top-level call `_id` (admin CallerCallsModal).
  return gtelDisplay(
    pickCallField(call, ['dpid', 'dpi_id', 'dp_id', 'dpId', 'userId', '_id', 'id']),
    call.user?.dpid,
    call.user?.dpi_id,
    call.user?.dp_id,
    call.user?._id,
    call.dpi_id,
    call.dp_id,
    call.userId,
  );
}

export function getGtelCallId(call: GtelCall): string {
  return gtelDisplay(call.callId, call.dialerUniqueId, (call as { sid?: unknown }).sid, call._id);
}

export type GtelVerticalCode = 'E' | 'C' | 'S';

const VERTICAL_LABELS: Record<GtelVerticalCode, string> = {
  E: 'Exch Players',
  C: 'Casino Players',
  S: 'SM Players',
};

function labelVerticalCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper === 'E' || upper === 'C' || upper === 'S') {
    return VERTICAL_LABELS[upper as GtelVerticalCode];
  }
  return code.trim();
}

/** Parse customer.played → unique E/C/S codes (admin CallerCallsModal). */
export function getGtelPlayedVerticals(call: GtelCall): GtelVerticalCode[] {
  const raw = pickCallField(call, ['played', 'isPlayed', 'hasPlayed']);
  const codes = new Set<GtelVerticalCode>();
  const add = (item: unknown) => {
    const code = String(item ?? '')
      .trim()
      .toUpperCase();
    if (code === 'E' || code === 'C' || code === 'S') codes.add(code);
  };
  if (Array.isArray(raw)) {
    raw.forEach(add);
  } else if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) parsed.forEach(add);
      } catch {
        t.split(/[,|\s]+/).forEach(add);
      }
    } else {
      t.split(/[,|\s]+/).forEach(add);
    }
  }
  return (['E', 'C', 'S'] as const).filter((v) => codes.has(v));
}

export function getGtelPlayedLabel(call: GtelCall): string {
  const verts = getGtelPlayedVerticals(call);
  if (!verts.length) return '—';
  return verts.map((v) => VERTICAL_LABELS[v]).join(', ');
}

function isTruthyFlag(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  const t = String(value).trim().toLowerCase();
  if (!t) return false;
  return !['false', '0', 'no', 'n', 'null', 'undefined', '—', '-'].includes(t);
}

/** Personal connection compliance flagged CX/call. */
export function isGtelFlaggedCall(call: GtelCall): boolean {
  if (
    isTruthyFlag(
      pickCallField(call, [
        'flagged',
        'isFlagged',
        'personalConnectionFlagged',
        'personalConnectFlagged',
        'complianceFlagged',
      ]),
    )
  ) {
    return true;
  }
  if (
    isTruthyFlag(
      pickCallField(call, ['personalConnectIntent', 'personal_connect_intent', 'personalConnect']),
    )
  ) {
    return true;
  }
  return isTruthyFlag(
    pickCallField(call, ['personalConnectCategories', 'personal_connect_categories']),
  );
}

export function getGtelPersonalConnectIntent(call: GtelCall): string {
  const value = pickCallField(call, [
    'personalConnectIntent',
    'personal_connect_intent',
    'personalConnect',
  ]);
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v ?? '').trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }
  const text = String(value).trim();
  return text || '—';
}

export function getGtelCallSource(call: GtelCall): string {
  return gtelDisplay(
    pickCallField(call, [
      'source',
      'callSource',
      'allotmentType',
      'allotment_type',
      'origin',
      'channel',
    ]),
  );
}

/** Unique CX counts by vertical / flagged — admin Caller Calls CX Summary. */
export function buildGtelCxSummaryCounts(calls: GtelCall[]): {
  E: number;
  C: number;
  S: number;
  flagged: number;
} {
  const sets: Record<GtelVerticalCode, Set<string>> = {
    E: new Set(),
    C: new Set(),
    S: new Set(),
  };
  const flaggedIds = new Set<string>();
  calls.forEach((call, index) => {
    const id =
      getGtelDpiId(call) !== '—'
        ? getGtelDpiId(call)
        : gtelDisplay(call.phoneNumber, getGtelUsername(call), `row:${index}`);
    for (const vert of getGtelPlayedVerticals(call)) sets[vert].add(id);
    if (isGtelFlaggedCall(call)) flaggedIds.add(id);
  });
  return {
    E: sets.E.size,
    C: sets.C.size,
    S: sets.S.size,
    flagged: flaggedIds.size,
  };
}

export { VERTICAL_LABELS as GTEL_VERTICAL_LABELS, labelVerticalCode as gtelLabelVerticalCode };

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
  const intent = getGtelPersonalConnectIntent(call);
  if (intent !== '—') return { empty: false, text: intent };
  const raw =
    pickCallField(call, ['personalConnectCategories', 'personal_connect_categories']) ??
    call.personalConnectCategories;
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
  if (filters.status) {
    const card = GTEL_STATUS_FILTER_CARDS.find((c) => c.key === filters.status);
    if (card) params.statusByDialer = card.apiValue;
  }
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

/** Pull a single call from GET /dialer/calls?callId=… payload. */
export function extractGtelCallById(payload: unknown, callId: string): GtelCall | null {
  const wanted = String(callId || '').trim();
  if (!wanted) return null;

  const asList = (value: unknown): GtelCall[] => {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is GtelCall => !!item && typeof item === 'object' && !Array.isArray(item),
    );
  };

  const matchCall = (row: GtelCall) => {
    const id = String(row.callId ?? (row as { call_id?: unknown }).call_id ?? row._id ?? '').trim();
    return Boolean(id && id === wanted);
  };

  const body = unwrapBody(payload);
  if (Array.isArray(body)) {
    const rows = asList(body);
    return rows.find(matchCall) || rows[0] || null;
  }

  const record = asRecord(body);
  for (const key of ['items', 'calls', 'data', 'rows', 'docs', 'results'] as const) {
    const rows = asList(record[key]);
    if (!rows.length) continue;
    return rows.find(matchCall) || rows[0] || null;
  }
  if (matchCall(record as GtelCall)) return record as GtelCall;
  return null;
}

export function pickGtelRecordingUrl(call: GtelCall | Record<string, unknown> | null): string {
  if (!call) return '';
  const raw =
    call.recordingUrl ??
    (call as { recording_url?: unknown }).recording_url ??
    (call as { recording?: unknown }).recording ??
    (call as { RecordingUrl?: unknown }).RecordingUrl;
  return raw != null ? String(raw).trim() : '';
}

export function pickGtelTranscription(call: GtelCall | Record<string, unknown> | null): string {
  if (!call) return '';
  const raw =
    call.transcription ??
    (call as { transcript?: unknown }).transcript ??
    (call as { Transcription?: unknown }).Transcription ??
    (call as { summary?: unknown }).summary;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return '';
    }
  }
  return String(raw).trim();
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
    status: '',
  };
}
