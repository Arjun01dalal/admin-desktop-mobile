/**
 * Incoming Bot Call helpers — parity with Laxmi admin-panel-domains
 * (`getAll-exotel` single list + optional `/sync`).
 */
export type IncomingBotCallerComment = {
  comment?: string;
  date?: string;
  createdOn?: string;
  createdAt?: string;
  who?: { userId?: string; userName?: string; name?: string };
  userName?: string;
  commented_by?: string;
  [key: string]: unknown;
};

/** Raw row from `/incoming-bot-call/getAll-exotel`. */
export type IncomingBotCallUser = {
  _id?: string;
  id?: string;
  doc_id?: string;
  phone?: string;
  mobile?: string;
  from?: string;
  to?: string;
  direction?: string;
  status?: string;
  start_time?: string;
  startTime?: string;
  duration?: string | number;
  recording_url?: string | null;
  recordingUrl?: string | null;
  client_name?: string;
  clientName?: string;
  name?: string;
  state?: string;
  city?: string;
  dp_id?: string;
  dpId?: string;
  userId?: string;
  app_name?: string;
  sid?: string;
  createdOn?: string;
  createdAt?: string;
  created_on?: string;
  comments?: IncomingBotCallerComment[] | string | IncomingBotCallerComment;
  comment?: IncomingBotCallerComment[] | string | IncomingBotCallerComment;
  [key: string]: unknown;
};

/** Table / card row after mapping getAll-exotel. */
export type IncomingBotCallRow = {
  sid: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  start_time: string;
  duration: string;
  recording_url: string | null;
  name?: string;
  state?: string;
  city?: string;
  dp_id?: string;
  app_name?: string;
  mobile?: string;
  doc_id?: string;
  comments?: IncomingBotCallerComment[];
};

export type IncomingBotMatchedUser = {
  name: string;
  state: string;
  city: string;
  dp_id: string;
  app_name: string;
  mobile: string;
  /** Mongo id of incoming-bot-call row — used for add-comment when present */
  doc_id: string;
  comments: IncomingBotCallerComment[];
};

export type IncomingBotSyncStats = {
  fetched: number;
  updated: number;
  inserted: number;
  skipped: number;
};

/** Normalize phone — handles 0..., 91..., +91... */
export function normalizeIncomingBotPhone(value?: string | null): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('91') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits.replace(/^0+/, '');
}

/** Match key: last 10 digits after normalizing +91 / 91 / 0 */
export function incomingBotPhoneMatchKey(value?: string | null): string {
  return normalizeIncomingBotPhone(value).slice(-10);
}

export function todayIncomingBotDateInputValue(): string {
  return new Date().toISOString().split('T')[0]!;
}

/** Earliest selectable day is the 23rd of the current month (Laxmi parity). */
export function incomingBotMinDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-23`;
}

/** Default selected date: today, but never before the 23rd min. */
export function incomingBotDefaultDateInputValue(): string {
  const today = todayIncomingBotDateInputValue();
  const min = incomingBotMinDateInputValue();
  return today < min ? min : today;
}

/** @deprecated Prefer getAll-exotel date range; kept for callers still using since/until. */
export function getIncomingBotUntilFromSinceDate(sinceDate: string): string {
  const until = new Date(`${sinceDate}T00:00:00.000Z`);
  until.setUTCDate(until.getUTCDate() + 1);
  return until.toISOString();
}

export function extractIncomingBotCallUsers(decrypted: unknown): IncomingBotCallUser[] {
  if (Array.isArray(decrypted)) return decrypted as IncomingBotCallUser[];
  if (!decrypted || typeof decrypted !== 'object') return [];
  const data = decrypted as Record<string, any>;

  const candidates = [
    data.payload?.items,
    data.payload?.list,
    data.payload?.calls,
    data.payload?.data,
    data.payload,
    data.items,
    data.list,
    data.calls,
    data.data?.items,
    data.data,
    data.result,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as IncomingBotCallUser[];
  }
  return [];
}

function extractComments(user: IncomingBotCallUser): IncomingBotCallerComment[] {
  const raw: unknown = user.comments ?? user.comment;
  if (!raw) return [];
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? [{ comment: text }] : [];
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return { comment: item };
        if (item && typeof item === 'object') {
          const obj = item as IncomingBotCallerComment & {
            text?: string;
            message?: string;
          };
          return {
            ...obj,
            comment: obj.comment || String(obj.text || obj.message || ''),
          };
        }
        return null;
      })
      .filter(Boolean) as IncomingBotCallerComment[];
  }
  if (typeof raw === 'object') {
    const obj = raw as IncomingBotCallerComment & {
      text?: string;
      message?: string;
    };
    return [
      {
        ...obj,
        comment: obj.comment || String(obj.text || obj.message || ''),
      },
    ];
  }
  return [];
}

function toMatchedUser(user: IncomingBotCallUser, mobile: string): IncomingBotMatchedUser {
  return {
    name: String(user.client_name || user.name || ''),
    state: String(user.state || ''),
    city: String(user.city || ''),
    dp_id: String(user.userId || user.dp_id || user.dpId || ''),
    app_name: String(user.app_name || user.clientName || ''),
    mobile,
    doc_id: String(user._id || user.doc_id || user.id || ''),
    comments: extractComments(user),
  };
}

export function buildIncomingBotUserMapByPhone(
  users: IncomingBotCallUser[],
): Map<string, IncomingBotMatchedUser> {
  const map = new Map<string, IncomingBotMatchedUser>();
  for (const user of users) {
    const mobile = String(user.phone || user.mobile || '');
    const key = incomingBotPhoneMatchKey(mobile);
    if (!key) continue;
    map.set(key, toMatchedUser(user, mobile));
  }
  return map;
}

/** Secondary match when phone fails — legacy getAll merge. */
export function buildIncomingBotUserMapBySid(
  users: IncomingBotCallUser[],
): Map<string, IncomingBotMatchedUser> {
  const map = new Map<string, IncomingBotMatchedUser>();
  for (const user of users) {
    const sid = String(user.sid || '').trim();
    if (!sid) continue;
    const mobile = String(user.phone || user.mobile || '');
    map.set(sid, toMatchedUser(user, mobile));
  }
  return map;
}

export function enrichIncomingCallsWithUsers<T extends { from?: string; sid?: string }>(
  calls: T[],
  userMapByPhone: Map<string, IncomingBotMatchedUser>,
  userMapBySid?: Map<string, IncomingBotMatchedUser>,
): Array<T & Partial<IncomingBotMatchedUser>> {
  return calls.map((call) => {
    const matched =
      userMapByPhone.get(incomingBotPhoneMatchKey(call.from)) ||
      (call.sid ? userMapBySid?.get(String(call.sid)) : undefined);
    if (!matched) return call;
    return {
      ...call,
      name: matched.name || undefined,
      state: matched.state || undefined,
      city: matched.city || undefined,
      dp_id: matched.dp_id || undefined,
      app_name: matched.app_name || undefined,
      mobile: matched.mobile || undefined,
      doc_id: matched.doc_id || undefined,
      comments: matched.comments || [],
    };
  });
}

/** Map getAll-exotel row → table IncomingCall (no Exotel merge). */
export function mapIncomingBotUserToCall(user: IncomingBotCallUser): IncomingBotCallRow {
  const from = String(user.from || user.phone || user.mobile || '');
  const to = String(user.to || '');
  const sid = String(user.sid || user._id || '');
  const startTime = String(
    user.start_time || user.startTime || user.createdOn || user.createdAt || '',
  );
  const recording = user.recording_url ?? user.recordingUrl ?? null;

  return {
    sid,
    from,
    to,
    direction: String(user.direction || 'incoming'),
    status: String(user.status || ''),
    start_time: startTime,
    duration: String(user.duration ?? ''),
    recording_url: recording ? String(recording) : null,
    name: String(user.client_name || user.name || '') || undefined,
    state: String(user.state || '') || undefined,
    city: String(user.city || '') || undefined,
    dp_id: String(user.userId || user.dp_id || user.dpId || '') || undefined,
    app_name: String(user.app_name || user.clientName || '') || undefined,
    mobile: from || undefined,
    doc_id: String(user._id || '') || undefined,
    comments: extractComments(user),
  };
}

export function mapIncomingBotUsersToCalls(users: IncomingBotCallUser[]): IncomingBotCallRow[] {
  return users.map(mapIncomingBotUserToCall);
}

/**
 * After refresh, keep fresher local comments / doc_id if the list is briefly stale.
 */
export function mergeIncomingBotCallsPreservingComments(
  incoming: IncomingBotCallRow[],
  previous: IncomingBotCallRow[],
): IncomingBotCallRow[] {
  return incoming.map((call) => {
    const prevCall = previous.find(
      (p) =>
        (call.sid && p.sid === call.sid) || (call.doc_id && p.doc_id === call.doc_id),
    );
    if (!prevCall) return call;

    const incomingComments = call.comments || [];
    const previousComments = prevCall.comments || [];
    const mergedComments =
      incomingComments.length >= previousComments.length
        ? incomingComments
        : previousComments;

    return {
      ...call,
      doc_id: call.doc_id || prevCall.doc_id,
      comments: mergedComments,
    };
  });
}

/** Normalize `/incoming-bot-call/sync` response stats. */
export function parseIncomingBotSyncStats(data: unknown): IncomingBotSyncStats {
  let stats: any = data;
  if (stats && typeof stats === 'object' && stats.payload) {
    stats = stats.payload;
  }
  return {
    fetched: Number(stats?.fetched ?? 0),
    updated: Number(stats?.updated ?? 0),
    inserted: Number(stats?.inserted ?? 0),
    skipped: Number(stats?.skipped ?? 0),
  };
}

export function formatIncomingBotSyncToast(stats: IncomingBotSyncStats): string {
  return `Synced — fetched: ${stats.fetched}, updated: ${stats.updated}, inserted: ${stats.inserted}, skipped: ${stats.skipped}`;
}

/** Build sync body: startDate YYYY-MM-DD, endDate YYYY-MM-DD HH:mm:ss (local now). */
export function buildIncomingBotSyncPayload(startDate: string, endDate: string) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return {
    startDate,
    endDate: `${endDate} ${hh}:${mm}:${ss}`,
  };
}

/** Dial number for Call button — matched mobile, else last-10 from `from`. */
export function getIncomingBotCallMobile(call: {
  mobile?: string | null;
  from?: string | null;
}): string {
  const matched = String(call.mobile || '').trim();
  if (matched) return matched;
  return incomingBotPhoneMatchKey(call.from) || String(call.from || '');
}

/** Laxmi Incoming Bot Call dialer constants (api2.ganesha999.com). */
export const INCOMING_BOT_DIALER = {
  listId: '910001',
  listName: 'INCOMING BOT CALL',
  campaignId: 'BOT_INC',
  /** Maps to api2 via dialer server map */
  serverId: '1',
} as const;

export function formatIncomingBotCommentAuthor(c: IncomingBotCallerComment): string {
  return String(c.who?.userName || c.who?.name || c.userName || c.commented_by || '—');
}

export function formatIncomingBotCommentWhen(c: IncomingBotCallerComment): string {
  const raw = c.date || c.createdOn || c.createdAt;
  if (!raw) return '';
  try {
    return new Date(String(raw)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  } catch {
    return String(raw);
  }
}

/** After add-comment, keep local comment visible if list refresh lags. */
export function mergeIncomingBotCommentOntoCalls<
  T extends { sid?: string; doc_id?: string; comments?: IncomingBotCallerComment[] },
>(
  calls: T[],
  opts: {
    sid?: string;
    docId?: string;
    comment: IncomingBotCallerComment;
  },
): T[] {
  const sid = String(opts.sid || '').trim();
  const docId = String(opts.docId || '').trim();
  const text = String(opts.comment.comment || '').trim();
  if (!sid && !docId) return calls;

  return calls.map((call) => {
    const isTarget =
      (sid && call.sid === sid) || (docId && call.doc_id && call.doc_id === docId);
    if (!isTarget) return call;
    const existing = Array.isArray(call.comments) ? call.comments : [];
    const already = text
      ? existing.some((c) => String(c.comment || '').trim() === text)
      : false;
    return {
      ...call,
      doc_id: call.doc_id || docId || undefined,
      comments: already ? existing : [...existing, opts.comment],
    };
  });
}
