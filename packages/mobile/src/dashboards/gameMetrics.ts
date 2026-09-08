import type { GameRow, MetricRow } from './types';
import { floorNum, toNum } from './mergeMetrics';
import { metricJyotishLabel } from './constants';

function asGames(raw: unknown): GameRow[] {
  if (Array.isArray(raw)) return raw as GameRow[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { payload?: unknown; data?: unknown };
    if (Array.isArray(obj.payload)) return obj.payload as GameRow[];
    if (Array.isArray(obj.data)) return obj.data as GameRow[];
  }
  return [];
}

export function gameNames(raw: unknown): string[] {
  return asGames(raw)
    .map((g) => String(g.gameName || '').trim())
    .filter(Boolean);
}

/** Aggregate or pick one game — matches Indian Diva / Plutus card logic. */
export function buildGameMetricRows(raw: unknown, selectedGame: string): MetricRow[] {
  const games = asGames(raw);
  const selected =
    selectedGame && selectedGame !== 'All' ? games.find((g) => g.gameName === selectedGame) : null;

  if (selected) {
    const bet = toNum(selected.totalBetAmount);
    const win = toNum(selected.totalWinningAmount);
    const rows: MetricRow[] = [
      { label: metricJyotishLabel('Total Bet Amount'), value: floorNum(bet) },
      { label: metricJyotishLabel('Total Win Amount'), value: floorNum(win) },
      { label: metricJyotishLabel('Total Bets'), value: floorNum(selected.totalBets) },
      { label: metricJyotishLabel('Total Wins'), value: floorNum(selected.totalWins) },
      { label: metricJyotishLabel('Total Profit'), value: floorNum(bet - win) },
      { label: metricJyotishLabel('RTP'), value: selected.RTP ?? 0 },
    ];
    return rows;
  }

  const totals = games.reduce(
    (acc, g) => {
      acc.bet += toNum(g.totalBetAmount);
      acc.win += toNum(g.totalWinningAmount);
      acc.bets += toNum(g.totalBets);
      acc.wins += toNum(g.totalWins);
      return acc;
    },
    { bet: 0, win: 0, bets: 0, wins: 0 } as {
      bet: number;
      win: number;
      bets: number;
      wins: number;
    },
  );

  return [
    { label: metricJyotishLabel('Total Bet Amount'), value: floorNum(totals.bet) },
    { label: metricJyotishLabel('Total Win Amount'), value: floorNum(totals.win) },
    { label: metricJyotishLabel('Total Bets'), value: floorNum(totals.bets) },
    { label: metricJyotishLabel('Total Wins'), value: floorNum(totals.wins) },
    {
      label: metricJyotishLabel('Total Profit'),
      value: floorNum(totals.bet - totals.win),
    },
  ];
}

export function parseLudoGameOptions(raw: unknown): { value: string; label: string }[] {
  const payload =
    raw && typeof raw === 'object'
      ? ((raw as { payload?: unknown; gameIds?: unknown; games?: unknown }).payload ?? raw)
      : raw;

  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Array.isArray((payload as { gameIds?: unknown }).gameIds)
        ? (payload as { gameIds: unknown[] }).gameIds
        : Array.isArray((payload as { games?: unknown }).games)
          ? (payload as { games: unknown[] }).games
          : []
      : [];

  return list
    .map((item) => {
      if (typeof item === 'string') return { value: item, label: item };
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const value = obj.gameId ?? obj.id ?? obj.value ?? obj.gameName;
      const label = obj.gameName ?? obj.name ?? obj.label ?? obj.gameId ?? obj.id;
      if (value == null) return null;
      return { value: String(value), label: String(label ?? value) };
    })
    .filter(Boolean) as { value: string; label: string }[];
}

export type LudoGameStats = {
  uniquePlayers: number;
  bet: number;
  win: number;
  ggr: number;
  rtp: number;
};

export function parseLudoGameStats(raw: unknown): LudoGameStats {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    uniquePlayers: Math.floor(toNum(obj.uniquePlayers)),
    bet: Math.floor(toNum(obj.playerBetAmount ?? obj.bet)),
    win: Math.floor(toNum(obj.playerWinAmount ?? obj.win)),
    ggr: Math.round(toNum(obj.ggr)),
    rtp: Math.round(toNum(obj.rtp)),
  };
}
