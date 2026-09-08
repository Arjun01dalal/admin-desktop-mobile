/**
 * Phone matching + user enrichment for Incoming Bot Call
 * (Laxmi admin-panel-domains IncomingBotCall parity).
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

export type IncomingBotCallUser = {
  _id?: string;
  id?: string;
  doc_id?: string;
  phone?: string;
  mobile?: string;
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
  comments?: IncomingBotCallerComment[];
  comment?: IncomingBotCallerComment[];
  [key: string]: unknown;
};

export type IncomingBotMatchedUser = {
  name: string;
  state: string;
  city: string;
  dp_id: string;
  app_name: string;
  mobile: string;
  /** Mongo id of incoming-bot-call getAll row — used for add-comment when present */
  doc_id: string;
  comments: IncomingBotCallerComment[];
};

/** Create payload when call has no doc_id (Laxmi IncomingBotCall parity). */
export type IncomingBotCreatePayload = {
  phone: string;
  client_name: string;
  state: string;
  city: string;
  userId: string;
  app_name: string;
  sid: string;
};

export function buildIncomingBotCreatePayload(call: {
  sid?: string | null;
  mobile?: string | null;
  from?: string | null;
}): IncomingBotCreatePayload {
  return {
    phone: getIncomingBotCallMobile(call),
    client_name: 'sir',
    state: 'Madhya Pradesh',
    city: 'jabalpur',
    userId: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
    app_name: 'OS',
    sid: String(call.sid || ''),
  };
}

/** Extract `_id` from decrypted create / getAll-style payloads. */
export function extractIncomingBotDocId(data: unknown): string {
  if (!data) return '';
  if (typeof data === 'string') return data.trim();
  if (typeof data !== 'object') return '';
  const obj = data as Record<string, unknown>;
  const payload =
    obj.payload && typeof obj.payload === 'object'
      ? (obj.payload as Record<string, unknown>)
      : obj;
  const nested =
    (payload.item && typeof payload.item === 'object'
      ? (payload.item as Record<string, unknown>)
      : null) ||
    (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : null) ||
    payload;
  return String(nested._id || nested.id || payload._id || payload.id || obj._id || obj.id || '').trim();
}

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

/** until = from/since date plus 1 day, at 00:00:00.000Z */
export function getIncomingBotUntilFromSinceDate(sinceDate: string): string {
  const until = new Date(`${sinceDate}T00:00:00.000Z`);
  until.setUTCDate(until.getUTCDate() + 1);
  return until.toISOString();
}

export function extractIncomingBotCallUsers(decrypted: unknown): IncomingBotCallUser[] {
  if (Array.isArray(decrypted)) return decrypted as IncomingBotCallUser[];
  if (!decrypted || typeof decrypted !== 'object') return [];
  const data = decrypted as Record<string, unknown>;
  const payload = data.payload as Record<string, unknown> | unknown[] | undefined;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const items = (payload as Record<string, unknown>).items;
    if (Array.isArray(items)) return items as IncomingBotCallUser[];
  }
  if (Array.isArray(payload)) return payload as IncomingBotCallUser[];
  if (Array.isArray(data.items)) return data.items as IncomingBotCallUser[];
  if (Array.isArray(data.data)) return data.data as IncomingBotCallUser[];
  return [];
}

function extractComments(user: IncomingBotCallUser): IncomingBotCallerComment[] {
  const comments = user.comments || user.comment || [];
  return Array.isArray(comments) ? comments : [];
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

/** Secondary match when phone fails — Laxmi buildUserMapBySid. */
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
  return String(
    c.who?.userName || c.who?.name || c.userName || c.commented_by || '—',
  );
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

/** After create+comment, keep local comment visible if getAll refresh lags. */
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
