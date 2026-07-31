import { formatAmount } from '@/utils/dates';

export type ActivityRow = Record<string, unknown>;

export type SortKey =
  | 'betAmount'
  | 'betCount'
  | 'commissionAmount'
  | 'commissionCount'
  | 'rtp'
  | 'ggr'
  | 'winAmount'
  | 'totalRollbackAmount'
  | 'rollbackAmount';

export type SortConfig = { key: SortKey; direction: 'asc' | 'desc' };

function totalsOf(item: ActivityRow): ActivityRow {
  return (item.totals || {}) as ActivityRow;
}

/** Numeric field used for display + sorting (WCO flat + QTech / totals nested). */
export function getMetric(item: ActivityRow, key: SortKey | string): number {
  const totals = totalsOf(item);
  switch (key) {
    case 'betAmount':
      return Number(item.totalBetAmount ?? totals.betAmount ?? 0);
    case 'betCount':
      return Number(item.betCount ?? totals.betCount ?? 0);
    case 'commissionAmount':
      return Number(item.commissionAmount ?? totals.commissionAmount ?? 0);
    case 'commissionCount':
      return Number(item.commissionCount ?? totals.commissionCount ?? 0);
    case 'rtp':
      return Number(item.rtp ?? totals.rtp ?? 0);
    case 'ggr': {
      const hasFlat =
        item.totalBetAmount != null || item.totalWinAmount != null;
      if (hasFlat) {
        return Number(item.totalBetAmount ?? 0) - Number(item.totalWinAmount ?? 0);
      }
      return Number(totals.betAmount ?? 0) - Number(totals.winAmount ?? 0);
    }
    case 'winAmount':
      return Number(item.totalWinAmount ?? totals.winAmount ?? 0);
    case 'totalRollbackAmount':
    case 'rollbackAmount':
      return Number(
        item.totalRollbackAmount ?? totals.rollbackAmount ?? totals.totalRollbackAmount ?? 0,
      );
    default:
      return 0;
  }
}

export function providerLabel(item: ActivityRow): string {
  return String(item.provider || item.providerName || item.name || '-');
}

export function userIdOf(item: ActivityRow): string {
  return String(item.userId || item._id || '');
}

export function gameCount(item: ActivityRow): number {
  const games = item.games;
  return Array.isArray(games) ? games.length : 0;
}

export function betCount(item: ActivityRow): number {
  return getMetric(item, 'betCount');
}

export function commissionCount(item: ActivityRow): number {
  return getMetric(item, 'commissionCount');
}

export function winCount(item: ActivityRow): number {
  return Number(item.winCount ?? totalsOf(item).winCount ?? 0);
}

export function rollbackCount(item: ActivityRow): number {
  return Number(
    item.rollbackCount ?? totalsOf(item).rollbackCount ?? 0,
  );
}

export function formatMetric(value: number): string | number {
  return formatAmount(value);
}

export function formatGgr(value: number): string {
  return String(formatAmount(value));
}

/** Normalize secureApi payload for WCO `{ items }` or QTech array. */
export function normalizeActivityList(payload: unknown): ActivityRow[] {
  if (Array.isArray(payload)) return payload as ActivityRow[];
  if (payload && typeof payload === 'object') {
    const obj = payload as { items?: ActivityRow[]; payload?: ActivityRow[] };
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.payload)) return obj.payload;
  }
  return [];
}

export function sortActivityRows(
  rows: ActivityRow[],
  sort: SortConfig | null,
): ActivityRow[] {
  if (!sort) return rows;
  const { key, direction } = sort;
  return [...rows].sort((a, b) => {
    const av = getMetric(a, key);
    const bv = getMetric(b, key);
    return direction === 'asc' ? av - bv : bv - av;
  });
}

export function nextSortConfig(
  prev: SortConfig | null,
  key: SortKey,
): SortConfig {
  if (prev?.key === key) {
    return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

export function sortArrow(sort: SortConfig | null, key: SortKey): string {
  if (sort?.key !== key) return '⬍';
  return sort.direction === 'asc' ? '⬆' : '⬇';
}
