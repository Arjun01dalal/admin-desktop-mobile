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
  lastSecondActivity?: unknown;
  previousActivity?: unknown;
  prevActivity?: unknown;
  played?: unknown;
  empCode?: unknown;
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

export type AutomationBotCallsTotals = {
  successful: number;
  unsuccessful: number;
  total: number;
};

/** Bot key subtracted from Active Customer (By Bots) and hidden from chips. */
export const UNIQUE_PENDING_DEPOSIT_BOT_KEY = 'unique_pending_deposit';

/** On-demand unique-pending bot — also hidden from chips and excluded from total. */
export const UNIQUE_PENDING_DEPOSIT_ONDEMAND_BOT_KEY = 'unique_pending_deposit_ondemand';

/** Bot keys that must not appear in chips and must not count toward the display total. */
export const HIDDEN_ACTIVE_BOT_SUMMARY_KEYS = new Set([
  UNIQUE_PENDING_DEPOSIT_BOT_KEY,
  UNIQUE_PENDING_DEPOSIT_ONDEMAND_BOT_KEY,
]);

export function normalizeAutomationBotKey(bot: unknown): string {
  return String(bot || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function isHiddenActiveBotSummaryKey(bot: unknown): boolean {
  return HIDDEN_ACTIVE_BOT_SUMMARY_KEYS.has(normalizeAutomationBotKey(bot));
}

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
  const key = normalizeAutomationBotKey(bot);
  if (key === 'new_user') return 'New Register';
  if (key === UNIQUE_PENDING_DEPOSIT_BOT_KEY) return 'Unique Pending Deposit';
  if (key === UNIQUE_PENDING_DEPOSIT_ONDEMAND_BOT_KEY) {
    return 'Unique Pending Deposit Ondemand';
  }
  return String(bot || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getActiveBotCountByType(
  summary: ActiveBotSummaryItem[],
  ...names: string[]
): number {
  const keys = new Set(names.map((n) => normalizeAutomationBotKey(n)));
  const match = summary.find((b) => keys.has(normalizeAutomationBotKey(b?.bot)));
  return Number(match?.count) || 0;
}

export function getUniquePendingDepositBotCount(
  summary: readonly ActiveBotSummaryItem[] | null | undefined,
): number {
  return getActiveBotCountByType(
    Array.isArray(summary) ? [...summary] : [],
    UNIQUE_PENDING_DEPOSIT_BOT_KEY,
  );
}

/** Sum of all bot counts that are excluded from the display total. */
export function getHiddenActiveBotSummaryCount(
  summary: readonly ActiveBotSummaryItem[] | null | undefined,
): number {
  let sum = 0;
  for (const item of summary || []) {
    if (isHiddenActiveBotSummaryKey(item?.bot)) sum += Number(item?.count) || 0;
  }
  return sum;
}

/**
 * Display count = max(0, total − hidden unique-pending bots).
 * Excludes `unique_pending_deposit` and `unique_pending_deposit_ondemand`.
 */
export function displayedActiveBotUsersCount(
  total: unknown,
  summary: readonly ActiveBotSummaryItem[] | null | undefined,
): number {
  return Math.max(0, (Number(total) || 0) - getHiddenActiveBotSummaryCount(summary));
}

/** Chip row — hide unique-pending bot keys (still subtracted from the display total). */
export function visibleActiveBotSummary(
  summary: readonly ActiveBotSummaryItem[] | null | undefined,
): ActiveBotSummaryItem[] {
  return (summary || []).filter((b) => !isHiddenActiveBotSummaryKey(b?.bot));
}

export function automationBotCallsTotals(
  summary: AutomationBotCallsSummary | null | undefined,
): AutomationBotCallsTotals {
  const bots = summary?.bots || [];
  let successful = 0;
  let unsuccessful = 0;
  let total = 0;
  for (const item of bots) {
    successful += Number(item?.successful) || 0;
    unsuccessful += Number(item?.unsuccessful) || 0;
    total += Number(item?.total) || 0;
  }
  return {
    successful,
    unsuccessful,
    total: Number(summary?.total) || total,
  };
}

/** API expects DD/MM/YYYY for automation-bot-calls-summary. */
export function toDdMmYyyy(isoDate: string): string {
  const parts = String(isoDate || '').split('-');
  if (parts.length !== 3) return String(isoDate || '');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Yesterday IST as YYYY-MM-DD — max selectable Previous Activity date. */
export function previousActivityMaxDateIST(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - 1);
  return ist.toISOString().slice(0, 10);
}

export function toDateKeyIST(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const d = new Date(value as string | number | Date);
  if (!Number.isFinite(d.getTime())) return '';
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export function filterActiveBotUsers(
  rows: readonly ActiveBotUserRow[],
  opts: { botType?: string; previousActivityDate?: string } = {},
): ActiveBotUserRow[] {
  const botType = String(opts.botType || '').trim();
  const prevDate = String(opts.previousActivityDate || '').trim();
  return rows.filter((row) => {
    if (botType && String(row.botType || '') !== botType) return false;
    if (prevDate) {
      const key = toDateKeyIST(
        row.lastSecondActivity ?? row.previousActivity ?? row.prevActivity,
      );
      if (key !== prevDate) return false;
    }
    return true;
  });
}
