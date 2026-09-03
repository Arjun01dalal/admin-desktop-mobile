/**
 * Admin LLM Chat (Admin Assistant) — shared types + helpers.
 * Ported from admin-panel-domains AdminLlmChatWidget.
 */

export type LlmChatRole = 'user' | 'assistant' | 'system';

export type LlmChatMessage = {
  role: LlmChatRole;
  content: string;
  refused?: boolean;
  safeData?: unknown;
  collection?: string;
  /** Local-only: optimistic voice placeholder while Whisper runs. */
  _pendingVoiceId?: string;
};

export type LlmChatHistoryTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export type LlmDialerLead = {
  first_name: string;
  phone_number: string;
  city: string;
  state: string;
  email: string;
  comments: string;
  province: string;
};

export const LLM_CHAT_HISTORY_KEY = 'llm_chat_messages';
export const LLM_CHAT_OPEN_KEY = 'llm_chat_open';
export const LLM_CHAT_MAX_HISTORY = 12;

export function clearLlmChatStorage(storage: { removeItem: (key: string) => void }): void {
  storage.removeItem(LLM_CHAT_HISTORY_KEY);
  storage.removeItem(LLM_CHAT_OPEN_KEY);
}

export function historyForApi(messages: LlmChatMessage[]): LlmChatHistoryTurn[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-LLM_CHAT_MAX_HISTORY)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export function formatLlmCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asRows(data: unknown): Record<string, unknown>[] | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    if (data.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return data as Record<string, unknown>[];
    }
    return data.map((value) => ({ value }));
  }
  if (typeof data === 'object') return [data as Record<string, unknown>];
  return null;
}

/** Prefer server safeData (tables) over parsing answer text. */
export function rowsFromLlmPayload(
  content: string,
  safeData?: unknown,
): Record<string, unknown>[] | null {
  const fromSafe = asRows(safeData);
  if (fromSafe && fromSafe.length > 0) return fromSafe;

  const trimmed = String(content || '').trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return fromSafe;
  try {
    return asRows(JSON.parse(trimmed));
  } catch {
    return fromSafe;
  }
}

export function looksLikeUsersTable(rows: Record<string, unknown>[], collection?: string): boolean {
  if (collection === 'users') return true;
  if (collection && collection !== 'users') return false;
  const first = rows[0];
  if (!first || first._id == null) return false;
  if ('paymentType' in first || 'orderId' in first || 'dp_id' in first) {
    return false;
  }
  return (
    'empCode' in first ||
    'firstDepositDone' in first ||
    'activeUser' in first ||
    'dump' in first ||
    'name' in first
  );
}

export function collectUserIds(rows: Record<string, unknown>[]): string[] {
  return Array.from(
    new Set(
      rows
        .map((row) => row._id ?? row.id)
        .filter((id) => id != null && String(id).trim() !== '')
        .map((id) => String(id)),
    ),
  );
}

export function normalizeDialerLeads(payload: unknown): LlmDialerLead[] {
  const raw = payload as Record<string, unknown> | unknown[] | null;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.leads)
      ? raw.leads
      : Array.isArray(raw?.users)
        ? raw.users
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw?.records)
              ? raw.records
              : [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item: unknown) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const phone = row.phone_number || row.mobile || row.userMobile || row.phone || row.mobileNo;
      if (!phone) return null;
      return {
        first_name: String(row.first_name || row.name || row.userName || row.fullName || ''),
        phone_number: String(phone),
        city: String(row.city || ''),
        state: String(row.state || ''),
        email: String(row.email || row.clientName || ''),
        comments: String(row.comments || row.clientName || row.email || ''),
        province: String(row.province || row._id || row.userId || ''),
      };
    })
    .filter(Boolean) as LlmDialerLead[];
}

/** Match admin-panel getListIdForCampaign (9 + campaign suffix). */
export function getListIdForCampaign(campaignId: string): string {
  const key = String(campaignId || '').trim();
  if (!key) return '';
  if (key.includes('_')) {
    const suffix = key.split('_').pop() || key;
    return `9${suffix}`;
  }
  return `9${key}`;
}

export function columnsFromRows(rows: Record<string, unknown>[]): string[] {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return columns;
}

export type LlmSendPayload = {
  answer?: string;
  refused?: boolean;
  safeData?: unknown;
  collection?: string;
  transcript?: string;
  validationError?: string;
};

export function parseLlmSendResult(data: unknown): LlmSendPayload {
  if (!data || typeof data !== 'object') return {};
  return data as LlmSendPayload;
}
