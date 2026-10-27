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

/** Match a call row to a summary status bucket (prefer statusByDialer). */
export function gtelCallMatchesStatus(
  call: GtelCall,
  filter: GtelStatusFilter,
): boolean {
  if (!filter) return true;
  const primary = String(call.statusByDialer || call.status || '')
    .toUpperCase()
    .trim();
  const isNoAnswer =
    primary.includes('NO ANSWER') ||
    primary.includes('NOANSWER') ||
    primary.includes('NO_ANSWER') ||
    primary === 'NOANSWER';
  if (filter === 'noAnswer') return isNoAnswer;
  if (filter === 'answered') {
    return !isNoAnswer && primary.includes('ANSWER');
  }
  if (filter === 'failed') return primary.includes('FAIL');
  if (filter === 'pending') {
    return (
      primary.includes('PEND') ||
      primary.includes('RING') ||
      primary.includes('QUEUE') ||
      primary.includes('INIT')
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

/**
 * Legacy admin-panel mobile bypasses (parity with web).
 * Prefer responsibility flags (`show_mobile` / `show_c2cBtn`). These constants
 * remain until ops migrates those accounts onto real permissions — do not add more.
 */
export const GTEL_SHOW_MOBILE_OVERRIDE = '9676849375';
export const GTEL_SHOW_C2C_OVERRIDE = '8956381336';

/** Gate: `show_mobile` responsibility or tracked legacy override mobile. */
export function canShowGtelMobile(user: PermissionUser | null | undefined): boolean {
  if (hasPermission(Permissions.show_mobile, user ?? null)) return true;
  const mobile = String(user?.mobile || '').trim();
  return mobile === GTEL_SHOW_MOBILE_OVERRIDE;
}

/** Gate: `show_c2cBtn` responsibility or tracked legacy override mobile. */
export function canShowGtelC2c(user: PermissionUser | null | undefined): boolean {
  if (hasPermission(Permissions.show_c2cBtn, user ?? null)) return true;
  const mobile = String(user?.mobile || '').trim();
  return mobile === GTEL_SHOW_C2C_OVERRIDE;
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

function dispositionListFrom(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const obj = asRecord(value);
  for (const key of [
    'dispositions',
    'disposition',
    'items',
    'list',
    'rows',
    'data',
    'payload',
    'result',
  ] as const) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return null;
}

/** Parse GET /dialer/dispositions — tolerates nested / encrypted envelopes. */
export function extractGtelDispositions(data: unknown): string[] {
  const candidates: unknown[] = [data, unwrapBody(data)];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const root = asRecord(data);
    candidates.push(root.data, root.payload, root.result, asRecord(root.data).payload);
  }

  let list: unknown[] = [];
  for (const candidate of candidates) {
    const found = dispositionListFrom(candidate);
    if (found?.length) {
      list = found;
      break;
    }
    if (found && !list.length) list = found;
  }

  return list
    .map((item) =>
      typeof item === 'string'
        ? item
        : String(
            asRecord(item).name ??
              asRecord(item).label ??
              asRecord(item).value ??
              asRecord(item).disposition ??
              '',
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

/* —— Active Call / Click2Call helpers (admin-panel Click2CallBtn parity) —— */

export type GtelCallQuickStatus = {
  callId: string;
  answered: boolean;
  hangup: boolean;
};

export type GtelPreviousNote = {
  text: string;
  callId?: string;
  callAt?: string;
  by?: string;
};

export type GtelC2cTarget = {
  phoneNumber: string;
  userId?: string;
  userName?: string;
  appName?: string;
  lastActivity?: string;
  balance?: string | number;
  bonusBalance?: string | number;
  campaignDataId?: string;
  source?: 'Manual' | 'Campaign';
  isProspect?: boolean;
  /** Override dialer extension (e.g. KYC / Incoming Bot). */
  extensionId?: string;
  /** Hide Redial; next click starts a fresh call. */
  disableRedial?: boolean;
};

function toQuickBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value ?? '')
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function pickQuickStatusSource(body: unknown): Record<string, unknown> {
  const root = asRecord(body);
  const raw = root.data ?? root.payload ?? body;
  const resolved =
    typeof raw === 'string'
      ? (() => {
          try {
            return asRecord(JSON.parse(raw));
          } catch {
            return {};
          }
        })()
      : asRecord(raw);
  if ('answered' in resolved || 'hangup' in resolved || 'callId' in resolved) {
    return resolved;
  }
  const nested = asRecord(resolved.data ?? resolved.payload);
  return Object.keys(nested).length ? nested : resolved;
}

/** Parse GET /dialer/call/{callId}/quick-status payload. */
export function parseGtelQuickStatus(
  data: unknown,
  fallbackCallId = '',
): GtelCallQuickStatus | null {
  const payload = pickQuickStatusSource(data);
  if (!Object.keys(payload).length && !fallbackCallId) return null;
  return {
    callId: String(payload.callId || fallbackCallId).trim(),
    answered: toQuickBool(payload.answered),
    hangup: toQuickBool(payload.hangup),
  };
}

export function isNoActiveCallError(message?: string | null): boolean {
  return /no active call/i.test(String(message || ''));
}

export function formatGtelCallElapsed(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** Formal Active Call UI phase (replaces ad-hoc boolean soup at the call site). */
export type GtelActiveCallPhase = 'dialing' | 'active' | 'hangupForm' | 'redial' | 'ended';

export function deriveGtelActiveCallPhase(args: {
  starting: boolean;
  callId: string;
  ended: boolean;
  showRedial: boolean;
  confirmHangup: boolean;
}): GtelActiveCallPhase {
  if (args.ended) return 'ended';
  if (args.starting && !args.callId) return 'dialing';
  if (args.showRedial) return 'redial';
  if (args.confirmHangup) return 'hangupForm';
  return 'active';
}

export function gtelActiveCallStatusTone(args: {
  phase: GtelActiveCallPhase;
  answered?: boolean;
  hangup?: boolean;
}): string {
  if (args.phase === 'ended' || args.hangup) return '#ef4444';
  if (args.answered) return '#22c55e';
  return '#f59e0b';
}

export function gtelActiveCallStatusLabel(args: {
  phase: GtelActiveCallPhase;
  answered?: boolean;
  hangup?: boolean;
}): string {
  if (args.phase === 'ended') return 'Ended';
  if (args.hangup) return 'Hangup';
  if (args.answered) return 'Answered';
  if (args.phase === 'dialing') return 'Connecting…';
  if (args.phase === 'redial') return 'Redial';
  return 'Calling';
}

/** True when disposition response is a soft-success (already locked on dialer). */
export function isDispositionAlreadySetMessage(message?: string | null): boolean {
  return /already set|cannot be changed/i.test(String(message || ''));
}

/** Confirm Hang Up enabled only when call + disposition are ready. */
export function canConfirmGtelHangup(args: {
  callId?: string | null;
  disposition?: string | null;
  hangingUp?: boolean;
}): boolean {
  return Boolean(String(args.callId || '').trim() && String(args.disposition || '').trim() && !args.hangingUp);
}

/** datetime-local `2026-10-14T18:30` → IST string `2026-10-14 18:30`. */
export function formatCallbackDueAtIst(datetimeLocal?: string): string {
  const value = String(datetimeLocal || '').trim();
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 16);
}

export function normalizeDispositionLabel(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isGreenDisposition(value?: string | null): boolean {
  const normalized = normalizeDispositionLabel(value);
  if (!normalized) return false;
  if (GREEN_DISPOSITIONS.has(normalized)) return true;
  for (const item of GREEN_DISPOSITIONS) {
    if (normalizeDispositionLabel(item) === normalized) return true;
  }
  return false;
}

export function formatGtelBalanceDisplay(value?: string | number | null): string {
  if (value == null || value === '') return '—';
  const num = Number(String(value).replace(/,/g, '').trim());
  if (!Number.isNaN(num)) return String(Math.floor(num));
  return String(value);
}

export function isNegativeGtelBalance(value?: string | number | null): boolean {
  if (value == null || value === '') return false;
  const num = Number(String(value).replace(/,/g, '').trim());
  return !Number.isNaN(num) && num < 0;
}

export function formatPreviousNoteCallAt(value?: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

export function parsePreviousNote(value: unknown): GtelPreviousNote | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { text } : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { text: String(value) };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parsePreviousNote(item);
      if (parsed?.text) return parsed;
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const text = String(
      obj.text ?? obj.note ?? obj.notes ?? obj.message ?? obj.comment ?? '',
    ).trim();
    const callId = String(obj.callId ?? obj.call_id ?? '').trim() || undefined;
    const callAt = String(obj.callAt ?? obj.call_at ?? '').trim() || undefined;
    const by = String(obj.by ?? obj.byUserId ?? obj.userId ?? '').trim() || undefined;
    if (text || callId || callAt || by) {
      return { text: text || '—', callId, callAt, by };
    }
    const nested = obj.previousNote ?? obj.previousNotes ?? obj.lastNote;
    if (nested != null && nested !== value) return parsePreviousNote(nested);
  }
  return null;
}

export function formatPreviousNoteValue(value: unknown): string {
  const parsed = parsePreviousNote(value);
  if (!parsed) return '';
  const lines = [parsed.text];
  const when = formatPreviousNoteCallAt(parsed.callAt);
  if (when) lines.push(when);
  return lines.filter(Boolean).join('\n');
}

function previousNoteCandidates(source: unknown): unknown[] {
  if (!source || typeof source !== 'object') return [];
  const row = source as Record<string, unknown>;
  const nested =
    (row.data && typeof row.data === 'object' ? row.data : null) ||
    (row.payload && typeof row.payload === 'object' ? row.payload : null) ||
    (row.call && typeof row.call === 'object' ? row.call : null) ||
    (row.campaignData && typeof row.campaignData === 'object' ? row.campaignData : null);

  return [
    row.previousNote,
    row.previousNotes,
    row.previous_note,
    row.lastNote,
    row.lastNotes,
    nested && (nested as Record<string, unknown>).previousNote,
    nested && (nested as Record<string, unknown>).previousNotes,
    nested && (nested as Record<string, unknown>).previous_note,
    nested && (nested as Record<string, unknown>).lastNote,
  ];
}

/** Pick previousNote `{ text, callId, callAt, by }` from dialer / campaign payloads. */
export function extractPreviousNoteDetails(...sources: unknown[]): GtelPreviousNote | null {
  for (const source of sources) {
    for (const candidate of previousNoteCandidates(source)) {
      const parsed = parsePreviousNote(candidate);
      if (parsed && (parsed.text || parsed.callAt)) return parsed;
    }
  }
  return null;
}

export function extractPreviousNote(...sources: unknown[]): string {
  const details = extractPreviousNoteDetails(...sources);
  return details ? formatPreviousNoteValue(details) : '';
}

/** Build click-to-call POST body (Manual / Campaign / Prospect). */
export function buildGtelClickToCallBody(args: {
  callId: string;
  phone: string;
  extension: string;
  subAdminId: string;
  target: GtelC2cTarget;
}): Record<string, unknown> {
  const { callId, phone, extension, subAdminId, target } = args;
  const isCampaign = Boolean(target.campaignDataId);
  if (target.isProspect) {
    return {
      callId,
      phoneNumber: phone,
      isProspect: true,
      source: target.source || 'Manual',
      extension,
    };
  }
  if (isCampaign) {
    return {
      callId,
      phoneNumber: phone,
      campaignDataId: target.campaignDataId,
      source: target.source || 'Campaign',
      userId: target.userId || '',
    };
  }
  return {
    callId,
    phoneNumber: phone,
    extension,
    userId: target.userId || '',
    subAdminId,
    source: target.source || 'Manual',
  };
}
