/**
 * Caller Responsibility — automation-bot payload helpers
 * (admin-panel-domains activeBotUsers + automation-bot-calls-summary).
 */

export type ActiveBotUserRow = Record<string, unknown> & {
  botType?: string;
  botIds?: unknown;
  name?: string;
  userName?: string;
  mobile?: string;
  userMobile?: string;
};

export type ActiveBotSummaryItem = { bot: string; count: number };

export type FlattenedActiveBotUsers = {
  users: ActiveBotUserRow[];
  total: number;
  bots: Array<{ bot?: string; count?: number; users?: ActiveBotUserRow[] }>;
  summary: ActiveBotSummaryItem[];
};

export type AutomationBotCallItem = {
  bot: string;
  successful: number;
  unsuccessful: number;
  total: number;
};

export type AutomationBotCallsSummary = {
  startDate: string;
  endDate: string;
  bots: AutomationBotCallItem[];
  total: number;
};

/** New API: payload.bots[].users — also supports legacy payload.users */
export function flattenActiveBotUsersPayload(payload: unknown): FlattenedActiveBotUsers {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const bots = Array.isArray(root.bots) ? root.bots : [];
  if (bots.length) {
    const users = bots.flatMap((bot) => {
      const b = (bot && typeof bot === 'object' ? bot : {}) as Record<string, unknown>;
      const list = Array.isArray(b.users) ? b.users : [];
      return list.map((user) => ({
        ...(user && typeof user === 'object' ? (user as Record<string, unknown>) : {}),
        botType: String(b.bot || ''),
      }));
    });
    const summary = bots.map((bot) => {
      const b = (bot && typeof bot === 'object' ? bot : {}) as Record<string, unknown>;
      const list = Array.isArray(b.users) ? b.users : [];
      return {
        bot: String(b.bot || ''),
        count: Number(b.count ?? list.length) || 0,
      };
    });
    return {
      users,
      total: Number(root.total ?? users.length) || 0,
      bots: bots as FlattenedActiveBotUsers['bots'],
      summary,
    };
  }
  const users = Array.isArray(root.users) ? (root.users as ActiveBotUserRow[]) : [];
  return {
    users,
    total: Number(root.total ?? users.length) || 0,
    bots: [],
    summary: [],
  };
}

export function parseAutomationBotCallsSummary(body: unknown): AutomationBotCallsSummary {
  let payload: unknown = body;
  if (payload && typeof payload === 'object') {
    const o = payload as Record<string, unknown>;
    payload = o.payload ?? o.data ?? o;
  }
  if (payload && typeof payload === 'object' && 'payload' in (payload as object)) {
    payload = (payload as { payload?: unknown }).payload;
  }
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const botsRaw = Array.isArray(root.bots) ? root.bots : [];
  const bots = botsRaw.map((item) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    return {
      bot: String(row.bot || row.name || '—'),
      successful: Number(row.successful ?? 0) || 0,
      unsuccessful: Number(row.unsuccessful ?? 0) || 0,
      total: Number(row.total ?? 0) || 0,
    };
  });
  const total = bots.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  return {
    startDate: String(root.startDate || ''),
    endDate: String(root.endDate || ''),
    bots,
    total,
  };
}

/** Display label for bot keys (new_user → New Register). */
export function formatAutomationBotLabel(bot: string): string {
  const key = String(bot || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'new_user') return 'New Register';
  return String(bot || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getActiveBotCountByType(
  summary: ActiveBotSummaryItem[],
  ...names: string[]
): number {
  const keys = new Set(names.map((n) => String(n || '').toLowerCase().replace(/\s+/g, '_')));
  const match = summary.find((b) =>
    keys.has(String(b?.bot || '').toLowerCase().replace(/\s+/g, '_')),
  );
  return Number(match?.count) || 0;
}

/** API expects DD/MM/YYYY for automation-bot-calls-summary. */
export function toDdMmYyyy(isoDate: string): string {
  const parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return String(isoDate || '');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
