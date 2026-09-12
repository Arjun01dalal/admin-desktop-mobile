/** GGR alert helpers — shared desktop + mobile. */

export type GgrAlertType = '' | 'casino' | 'sattamatka';

export type GgrSubAdminOption = { id: string; label: string };

export type GgrRecipientsConfig = {
  subAdminIds: string[];
  telegramChatIds: number[];
  enabled: boolean;
  updatedBy?: { userId?: string; userName?: string };
  updatedAt?: string;
};

export type GgrAlertGame = {
  name?: string;
  gameId?: string | number;
  gameName?: string;
  providerName?: string;
  totalBetAmount?: number;
  totalWinAmount?: number;
  ggr?: number;
  [key: string]: unknown;
};

export type GgrAlertLogRow = {
  _id?: string;
  userId?: string;
  name?: string;
  clientName?: string;
  userBankName?: string;
  type?: string;
  balance?: number | string;
  totalBetAmount?: number;
  totalWinAmount?: number;
  ggr?: number | string;
  games?: GgrAlertGame[];
  createdOn?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export function todayIstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatGgrDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatGgrMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function ggrTone(value: unknown): 'neg' | 'pos' | 'flat' {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n < 0 ? 'neg' : 'pos';
}

function firstStr(...vals: unknown[]): string {
  for (const value of vals) {
    if (value === undefined || value === null || value === '') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

export function resolveGgrGameParts(game: GgrAlertGame): {
  gameId: string;
  gameName: string;
} {
  const explicitId = firstStr(
    game.gameId,
    game.GameId,
    game.game_id,
    game.gameID,
    game.providerGameId,
    game.gameCode,
  );
  const explicitName = firstStr(
    game.gameName,
    game.GameName,
    game.game_name,
    game.displayName,
    game.title,
  );
  const legacy = firstStr(game.name);
  const gameId = explicitId || legacy;
  const gameName =
    explicitName ||
    (explicitId && legacy && legacy !== explicitId ? legacy : '') ||
    (!explicitId ? legacy : '') ||
    gameId;
  return { gameId, gameName };
}

/** Unwrap common API envelopes: payload / data / items. */
function unwrapEnvelope(data: unknown): unknown {
  if (data == null) return data;
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object') return data;
  let cur: unknown = data;
  // Walk a few layers of { payload|data: ... } wrappers.
  for (let i = 0; i < 4; i++) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (Array.isArray(obj.items) || Array.isArray(obj.list) || Array.isArray(obj.logs) || Array.isArray(obj.records) || Array.isArray(obj.docs)) {
      return cur;
    }
    if (obj.recipients && typeof obj.recipients === 'object') return cur;
    if (Array.isArray(obj.subAdminIds) || Array.isArray(obj.telegramChatIds) || typeof obj.enabled === 'boolean') {
      return cur;
    }
    if (obj.payload !== undefined) {
      cur = obj.payload;
      continue;
    }
    if (obj.data !== undefined) {
      cur = obj.data;
      continue;
    }
    break;
  }
  return cur;
}

function pickList(obj: Record<string, unknown> | null): unknown[] {
  if (!obj) return [];
  for (const key of ['items', 'list', 'logs', 'records', 'docs', 'result']) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

export function normalizeGgrRecipients(payload: unknown): GgrRecipientsConfig {
  const unwrapped = unwrapEnvelope(payload);
  const obj =
    unwrapped && typeof unwrapped === 'object' && !Array.isArray(unwrapped)
      ? (unwrapped as Record<string, unknown>)
      : {};
  const src =
    obj.recipients && typeof obj.recipients === 'object'
      ? (obj.recipients as Record<string, unknown>)
      : obj;

  return {
    subAdminIds: Array.isArray(src.subAdminIds)
      ? src.subAdminIds.map((id) => String(id)).filter(Boolean)
      : [],
    telegramChatIds: Array.isArray(src.telegramChatIds)
      ? src.telegramChatIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [],
    enabled: Boolean(src.enabled),
    updatedBy:
      src.updatedBy && typeof src.updatedBy === 'object'
        ? (src.updatedBy as GgrRecipientsConfig['updatedBy'])
        : undefined,
    updatedAt:
      src.updatedAt != null
        ? String(src.updatedAt)
        : src.updatedOn != null
          ? String(src.updatedOn)
          : undefined,
  };
}

export function normalizeGgrLogs(
  data: unknown,
  perPage: number,
): { rows: GgrAlertLogRow[]; totalPages: number; total: number } {
  const unwrapped = unwrapEnvelope(data);
  if (Array.isArray(unwrapped)) {
    return { rows: unwrapped as GgrAlertLogRow[], totalPages: 1, total: unwrapped.length };
  }

  const root =
    unwrapped && typeof unwrapped === 'object'
      ? (unwrapped as Record<string, unknown>)
      : null;
  const nested =
    root?.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const list = Array.isArray(nested) ? nested : pickList(nested);
  const rows: GgrAlertLogRow[] = (Array.isArray(list) ? list : []).map((row) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    return {
      ...r,
      _id: r._id != null ? String(r._id) : undefined,
      userId: r.userId != null ? String(r.userId) : r.user_id != null ? String(r.user_id) : undefined,
      name: (r.name ?? r.userName ?? r.UserName) != null ? String(r.name ?? r.userName ?? r.UserName) : undefined,
      clientName:
        (r.clientName ?? r.client_name ?? r.client) != null
          ? String(r.clientName ?? r.client_name ?? r.client)
          : undefined,
      userBankName:
        (r.userBankName ?? r.bankName ?? r.bank_name ?? r.BankName) != null
          ? String(r.userBankName ?? r.bankName ?? r.bank_name ?? r.BankName)
          : undefined,
      type: r.type != null ? String(r.type) : undefined,
      balance: (r.balance ?? r.Balance) as number | string | undefined,
      totalBetAmount: (r.totalBetAmount ?? r.total_bet_amount ?? r.betAmount ?? r.bet) as
        | number
        | undefined,
      totalWinAmount: (r.totalWinAmount ?? r.total_win_amount ?? r.winAmount ?? r.win) as
        | number
        | undefined,
      ggr: (r.ggr ?? r.GGR ?? r.ggrAmount) as number | string | undefined,
      games: Array.isArray(r.games) ? (r.games as GgrAlertGame[]) : [],
      createdOn: r.createdOn != null ? String(r.createdOn) : undefined,
      createdAt:
        r.createdAt != null
          ? String(r.createdAt)
          : r.updatedAt != null
            ? String(r.updatedAt)
            : undefined,
    };
  });
  const totalPages = Math.max(
    1,
    Number(
      nested?.totalPages ??
        root?.totalPages ??
        (nested?.total ? Math.ceil(Number(nested.total) / Math.max(1, perPage)) : 1),
    ) || 1,
  );
  const total = Number(nested?.total ?? root?.total ?? rows.length) || rows.length;
  return { rows, totalPages, total };
}

export function unpackSubAdminOptions(data: unknown): GgrSubAdminOption[] {
  const root =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const payload =
    root?.payload && typeof root.payload === 'object'
      ? (root.payload as Record<string, unknown>)
      : root;
  const items = Array.isArray(payload?.items)
    ? payload!.items
    : Array.isArray(payload)
      ? payload
      : Array.isArray(data)
        ? data
        : [];

  return (items as Record<string, unknown>[])
    .filter((row) => row && row.block !== true && row.Block !== true)
    .map((row) => {
      const id = String(row._id || row.id || '').trim();
      if (!id) return null;
      const name = String(row.name || row.userName || '').trim();
      return { id, label: name || 'SubAdmin' };
    })
    .filter(Boolean) as GgrSubAdminOption[];
}
