/**
 * =============================================================================
 * JYOTISH / ASTRO UI MAPPING — single source of truth
 * =============================================================================
 * UI shows Jyotish (secret) names by default.
 * After OTP "Reveal codes", originals show for 1 hour.
 *
 * Use `toDisplayText(anyLabel)` at render — works for both original and
 * already-Jyotish strings.
 *
 * APIs still use original values where noted.
 * =============================================================================
 */

import type { ProviderFilter } from '../types';
import { isRevealCodesActive } from '../../context/revealCodesStore';
import {
  applyAutoAstroIfNeeded,
  ensureAutoAstroAlias,
  reverseAutoAstroAlias,
} from './autoAstroAlias';

// ---------------------------------------------------------------------------
// 1) Filter By  (Original → Jyotish name = UI value)
// ---------------------------------------------------------------------------
export const FILTER_BY_MAP = [
  { original: 'All', jyotish: 'Ashwini' },
  { original: 'Exchange', jyotish: 'Exaltation' },
  { original: 'Casino', jyotish: 'Chandra' },
  { original: 'Qtech', jyotish: 'Ketu' },
  { original: 'WCO', jyotish: 'Vakra' },
  { original: 'SportBook', jyotish: 'Shani' },
  { original: 'BetConstruct', jyotish: 'Budha' },
  { original: 'Jetfair', jyotish: 'Jyeshtha' },
  { original: 'Falcon', jyotish: 'Phalguni' },
  { original: 'AAA Exchange', jyotish: 'Ascendant' },
  { original: 'Satta Matka', jyotish: 'Shatabhisha' },
  { original: 'Crazy Wheel', jyotish: 'Chitra' },
  { original: 'Plutus Gaming', jyotish: 'Pushya' },
  { original: 'Indian Diva', jyotish: 'Indu' },
  { original: 'Ludo', jyotish: 'Lagna' },
] as const satisfies ReadonlyArray<{ original: string; jyotish: ProviderFilter }>;

export const DEFAULT_PROVIDER_FILTER: ProviderFilter = 'Ashwini';

export const PROVIDER_FILTER_META: ReadonlyArray<{
  name: ProviderFilter;
  original: string;
}> = FILTER_BY_MAP.map((m) => ({ name: m.jyotish, original: m.original }));

export const PROVIDER_FILTERS: ProviderFilter[] = FILTER_BY_MAP.map(
  (m) => m.jyotish,
);

export function providerDetailsTitle(name: ProviderFilter): string {
  return `${name} Details`;
}

// ---------------------------------------------------------------------------
// 2) Provider card metric rows  (Original → Jyotish)
// ---------------------------------------------------------------------------
export const METRIC_MAP = [
  { original: 'Total Payin', jyotish: 'Dhana' },
  { original: 'Total Payout', jyotish: 'Vyaya' },
  { original: 'Total Commission', jyotish: 'Dakshina' },
  { original: 'Net Profit', jyotish: 'Labha' },
  { original: 'GGR', jyotish: 'Artha' },
  { original: 'Win', jyotish: 'Jaya' },
  { original: 'Bet Amount', jyotish: 'Rashi' },
  { original: 'Active Customer', jyotish: 'Jiva' },
  { original: 'Total Rollback', jyotish: 'Nivritti' },
  { original: 'Total Profit', jyotish: 'Vriddhi' },
  { original: 'Net RTP', jyotish: 'Bhava' },
  { original: 'Net P/L', jyotish: 'Phala' },
  { original: 'Final GGR', jyotish: 'Siddhi' },
  { original: 'Total GGR', jyotish: 'Sampat' },
  { original: 'Gross GGR', jyotish: 'Pushti' },
] as const;

/** Extra aliases used in code that map to the same Jyotish terms. */
const METRIC_ALIASES: Record<string, string> = {
  Payin: 'Dhana',
  Payout: 'Vyaya',
  Commission: 'Dakshina',
  'Total Player Commission': 'Dakshina',
  Profit: 'Labha',
  'Provider GGR': 'Artha',
  'GGR (Without commission)': 'Artha',
  'GGR - Upline + Commission': 'Artha',
  'Total Win': 'Jaya',
  'Total Win Amount': 'Jaya',
  'Total Winning Amount': 'Jaya',
  'Total Bet Win': 'Jaya',
  'Win Amount': 'Jaya',
  Winning: 'Jaya',
  'Total Bet Amount': 'Rashi',
  'Total Active Users': 'Jiva',
  'Total RollBack': 'Nivritti',
  'Roll Back': 'Nivritti',
  Rollback: 'Nivritti',
  'Rollback Count': 'Nivritti Count',
  RTP: 'Bhava',
  'Update RTP': 'Update Bhava',
  'Players RTP': 'Players Bhava',
  'Player RTP': 'Player Bhava',
  'Players RTP Details': 'Players Bhava Details',
};

const METRIC_LOOKUP: Record<string, string> = {
  ...Object.fromEntries(METRIC_MAP.map((m) => [m.original, m.jyotish])),
  ...METRIC_ALIASES,
};

export function metricJyotishLabel(label: string): string {
  return METRIC_LOOKUP[label] ?? label;
}

// ---------------------------------------------------------------------------
// 3) Nav tiles  (Original → Jyotish)
// ---------------------------------------------------------------------------
export const NAV_MAP = {
  masterData: { original: 'Master Data', jyotish: 'Panchang' },
  liveMatchTotal: { original: 'Live Match Total', jyotish: 'Gochar' },
} as const;

/** Risk Analysis top nav tiles. */
export const RISK_NAV_MAP = [
  {
    id: 'liveMatch',
    original: 'Live Match Total',
    jyotish: 'Gochar',
    href: '/liveMatchTotal',
  },
  {
    id: 'liveMatchMaster',
    original: 'Live Match Total (Master)',
    jyotish: 'Gochar (Master)',
    href: '/masterLiveMatchTotal',
  },
  {
    id: 'liveMatchBoth',
    original: 'Live Match Total (Master & Laxmi)',
    jyotish: 'Gochar (Master & Laxmi)',
    href: '/bothLiveMatchTotal',
  },
  {
    id: 'liveMatchAaa',
    original: 'Live Match Total (AAA & Master AAA)',
    jyotish: 'Gochar (Ascendant & Master Ascendant)',
    href: '/bothMasterAddPage',
  },
] as const;

export const RISK_CARD_TITLES = {
  masterAaaBook: {
    original: 'Master AAA Book',
    jyotish: 'Master Ascendant Book',
  },
} as const;

// ---------------------------------------------------------------------------
// 4) Active Exaltation panel  (UI Jyotish → API original)
// ---------------------------------------------------------------------------
export const PANEL_LABELS = {
  title: 'Active Exaltation',
  activeName: 'Active Exaltation Name',
  list: 'Exaltation List',
  chooseType: 'Choose Exaltation Type',
} as const;

/** UI shows Jyotish; API still receives original exchangeName. */
export const ACTIVE_EXCHANGE_MAP = [
  { original: 'AAA', jyotish: 'Ascendant' },
  { original: 'FALCON', jyotish: 'Phalguni' },
  { original: 'JETFAIR', jyotish: 'Jyeshtha' },
] as const;

// ---------------------------------------------------------------------------
// 5) KPI renames (main Dashboard)
// ---------------------------------------------------------------------------
export const KPI_MAP = {
  totalWithdrawal: { original: 'Total Withdrawals', jyotish: 'Total Refund' },
} as const;

// ---------------------------------------------------------------------------
// 6) Profit & Loss page columns
// ---------------------------------------------------------------------------
export const PROFIT_LOSS_COLUMN_MAP = [
  { original: 'Bet Amount', jyotish: 'Panja' },
  { original: 'Win Amount', jyotish: 'Jaya' },
  { original: 'Withdraw', jyotish: 'Refund' },
  { original: 'Bonus', jyotish: 'Varadan' },
] as const;

// ---------------------------------------------------------------------------
// 7) House Krida (was House Games)
// ---------------------------------------------------------------------------
export const HOUSE_GAMES_MAP = [
  { original: 'House Games', jyotish: 'House Krida' },
  { original: 'Total Count', jyotish: 'Total' },
  { original: 'Game ID', jyotish: 'Krida' },
  { original: 'Operator ID', jyotish: 'Niyanta' },
  { original: 'Winning Point', jyotish: 'Jaya Point' },
  { original: 'Wining Point', jyotish: 'Jaya Point' },
  { original: 'Player Identity', jyotish: 'Kridak' },
] as const;

/**
 * House Krida gameId values (API originals → UI astro names).
 * Filter/API always use `original`.
 */
export const HOUSE_GAME_ID_MAP = [
  { original: 'aviator', jyotish: 'Viman' },
  { original: 'avitor', jyotish: 'Viman' },
  { original: 'Aviator', jyotish: 'Viman' },
  { original: 'balloon', jyotish: 'Vayu' },
  { original: 'ballon', jyotish: 'Vayu' },
  { original: 'Balloon', jyotish: 'Vayu' },
  { original: 'mines', jyotish: 'Khanij' },
  { original: 'Mines', jyotish: 'Khanij' },
  { original: 'plinko', jyotish: 'Nakshatra' },
  { original: 'Plinko', jyotish: 'Nakshatra' },
  { original: 'dice', jyotish: 'Pasha' },
  { original: 'Dice', jyotish: 'Pasha' },
  { original: 'goal', jyotish: 'Lakshya' },
  { original: 'Goal', jyotish: 'Lakshya' },
  { original: 'limbo', jyotish: 'Antariksha' },
  { original: 'Limbo', jyotish: 'Antariksha' },
  { original: 'crash', jyotish: 'Patan' },
  { original: 'Crash', jyotish: 'Patan' },
  { original: 'wheel', jyotish: 'Chakra' },
  { original: 'Wheel', jyotish: 'Chakra' },
  { original: 'hilo', jyotish: 'UchchaNicha' },
  { original: 'HiLo', jyotish: 'UchchaNicha' },
  { original: 'keno', jyotish: 'Anka' },
  { original: 'Keno', jyotish: 'Anka' },
] as const;

/** Canonical dropdown values (API originals) for House Krida Game ID filter. */
export const HOUSE_GAME_ID_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'aviator', label: 'aviator' },
  { value: 'balloon', label: 'balloon' },
  { value: 'mines', label: 'mines' },
  { value: 'plinko', label: 'plinko' },
  { value: 'dice', label: 'dice' },
  { value: 'goal', label: 'goal' },
  { value: 'limbo', label: 'limbo' },
  { value: 'crash', label: 'crash' },
  { value: 'wheel', label: 'wheel' },
  { value: 'hilo', label: 'hilo' },
  { value: 'keno', label: 'keno' },
] as const;

// ---------------------------------------------------------------------------
// 8) Common UI labels (nav, activity, casino, bonus, RTP, …)
//    Longest phrases first when building replace pairs.
// ---------------------------------------------------------------------------
export const COMMON_UI_MAP = [
  // —— Nav / page titles ——
  { original: 'Bonus Wallet Fund Requests', jyotish: 'Varadan Wallet Fund Requests' },
  { original: 'Bonus Wallet Requests', jyotish: 'Varadan Wallet Requests' },
  { original: 'Bonus Wallet Table', jyotish: 'Varadan Wallet Table' },
  { original: 'Total Bonus Wallet', jyotish: 'Total Varadan Wallet' },
  { original: 'Casino Top-up Balance', jyotish: 'Chandra Top-up Balance' },
  { original: 'Casino Topup Balance', jyotish: 'Chandra Top-up Balance' },
  { original: 'Withdrawal Providers', jyotish: 'Refund Providers' },
  { original: 'Withdrawal Fund', jyotish: 'Refund Fund' },
  { original: 'BetConstruct Games', jyotish: 'Budha Games' },
  { original: 'Betconstruct Games', jyotish: 'Budha Games' },
  { original: 'Active Casino Provider', jyotish: 'Active Chandra Provider' },
  { original: 'Add Casino Provider', jyotish: 'Add Chandra Provider' },
  { original: 'Casino Active Provider', jyotish: 'Chandra Active Provider' },
  { original: 'Winning Amount', jyotish: 'Jaya Amount' },
  { original: 'Games Activity', jyotish: 'Krida Gati' },
  { original: 'Game Activity', jyotish: 'Krida Gati' },
  { original: 'Top Games', jyotish: 'Mukhya Krida' },
  { original: 'Players RTP', jyotish: 'Players Bhava' },
  { original: 'Player RTP', jyotish: 'Player Bhava' },
  { original: 'Total Casino Deposit', jyotish: 'Total Chandra Deposit' },
  { original: 'Total Jetfair Deposit', jyotish: 'Total Jyeshtha Deposit' },
  { original: 'Free Points Bonus', jyotish: 'Free Points Varadan' },
  { original: 'Remove Bonus Coins', jyotish: 'Remove Varadan Coins' },
  { original: 'Total Users Bonus Balance', jyotish: 'Total Users Varadan Balance' },
  { original: 'Total Bonus Given', jyotish: 'Total Varadan Given' },
  { original: 'Bonus Balance', jyotish: 'Varadan Balance' },
  { original: 'Bonus Wallet', jyotish: 'Varadan Wallet' },
  { original: 'Topped Up At (IST)', jyotish: 'Poorna At (IST)' },
  { original: 'Topped Up At', jyotish: 'Poorna At' },

  // —— Live Match titles ——
  {
    original: 'Live Match Total (AAA & Master AAA)',
    jyotish: 'Gochar (Ascendant & Master Ascendant)',
  },
  {
    original: 'Live Match Total (Master & Laxmi)',
    jyotish: 'Gochar (Master & Laxmi)',
  },
  { original: 'Live Match Total (Master)', jyotish: 'Gochar (Master)' },
  { original: 'Live Match Total', jyotish: 'Gochar' },
  { original: 'Live Match', jyotish: 'Gochar' },
  { original: 'Bet Size', jyotish: 'Panja Size' },
  { original: 'Settle Bet', jyotish: 'Settle Panja' },
  { original: 'Pending withdrawal', jyotish: 'Pending Refund' },
  { original: 'Pending Withdrawal', jyotish: 'Pending Refund' },
  { original: 'Loss After Withdrawal', jyotish: 'Loss After Refund' },
  { original: 'Profit After Withdrawal', jyotish: 'Profit After Refund' },
  { original: 'Bonus Referral Earning', jyotish: 'Varadan Referral Earning' },
  { original: 'Bonus Earning', jyotish: 'Varadan Earning' },
  { original: 'Bonus Wallet Balance', jyotish: 'Varadan Wallet Balance' },
  { original: '(Win - Loss)', jyotish: '(Jaya - Loss)' },

  // —— Withdrawal family ——
  { original: 'Total Withdrawals', jyotish: 'Total Refund' },
  { original: 'Total Withdrawal', jyotish: 'Total Refund' },
  { original: 'PnL Before Withdrawal', jyotish: 'PnL Before Refund' },
  { original: 'PnL After Withdrawal', jyotish: 'PnL After Refund' },
  { original: 'Withdrawal Provider', jyotish: 'Refund Provider' },
  { original: 'Withdrawal', jyotish: 'Refund' },
  { original: 'Withdraw', jyotish: 'Refund' },

  // —— Bet / Win / Game activity ——
  { original: 'Total Bonus Bet', jyotish: 'Total Varadan Panja' },
  { original: 'Total Winning Amount', jyotish: 'Total Jaya Amount' },
  { original: 'Total Wins Amount', jyotish: 'Total Jaya Amount' },
  { original: 'Wins Amount', jyotish: 'Jaya Amount' },
  { original: 'Winning Point', jyotish: 'Jaya Point' },
  { original: 'Wining Point', jyotish: 'Jaya Point' },
  { original: 'Win Percentage', jyotish: 'Jaya Percentage' },
  { original: 'Total Win %', jyotish: 'Total Jaya %' },
  { original: 'Win Loss', jyotish: 'Jaya Hani' },
  { original: 'Win Count', jyotish: 'Jaya Count' },
  { original: 'No of Wins', jyotish: 'Jaya Count' },
  { original: 'Total Wins', jyotish: 'Total Jaya' },
  { original: 'Win Amount', jyotish: 'Jaya Amount' },
  { original: 'Is Bet Won', jyotish: 'Is Panja Won' },
  { original: 'Betting Time', jyotish: 'Panja Time' },
  { original: 'Bet Time', jyotish: 'Panja Time' },
  { original: 'Bet Status', jyotish: 'Panja Status' },
  { original: 'Bet Type', jyotish: 'Panja Type' },
  { original: 'Bet PL', jyotish: 'Panja Phala' },
  { original: 'Bet Count', jyotish: 'Panja Count' },
  { original: 'No of Bets', jyotish: 'Panja Count' },
  { original: 'Total Bets', jyotish: 'Total Panja' },
  { original: 'Total Bet', jyotish: 'Total Panja' },
  { original: 'Bet Amount', jyotish: 'Rashi' },
  { original: 'Bet ID', jyotish: 'Panja ID' },
  { original: 'Bet Id', jyotish: 'Panja ID' },
  { original: 'Game Category', jyotish: 'Krida Category' },
  { original: 'Game Count', jyotish: 'Krida Count' },
  { original: 'Game Coin', jyotish: 'Krida Sikka' },
  { original: 'Game Id', jyotish: 'Krida' },
  { original: 'Game History', jyotish: 'Krida History' },
  { original: 'Instant Win History', jyotish: 'Instant Jaya History' },
  { original: 'Qtech Missing Bets', jyotish: 'Ketu Missing Panja' },
  { original: 'Qtech bet details', jyotish: 'Ketu panja details' },
  { original: 'Qtech Bet Details', jyotish: 'Ketu Panja Details' },
  { original: 'Qtech Provider History', jyotish: 'Ketu Provider History' },
  { original: 'Qtech History', jyotish: 'Ketu History' },
  { original: 'Falcon History', jyotish: 'Phalguni History' },
  { original: 'Jetfair Provider History', jyotish: 'Jyeshtha Provider History' },
  { original: 'Settle Jetfair Bets', jyotish: 'Settle Jyeshtha Panja' },
  { original: 'Settle SM Bets', jyotish: 'Settle SM Panja' },
  { original: 'Total Payout', jyotish: 'Vyaya' },
  { original: 'Missing Bets', jyotish: 'Missing Panja' },

  // —— Live / table providers ——
  { original: 'Evolution - Ezugi', jyotish: 'Vivarta - Rohini' },
  { original: 'Evolution-Ezugi', jyotish: 'Vivarta-Rohini' },
  { original: 'Evolution Ezugi', jyotish: 'Vivarta Rohini' },
  { original: 'JackTop', jyotish: 'Abhijit' },
  { original: 'Jacktop', jyotish: 'Abhijit' },
  { original: 'JACKTOP', jyotish: 'Abhijit' },
  { original: 'Evolution', jyotish: 'Vivarta' },
  { original: 'Ezugi', jyotish: 'Rohini' },
  { original: 'EZUGI', jyotish: 'Rohini' },

  // —— Providers (standalone; after longer phrases) ——
  { original: 'Betconstruct', jyotish: 'Budha' },
  { original: 'BetConstruct', jyotish: 'Budha' },
  { original: 'AAA Exchange', jyotish: 'Ascendant' },
  { original: 'SportBook', jyotish: 'Shani' },
  { original: 'Jetfair', jyotish: 'Jyeshtha' },
  { original: 'JetFair', jyotish: 'Jyeshtha' },
  { original: 'Falcon', jyotish: 'Phalguni' },
  { original: 'Qtech', jyotish: 'Ketu' },
  { original: 'QTECH', jyotish: 'Ketu' },
  { original: 'Casino', jyotish: 'Chandra' },
  { original: 'Exchange', jyotish: 'Exaltation' },
  { original: 'WACS', jyotish: 'Vakra' },
  { original: 'WCO', jyotish: 'Vakra' },

  // —— Short tokens (after longer phrases) ——
  { original: 'Bonus', jyotish: 'Varadan' },
  { original: 'RTP', jyotish: 'Bhava' },
  { original: 'GGR', jyotish: 'Artha' },
  { original: 'Bet', jyotish: 'Panja' },
  { original: 'Win', jyotish: 'Jaya' },
] as const;

// ---------------------------------------------------------------------------
// 9) Temporary reveal → show ORIGINAL labels (OTP-gated, 1 hour)
// ---------------------------------------------------------------------------

function buildPairs(): {
  forward: Array<[string, string]>;
  reverse: Array<[string, string]>;
} {
  const forward: Array<[string, string]> = [];

  const add = (original: string, jyotish: string) => {
    if (!original || !jyotish || original === jyotish) return;
    forward.push([original, jyotish]);
  };

  // Skip bare "All" — too dangerous for substring replace.
  for (const m of FILTER_BY_MAP) {
    if (m.original === 'All') continue;
    add(m.original, m.jyotish);
  }
  for (const m of METRIC_MAP) add(m.original, m.jyotish);
  for (const [original, jyotish] of Object.entries(METRIC_ALIASES)) {
    add(original, jyotish);
  }
  add(NAV_MAP.masterData.original, NAV_MAP.masterData.jyotish);
  add(NAV_MAP.liveMatchTotal.original, NAV_MAP.liveMatchTotal.jyotish);
  for (const m of RISK_NAV_MAP) add(m.original, m.jyotish);
  add(
    RISK_CARD_TITLES.masterAaaBook.original,
    RISK_CARD_TITLES.masterAaaBook.jyotish,
  );
  for (const m of ACTIVE_EXCHANGE_MAP) add(m.original, m.jyotish);
  add(KPI_MAP.totalWithdrawal.original, KPI_MAP.totalWithdrawal.jyotish);
  for (const m of PROFIT_LOSS_COLUMN_MAP) add(m.original, m.jyotish);
  for (const m of HOUSE_GAMES_MAP) add(m.original, m.jyotish);
  for (const m of HOUSE_GAME_ID_MAP) add(m.original, m.jyotish);
  for (const m of COMMON_UI_MAP) add(m.original, m.jyotish);

  // Panel chrome (UI already Jyotish; keep reverse coverage)
  add('Active Exchange Name', 'Active Exaltation Name');
  add('Active Exchange', 'Active Exaltation');
  add('Exchange List', 'Exaltation List');
  add('Choose Exchange Type', 'Choose Exaltation Type');

  // Dedupe by original (first / longest wins after sort)
  const seenO = new Set<string>();
  const uniqForward: Array<[string, string]> = [];
  const sortedForward = [...forward].sort((a, b) => b[0].length - a[0].length);
  for (const [o, j] of sortedForward) {
    if (seenO.has(o)) continue;
    seenO.add(o);
    uniqForward.push([o, j]);
  }

  const seenJ = new Set<string>();
  const uniqReverse: Array<[string, string]> = [];
  const sortedReverse = [...uniqForward]
    .map(([o, j]) => [j, o] as [string, string])
    .sort((a, b) => b[0].length - a[0].length);
  for (const [j, o] of sortedReverse) {
    if (seenJ.has(j)) continue;
    seenJ.add(j);
    uniqReverse.push([j, o]);
  }

  return { forward: uniqForward, reverse: uniqReverse };
}

const { forward: FORWARD_PAIRS, reverse: REVERSE_PAIRS } = buildPairs();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type CompiledPair = { pattern: RegExp; to: string };

function compilePairs(pairs: Array<[string, string]>): CompiledPair[] {
  return pairs
    .filter(([from]) => Boolean(from))
    .map(([from, to]) => ({
      // Recreate RegExp per use via .source — keep one template with gi flags.
      pattern: new RegExp(
        `(?<![A-Za-z0-9])${escapeRegExp(from)}(?![A-Za-z0-9])`,
        'gi',
      ),
      to,
    }));
}

const FORWARD_COMPILED = compilePairs(FORWARD_PAIRS);
const REVERSE_COMPILED = compilePairs(REVERSE_PAIRS);

/**
 * Replace mapped phrases. Case-insensitive so API values like CASINO / QTECH work.
 * Boundaries avoid rewriting inside app brands (e.g. GOLDEXCHANGE must not become
 * GOLDExaltation because of "Exchange").
 *
 * Patterns are precompiled once — creating RegExp per cell was very slow on Windows
 * (large tables × hundreds of pairs × every render).
 */
function applyCompiled(text: string, compiled: CompiledPair[]): string {
  let out = text;
  for (const { pattern, to } of compiled) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, to);
  }
  return out;
}

/** Skip expensive mapping for IDs, amounts, dates, mobiles, etc. */
function skipMapping(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  if (t.length > 120) return true; // huge blobs — leave as-is
  if (/^[—\-\u2013\u2014.]+$/.test(t)) return true;
  if (/^\d+([.,]\d+)?%?$/.test(t)) return true;
  if (/^[₹$€£]?\s*[\d,]+(\.\d+)?%?$/.test(t)) return true;
  if (/^\+?\d{8,15}$/.test(t)) return true;
  if (/^[a-f0-9]{24}$/i.test(t)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return true;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(t)) return true;
  if (t.includes('@')) return true;
  // No letters → nothing to map
  if (!/[A-Za-z]/.test(t)) return true;
  return false;
}

const DISPLAY_CACHE_MAX = 4000;
const displayCache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const hit = displayCache.get(key);
  if (hit === undefined) return undefined;
  // refresh LRU order
  displayCache.delete(key);
  displayCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: string): string {
  if (displayCache.size >= DISPLAY_CACHE_MAX) {
    const oldest = displayCache.keys().next().value;
    if (oldest !== undefined) displayCache.delete(oldest);
  }
  displayCache.set(key, value);
  return value;
}

/** Call when Reveal codes toggles so cached labels refresh. */
export function clearDisplayTextCache(): void {
  displayCache.clear();
}

let lastRevealForCache: boolean | null = null;

/**
 * Universal UI label helper (static labels + API response strings).
 * - Default: original gambling terms → Jyotish / astro names
 * - Unknown provider/game brands → deterministic auto astro alias (persisted)
 * - Reveal active: show original names
 */
export function toDisplayText(text: string): string {
  const raw = String(text ?? '');
  if (!raw) return raw;
  if (skipMapping(raw)) return raw;

  const reveal = isRevealCodesActive();
  if (lastRevealForCache !== reveal) {
    lastRevealForCache = reveal;
    displayCache.clear();
  }

  const cacheKey = `${reveal ? '1' : '0'}:${raw}`;
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const trimmed = raw.trim();
  // Exact All (filter / category) — skipped in substring pairs (too broad).
  if (/^all$/i.test(trimmed)) {
    return cacheSet(cacheKey, reveal ? 'All' : 'Ashwini');
  }
  if (trimmed === 'Ashwini' && reveal) return cacheSet(cacheKey, 'All');

  if (reveal) {
    const fromStatic = applyCompiled(raw, REVERSE_COMPILED);
    return cacheSet(cacheKey, reverseAutoAstroAlias(fromStatic));
  }

  const asJyotish = applyCompiled(raw, FORWARD_COMPILED);
  // Static map already rewrote the string (e.g. Casino → Chandra).
  if (asJyotish !== raw) return cacheSet(cacheKey, asJyotish);
  // Whole-value unknown provider/game brand → stable auto alias.
  return cacheSet(cacheKey, applyAutoAstroIfNeeded(raw));
}

/** Prefer for provider / game name cells (same as toDisplayText today). */
export function toProviderDisplayText(text: string): string {
  return toDisplayText(text);
}

/** Map API/cell values for display (same rules as toDisplayText). */
export function displayApiValue(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return toDisplayText(String(value));
}

/**
 * House Krida `gameId` cell/filter label.
 * UI shows astro name; callers must send the original `gameId` to APIs.
 */
export function houseGameIdLabel(gameId: unknown): string {
  const raw = String(gameId ?? '').trim();
  if (!raw || raw === '-') return '-';
  if (isRevealCodesActive()) {
    return reverseAutoAstroAlias(applyCompiled(raw, REVERSE_COMPILED));
  }
  const mapped = applyCompiled(raw, FORWARD_COMPILED);
  if (mapped !== raw) return mapped;
  return ensureAutoAstroAlias(raw, { force: true });
}

export function activeExchangeJyotishLabel(apiName: string | undefined): string {
  const raw = String(apiName ?? '').trim();
  if (!raw) return '—';
  if (isRevealCodesActive()) return raw.toUpperCase();
  const hit = ACTIVE_EXCHANGE_MAP.find((m) => m.original === raw.toUpperCase());
  return hit?.jyotish ?? toDisplayText(raw);
}
