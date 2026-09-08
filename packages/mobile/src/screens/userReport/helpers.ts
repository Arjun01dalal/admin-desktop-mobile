/**
 * Shared types and pure helpers for the User Report tabs
 * (desktop `userReport/*` parity).
 */
import { getRoleId, getRoleName, isCallerRole } from '../../auth/permissions';
import { CALLER_HEAD_ROLE_IDS } from '../../auth/callerRoles';
import { formatDisplayDate, formatDisplayTime } from '../../utils/dates';

export type Rec = Record<string, unknown>;

/** Callers (+ caller heads): only Exposure + Bonus Earning tiles. */
export function restrictCallerAmountTiles(): boolean {
  if (isCallerRole()) return true;
  const id = String(getRoleId() || '');
  if (id && CALLER_HEAD_ROLE_IDS.has(id)) return true;
  const name = String(getRoleName() || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return name === 'caller' || name === 'caller_new' || name.startsWith('caller_head');
}

export const display = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function unwrap(data: unknown): Rec {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Rec;
  const nested = obj.payload ?? obj.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as Rec;
  return obj;
}

export function listOf(data: unknown, ...keys: string[]): Rec[] {
  if (Array.isArray(data)) return data as Rec[];
  const obj = unwrap(data);
  for (const k of keys) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return [];
}

export function pagesOf(data: unknown): number {
  const obj = unwrap(data);
  const n = Number(obj.totalPages ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function stamp(raw: unknown): string {
  if (raw == null || raw === '') return '—';
  const d = formatDisplayDate(raw);
  const t = formatDisplayTime(raw);
  if (!d) return display(raw);
  return t ? `${d} , ${t}` : d;
}

export function when(r: Rec): string {
  return stamp(r.createdOn ?? r.createdAt ?? r.updatedOn);
}

export function providerList(data: unknown): Rec[] {
  const obj = unwrap(data);
  for (const k of [
    'items',
    'providerBets',
    'provider',
    'providersDetail',
    'platformBets',
    'platform',
    'plateformDetails',
    'missingInProvider',
    'missingProviders',
    'providerMissing',
    'missingInPlatform',
    'missingPlatforms',
    'platformMissing',
    'list',
  ]) {
    if (Array.isArray(obj[k])) return obj[k] as Rec[];
  }
  return Array.isArray(data) ? (data as Rec[]) : [];
}

/** Desktop USER_REPORT_TABS parity. */
export const TABS = [
  'Wallet History',
  'Game History',
  'Starline History',
  'King Bazar History',
  'Instant Worli History',
  'Qtech History',
  'JetFair History',
  'Falcon History',
  'Remove Bonus Coins',
  'Fund Request',
  'Qtech Provider History',
  'Qtech Missing Bets',
  'Jetfair Provider History',
  'SM Provider History',
  'Qtech Bet Details',
  'Crazzy Wheel',
  'Settle SM Bets',
  'Settle Jetfair Bets',
  'Player RTP',
] as const;

export type Tab = (typeof TABS)[number];

export type Summary = {
  totalDeposit: number;
  totalWithdrawal: number;
  balance: number;
  bonusWalletBalance: number;
  pendingWithdrawal: number;
  exposure: number;
  referralEarning: number;
  referralCount: number;
  ownEarning: number;
  ownEarningCount: number;
  approvedBonus: number;
  approvedBonusCount: number;
  approvedBonusItems: Rec[];
};

export type BonusKind = 'bonus' | 'referral' | 'availedBonus';

/** Wallet-ledger description flattened into one readable line. */
export function detailText(r: Rec): string {
  const d = (r.description ?? {}) as Rec;
  const bits: string[] = [];
  for (const k of [
    'marketName',
    'gameName',
    'game',
    'category',
    'paymentGatewayName',
    'paymentType',
    'reason',
    'remark',
  ]) {
    if (d[k]) bits.push(String(d[k]));
  }
  if (d.roundId) bits.push(`Round ${String(d.roundId)}`);
  if (d.transactionId) bits.push(`Txn ${String(d.transactionId)}`);
  return bits.join(' · ') || '—';
}

/** Desktop parity: parse betAmountsByCategory payload into {name, amount} bars. */
export function parseChartPayload(raw: unknown): { name: string; amount: number }[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  let map = raw as Rec;
  if (
    map.data &&
    typeof map.data === 'object' &&
    !Array.isArray(map.data) &&
    !('betAmount' in (map.data as object))
  ) {
    const inner = map.data as Rec;
    const innerKeys = Object.keys(inner);
    if (
      innerKeys.some((k) => ['casino', 'exchange', 'sattamatka'].includes(k.toLowerCase())) ||
      innerKeys.some((k) => {
        const v = inner[k];
        return v != null && typeof v === 'object' && 'betAmount' in (v as object);
      })
    ) {
      map = inner;
    }
  }
  if (map.payload && typeof map.payload === 'object' && !Array.isArray(map.payload)) {
    map = map.payload as Rec;
  }
  const skip = new Set(['success', 'message', 'status', 'token', 'payload', 'data']);
  const preferred = ['casino', 'exchange', 'sattamatka'];
  const entries = Object.entries(map).filter(([k, v]) => !skip.has(k) && v != null);
  const byLower = new Map(
    entries.map(([k, v]) => [k.toLowerCase(), { key: k, value: v }] as const),
  );
  const ordered: string[] = [];
  for (const p of preferred) {
    const hit = byLower.get(p);
    if (hit) ordered.push(hit.key);
  }
  for (const [k] of entries) if (!ordered.includes(k)) ordered.push(k);
  return ordered.map((key) => {
    const v = byLower.get(key.toLowerCase())?.value;
    let amount = 0;
    if (typeof v === 'number') amount = v;
    else if (typeof v === 'string') amount = Number(v.replace(/,/g, '')) || 0;
    else if (v && typeof v === 'object') {
      const o = v as Rec;
      amount = Number(o.betAmount ?? o.BetAmount ?? o.amount ?? o.Amount ?? 0) || 0;
    }
    return { name: key.toUpperCase(), amount };
  });
}
