/**
 * WhatsApp inbox — shared types and parsers.
 * Mirrors admin-panel-domains WhatsappView (chat list + per-thread messages + Exotel send).
 * Desktop and mobile keep their own UI; this module is logic only.
 */

export const WHATSAPP_POLL_INTERVAL_MS = 8_000;
export const WHATSAPP_CHAT_LIST_PAGE_SIZE = 25;
export const WHATSAPP_MESSAGE_PAGE_SIZE = 100;
export const WHATSAPP_SEARCH_DEBOUNCE_MS = 400;
export const WHATSAPP_NEAR_TOP_PX = 60;
export const WHATSAPP_NEAR_BOTTOM_PX = 80;
export const WHATSAPP_OPTIMISTIC_TTL_MS = 20_000;

export type CallbackType = 'incoming_message' | 'outgoing_message' | 'dlr' | string;

export type WhatsappTextContent = {
  type: 'text';
  text: { body: string };
};

export type WhatsappImageContent = {
  type: 'image';
  image: { url: string; caption?: string; s3_url?: string };
};

export type WhatsappAudioContent = {
  type: 'audio';
  audio: { url?: string; s3_url?: string };
};

export type WhatsappContent = WhatsappTextContent | WhatsappImageContent | WhatsappAudioContent;

export type WhatsappMessage = {
  callback_type: CallbackType;
  from?: string;
  to?: string;
  timestamp: string;
  profile_name?: string;
  description?: string;
  content?: WhatsappContent & { profile_name?: string };
  _id?: string;
  sid?: string;
};

export type GroupedChats = Record<string, WhatsappMessage[]>;

export type ChatListItem = {
  phone: string;
  profileName: string;
  preview: string;
  timestamp: string;
};

export type ChatSummary = ChatListItem & {
  lastMessage: WhatsappMessage;
};

export type MessageView =
  | { kind: 'text'; text: string }
  | { kind: 'image'; src: string; caption: string }
  | { kind: 'audio'; src: string };

export type ExotelSendBody =
  | { to: string; mobile: string; type: 'text'; text: string }
  | { to: string; mobile: string; type: 'image'; image: string; caption: string };

export type ExotelSendPlan =
  | { ok: true; to: string; body: ExotelSendBody; optimistic: WhatsappMessage }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = readString(value).trim();
    if (text) return text;
  }
  return '';
}

function readFinite(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone.trim();
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

/** Last 10 digits — treats +91 / 91 / raw as the same mobile. */
export function phoneDigits(phone?: string | null): string {
  return String(phone || '')
    .replace(/\D/g, '')
    .slice(-10);
}

/** 10-digit mobile for chat-list and status-callback payloads. */
export function toApiMobile(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(-10);
  return digits || phone.trim();
}

export function formatWhatsappTo(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

export function isIncoming(msg: WhatsappMessage): boolean {
  return msg.callback_type === 'incoming_message';
}

export function isDlr(msg: WhatsappMessage): boolean {
  return String(msg.callback_type || '').toLowerCase() === 'dlr';
}

export function getWhatsappMessageId(msg: WhatsappMessage, index = 0): string {
  return (
    msg._id ||
    msg.sid ||
    `${msg.timestamp}-${msg.callback_type}-${msg.from || ''}-${msg.to || ''}-${index}`
  );
}

export function getMessageKey(msg: WhatsappMessage, index: number): string {
  return getWhatsappMessageId(msg, index);
}

function extractArray(decrypted: unknown): unknown[] {
  if (Array.isArray(decrypted)) return decrypted;
  const data = asRecord(decrypted);
  if (!data) return [];
  const payload = asRecord(data.payload);
  if (payload && Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(data.payload)) return data.payload;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.chats)) return data.chats;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function asMessage(value: unknown): WhatsappMessage | null {
  const row = asRecord(value);
  if (!row) return null;
  const callbackType = readString(row.callback_type);
  const timestamp = firstString(row.timestamp, row.created_at, row.updated_at);
  return {
    ...(row as unknown as WhatsappMessage),
    callback_type: callbackType,
    timestamp,
  };
}

/** Status-callback rows with delivery receipts removed. */
export function extractWhatsappMessagesWithMeta(decrypted: unknown): {
  messages: WhatsappMessage[];
  rawCount: number;
} {
  const raw = extractArray(decrypted)
    .map(asMessage)
    .filter((msg): msg is WhatsappMessage => msg !== null);
  return {
    rawCount: raw.length,
    messages: raw.filter((msg) => !isDlr(msg)),
  };
}

function previewFromUnknown(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const msg = asRecord(value);
  if (!msg) return '';
  const direct = firstString(msg.preview, msg.body, msg.description);
  if (direct) return direct;
  if (typeof msg.text === 'string') return msg.text;
  const text = asRecord(msg.text);
  if (text && typeof text.body === 'string') return text.body;
  const content = asRecord(msg.content);
  const type = readString(msg.type) || readString(content?.type);
  if (type === 'image') {
    const image = asRecord(msg.image) || asRecord(content?.image);
    const caption = readString(image?.caption).trim();
    return caption ? `📷 ${caption}` : '📷 Photo';
  }
  if (type === 'audio') return '🎵 Audio';
  if (content) return getMessagePreview(content as unknown as WhatsappMessage);
  return '';
}

export function mapChatListItems(decrypted: unknown): ChatListItem[] {
  const items: ChatListItem[] = [];
  const seen = new Set<string>();
  for (const raw of extractArray(decrypted)) {
    const item = asRecord(raw);
    if (!item) continue;
    const phone = firstString(item.mobile, item.phone, item.from, item.wa_id, item.number);
    if (!phone) continue;
    const key = phoneDigits(phone) || phone;
    if (seen.has(key)) continue;
    seen.add(key);
    const lastMessage = item.last_message ?? item.lastMessage ?? item.message ?? item.content;
    const preview =
      previewFromUnknown(lastMessage) ||
      previewFromUnknown(item.preview) ||
      previewFromUnknown(item.description);
    items.push({
      phone,
      profileName: firstString(item.profile_name, item.profileName, item.name) || phone,
      preview,
      timestamp: firstString(
        item.created_at,
        item.timestamp,
        item.updated_at,
        item.last_message_at,
        item.lastMessageAt,
      ),
    });
  }
  return items;
}

export function extractChatListPayload(
  decrypted: unknown,
  itemsPerPage = WHATSAPP_CHAT_LIST_PAGE_SIZE,
): { items: ChatListItem[]; total: number; totalPages: number } {
  const items = mapChatListItems(decrypted);
  const root = asRecord(decrypted) ?? {};
  const payload = asRecord(root.payload) ?? root;
  const total =
    readFinite(
      payload.total ?? payload.totalCount ?? payload.count ?? payload.totalRecords ?? root.total,
    ) ?? items.length;
  const totalPagesRaw =
    readFinite(payload.totalPages ?? payload.pages ?? payload.pageCount ?? root.totalPages) ??
    (total > 0 ? Math.ceil(total / itemsPerPage) : 1);

  return {
    items,
    total: total > 0 ? total : items.length,
    totalPages: Math.max(1, totalPagesRaw),
  };
}

export function buildChatListRequest(query: string, page: number): Record<string, unknown> {
  const trimmed = query.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');
  const looksLikeMobile = digitsOnly.length >= 7;
  return {
    filter: {
      mobile: looksLikeMobile ? digitsOnly.slice(-10) : '',
      profile_name: looksLikeMobile ? '' : trimmed,
    },
    pageNo: page,
    itemsPerPage: WHATSAPP_CHAT_LIST_PAGE_SIZE,
  };
}

export function buildMessageRequest(phone: string, skip: number): Record<string, unknown> {
  return {
    phone: toApiMobile(phone),
    limit: WHATSAPP_MESSAGE_PAGE_SIZE,
    skip,
  };
}

export function mergeChatListPage(prev: ChatListItem[], next: ChatListItem[]): ChatListItem[] {
  const seen = new Set(prev.map((chat) => normalizePhone(chat.phone)));
  const merged = [...prev];
  for (const item of next) {
    const key = normalizePhone(item.phone);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

export function filterChatList(chats: ChatListItem[], query: string): ChatListItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return chats;
  return chats.filter(
    ({ phone, profileName, preview }) =>
      phone.toLowerCase().includes(needle) ||
      profileName.toLowerCase().includes(needle) ||
      preview.toLowerCase().includes(needle),
  );
}

export function getProfileName(messages: WhatsappMessage[], phone: string): string {
  const withName = [...messages].reverse().find((m) => m.profile_name || m.content?.profile_name);
  return withName?.profile_name || withName?.content?.profile_name || phone;
}

export function getMessagePreview(msg: WhatsappMessage): string {
  const content = msg.content;
  if (!content) return msg.description || '';
  switch (content.type) {
    case 'text':
      return content.text?.body || '';
    case 'image': {
      const caption = content.image?.caption?.trim();
      return caption ? `📷 ${caption}` : '📷 Photo';
    }
    case 'audio':
      return '🎵 Audio';
    default:
      return msg.description || '';
  }
}

export function presentMessage(msg: WhatsappMessage): MessageView {
  const content = msg.content;
  if (content?.type === 'text') {
    return { kind: 'text', text: content.text?.body || '' };
  }
  if (content?.type === 'image') {
    return {
      kind: 'image',
      src: content.image?.s3_url || content.image?.url || '',
      caption: content.image?.caption?.trim() || '',
    };
  }
  if (content?.type === 'audio') {
    return {
      kind: 'audio',
      src: content.audio?.s3_url || content.audio?.url || '',
    };
  }
  const extra = msg as WhatsappMessage & {
    text?: { body?: string } | string;
    body?: string;
    message?: string;
  };
  if (msg.description) return { kind: 'text', text: msg.description };
  if (typeof extra.text === 'string' && extra.text) return { kind: 'text', text: extra.text };
  if (extra.text && typeof extra.text === 'object' && extra.text.body) {
    return { kind: 'text', text: extra.text.body };
  }
  if (typeof extra.body === 'string' && extra.body) return { kind: 'text', text: extra.body };
  if (typeof extra.message === 'string' && extra.message) {
    return { kind: 'text', text: extra.message };
  }
  return { kind: 'text', text: msg.callback_type || 'Message' };
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function parseTimestamp(timestamp: string): Date | null {
  if (!timestamp) return null;
  const date = /^\d+$/.test(timestamp) ? new Date(Number(timestamp)) : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMessageTime(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  if (!date) return timestamp;
  const now = new Date();
  if (sameCalendarDay(date, now)) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatListTime(timestamp: string): string {
  return formatMessageTime(timestamp);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name || '?').slice(-2).toUpperCase();
}

function sameOutgoingBody(api: WhatsappMessage, local: WhatsappMessage): boolean {
  if (api.content?.type !== local.content?.type) return false;
  if (api.content?.type === 'text' && local.content?.type === 'text') {
    return api.content.text.body === local.content.text.body;
  }
  if (api.content?.type === 'image' && local.content?.type === 'image') {
    return (api.content.image.caption || '') === (local.content.image.caption || '');
  }
  return false;
}

/** Keep just-sent rows until the status-callback API echoes them. */
export function mergeOptimisticOutgoing(
  apiMsgs: WhatsappMessage[],
  localMsgs: WhatsappMessage[],
  now = Date.now(),
): WhatsappMessage[] {
  const pending = localMsgs.filter((local) => {
    if (local.callback_type !== 'outgoing_message') return false;
    const age = now - new Date(local.timestamp).getTime();
    if (Number.isNaN(age) || age < 0 || age > WHATSAPP_OPTIMISTIC_TTL_MS) return false;
    return !apiMsgs.some(
      (api) => api.callback_type === 'outgoing_message' && sameOutgoingBody(api, local),
    );
  });
  if (pending.length === 0) return apiMsgs;
  return [...apiMsgs, ...pending].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function sortMessages(messages: WhatsappMessage[]): WhatsappMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export function prependUniqueMessages(
  existing: WhatsappMessage[],
  older: WhatsappMessage[],
): WhatsappMessage[] | null {
  const seen = new Set(existing.map((msg, index) => getWhatsappMessageId(msg, index)));
  const olderOnly = older.filter((msg, index) => !seen.has(getWhatsappMessageId(msg, index)));
  if (olderOnly.length === 0) return null;
  return sortMessages([...olderOnly, ...existing]);
}

export function mergePolledMessages(
  existing: WhatsappMessage[],
  latest: WhatsappMessage[],
): WhatsappMessage[] | null {
  const latestIds = new Set(latest.map((msg, index) => getWhatsappMessageId(msg, index)));
  const preservedOlder = existing.filter(
    (msg, index) => !latestIds.has(getWhatsappMessageId(msg, index)),
  );
  const merged = mergeOptimisticOutgoing([...preservedOlder, ...latest], existing);
  const unchanged =
    merged.length === existing.length &&
    merged.every(
      (msg, index) => getWhatsappMessageId(msg, index) === getWhatsappMessageId(existing[index], index),
    );
  return unchanged ? null : sortMessages(merged);
}

/**
 * Exotel send must be plain JSON with top-level `to` and `mobile`.
 * An encrypted body drops `to` and the backend broadcasts.
 */
export function buildExotelWhatsappSend(input: {
  recipient: string;
  text: string;
  image: string | null;
  now?: string;
}): ExotelSendPlan {
  const to = formatWhatsappTo(input.recipient);
  const mobile = toApiMobile(input.recipient);
  if (!to || mobile.replace(/\D/g, '').length < 10) {
    return { ok: false, error: 'Invalid recipient. Open a chat and try again.' };
  }
  const timestamp = input.now ?? new Date().toISOString();
  if (input.image) {
    const caption = input.text.trim();
    return {
      ok: true,
      to,
      body: {
        to,
        mobile,
        type: 'image',
        image: input.image,
        caption,
      },
      optimistic: {
        callback_type: 'outgoing_message',
        to,
        timestamp,
        content: {
          type: 'image',
          image: {
            url: input.image,
            s3_url: input.image,
            caption: caption || undefined,
          },
        },
      },
    };
  }
  return {
    ok: true,
    to,
    body: { to, mobile, type: 'text', text: input.text },
    optimistic: {
      callback_type: 'outgoing_message',
      to,
      timestamp,
      content: { type: 'text', text: { body: input.text } },
    },
  };
}

export function chatMatchesSelection(phone: string, selectedUser: string | null): boolean {
  if (!selectedUser) return false;
  return selectedUser === phone || selectedUser === normalizePhone(phone);
}
