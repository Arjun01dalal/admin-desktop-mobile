/**
 * Indian Divas Settle — shared types + response helpers.
 * Laxmi User Report → Indian Divas Settle modal
 *   POST /revealer/pending-bets
 *   POST /revealer/update-bet-status
 *   POST /revealer/rollback-all-pending
 */

export type IndianDivasBetStatus = 'W' | 'L' | 'R';

export type IndianDivasPendingBet = {
  transactionId: string;
  amount?: number;
  stake?: number;
  status?: string;
  gameName?: string;
  marketName?: string;
  createdAt?: string;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Pull a bet array from nested Laxmi / revealer response shapes. */
export function extractIndianDivasBets(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const obj = asRecord(payload);
  if (!obj) return [];

  const data = asRecord(obj.data);
  const nestedPayload = asRecord(obj.payload);
  const candidates = [
    obj.bets,
    obj.items,
    obj.pendingBets,
    obj.data,
    obj.payload,
    data?.items,
    data?.bets,
    nestedPayload?.items,
    nestedPayload?.bets,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function normalizeIndianDivasBet(item: unknown): IndianDivasPendingBet | null {
  const raw = asRecord(item);
  if (!raw) return null;

  const transactionId = String(
    raw.transactionId ?? raw.transaction_id ?? raw.txnId ?? raw._id ?? raw.id ?? '',
  ).trim();
  if (!transactionId) return null;

  const amountValue = Number(raw.amount ?? raw.winningAmount ?? raw.winAmount ?? raw.payout ?? NaN);
  const stakeValue = Number(raw.stake ?? raw.betAmount ?? raw.bet_amount ?? NaN);

  return {
    transactionId,
    amount: Number.isFinite(amountValue) ? amountValue : undefined,
    stake: Number.isFinite(stakeValue) ? stakeValue : undefined,
    status: raw.status != null ? String(raw.status) : undefined,
    gameName:
      raw.gameName != null
        ? String(raw.gameName)
        : raw.game != null
          ? String(raw.game)
          : undefined,
    marketName:
      raw.marketName != null
        ? String(raw.marketName)
        : raw.market != null
          ? String(raw.market)
          : undefined,
    createdAt:
      raw.createdAt != null
        ? String(raw.createdAt)
        : raw.created_at != null
          ? String(raw.created_at)
          : undefined,
    raw,
  };
}

export function normalizeIndianDivasPendingBets(payload: unknown): IndianDivasPendingBet[] {
  return extractIndianDivasBets(payload)
    .map(normalizeIndianDivasBet)
    .filter((bet): bet is IndianDivasPendingBet => Boolean(bet));
}

export function formatIndianDivasMoney(value?: number): string {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString('en-IN');
}

export function indianDivasStatusLabel(status: IndianDivasBetStatus): string {
  if (status === 'W') return 'Win';
  if (status === 'L') return 'Loss';
  return 'Rollback';
}
