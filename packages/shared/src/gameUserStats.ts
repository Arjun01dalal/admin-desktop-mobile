/**
 * Game Activity → per-game user stats (POST /Qtech/user-stats-by-game).
 * Shared by desktop GameUserStatsPage and mobile GameUserStatsScreen.
 */

export const QTECH_USER_STATS_PROVIDER = 'Qtech' as const;

export type GameUserStatRow = Record<string, unknown>;

export type GameUserStatsSortKey =
  'betAmount' | 'betCount' | 'winAmount' | 'winCount' | 'rtp' | 'ggr';

export type GameUserStatsSortConfig = {
  key: GameUserStatsSortKey;
  direction: 'asc' | 'desc';
};

export type GameUserStatsSummary = {
  bet: number;
  win: number;
  ggr: number;
};

export type UserStatsByGamePayload = {
  gameId: string;
  provider: typeof QTECH_USER_STATS_PROVIDER;
  startDate: string;
  endDate: string;
};

/** EVO-crazytime → { label: "Crazy Time", prefix: "EVO", id: "EVO-crazytime" } */
export function formatGameDisplay(raw: string): {
  label: string;
  prefix: string;
  id: string;
} {
  const id = String(raw || '').trim();
  if (!id) return { label: '—', prefix: '', id: '' };

  const dashIndex = id.indexOf('-');
  const prefix = dashIndex > 0 ? id.slice(0, dashIndex) : '';
  const namePart = dashIndex > 0 ? id.slice(dashIndex + 1) : id;

  const label = namePart
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return { label: label || id, prefix: prefix.toUpperCase(), id };
}

export function resolveGameId(game: Record<string, unknown> | null | undefined): string {
  if (!game) return '';
  return String(game.gameId || game.Name || game.name || '').trim();
}

export function resolveGameName(game: Record<string, unknown> | null | undefined): string {
  if (!game) return '';
  return String(game.Name || game.name || game.gameId || '').trim();
}

export function buildUserStatsByGamePayload(
  gameId: string,
  startDate: string,
  endDate: string,
): UserStatsByGamePayload {
  return {
    gameId: String(gameId || '').trim(),
    provider: QTECH_USER_STATS_PROVIDER,
    startDate: String(startDate || '').trim(),
    endDate: String(endDate || '').trim(),
  };
}

export function formatGameUserStatNumber(value: unknown, digits = 2): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(num) ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

/** Unwrap common encrypted/envelope shapes into a user-stats list. */
export function extractUserStatsList(decrypted: unknown): GameUserStatRow[] {
  if (Array.isArray(decrypted)) return decrypted as GameUserStatRow[];
  if (!decrypted || typeof decrypted !== 'object') return [];

  const root = decrypted as Record<string, unknown>;
  const payload =
    root.payload && typeof root.payload === 'object' && !Array.isArray(root.payload)
      ? (root.payload as Record<string, unknown>)
      : null;
  const data =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;

  const candidates = [
    root.payload,
    root.data,
    root.items,
    root.users,
    root.result,
    root.list,
    payload?.users,
    payload?.items,
    payload?.data,
    payload?.list,
    data?.users,
    data?.items,
    data?.payload,
    data?.list,
  ];

  for (const candidate of candidates) {
    const list = asArray(candidate);
    if (list) return list as GameUserStatRow[];
  }
  return [];
}

export function gameUserStatBet(item: GameUserStatRow): number {
  return Number(
    item.totalBetAmount ??
      item.betAmount ??
      item.totalAmount ??
      (item.combined as Record<string, unknown> | undefined)?.totalAmount ??
      0,
  );
}

export function gameUserStatWin(item: GameUserStatRow): number {
  return Number(
    item.totalWinAmount ??
      item.winAmount ??
      (item.combined as Record<string, unknown> | undefined)?.winAmount ??
      0,
  );
}

export function gameUserStatBetCount(item: GameUserStatRow): number {
  return Number(
    item.betCount ??
      item.totalBets ??
      (item.combined as Record<string, unknown> | undefined)?.totalBets ??
      0,
  );
}

export function gameUserStatWinCount(item: GameUserStatRow): number {
  return Number(
    item.winCount ??
      item.totalWins ??
      (item.combined as Record<string, unknown> | undefined)?.totalWins ??
      0,
  );
}

export function gameUserStatRtp(item: GameUserStatRow): number {
  return Number(
    item.rtp ?? (item.combined as Record<string, unknown> | undefined)?.winPercentage ?? 0,
  );
}

export function gameUserStatGgr(item: GameUserStatRow): number {
  return gameUserStatBet(item) - gameUserStatWin(item);
}

export function gameUserStatUserId(item: GameUserStatRow): string {
  const id = item.userId ?? item.user_id;
  return id == null || id === '' ? '—' : String(id);
}

export function gameUserStatUserName(item: GameUserStatRow): string {
  const userId = gameUserStatUserId(item);
  return String(item.name || item.userName || item.username || userId);
}

function sortValue(item: GameUserStatRow, key: GameUserStatsSortKey): number {
  switch (key) {
    case 'betAmount':
      return gameUserStatBet(item);
    case 'betCount':
      return gameUserStatBetCount(item);
    case 'winAmount':
      return gameUserStatWin(item);
    case 'winCount':
      return gameUserStatWinCount(item);
    case 'rtp':
      return gameUserStatRtp(item);
    case 'ggr':
      return gameUserStatGgr(item);
    default:
      return 0;
  }
}

export function nextGameUserStatsSort(
  prev: GameUserStatsSortConfig | null,
  key: GameUserStatsSortKey,
): GameUserStatsSortConfig {
  if (prev?.key === key) {
    return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'desc' };
}

export function sortArrowFor(
  sort: GameUserStatsSortConfig | null,
  key: GameUserStatsSortKey,
): string {
  if (!sort || sort.key !== key) return '⬍';
  return sort.direction === 'asc' ? '⬆' : '⬇';
}

export function sortGameUserStats(
  data: GameUserStatRow[],
  sort: GameUserStatsSortConfig | null,
): GameUserStatRow[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const valA = sortValue(a, sort.key);
    const valB = sortValue(b, sort.key);
    return sort.direction === 'asc' ? valA - valB : valB - valA;
  });
}

export function summarizeGameUserStats(data: GameUserStatRow[]): GameUserStatsSummary {
  return data.reduce<GameUserStatsSummary>(
    (acc, item) => {
      acc.bet += gameUserStatBet(item);
      acc.win += gameUserStatWin(item);
      acc.ggr += gameUserStatGgr(item);
      return acc;
    },
    { bet: 0, win: 0, ggr: 0 },
  );
}
