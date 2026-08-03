/** Shared app / client names used across New Registers, Caller lists, etc. */
export const CLIENT_NAMES = [
  'OS',
  'SM',
  'SG',
  'PS',
  'LS',
  'LM',
  'KS',
  'AB',
  'PM',
  'SB',
  'OM',
  'FAIRBETS',
  'SB247',
] as const;

export type ClientName = (typeof CLIENT_NAMES)[number];

/**
 * Two-digit codes for each app (01-based order of CLIENT_NAMES):
 * 01 OS, 02 SM, 03 SG, 04 PS, 05 LS, 06 LM, 07 KS, 08 AB, 09 PM,
 * 10 SB, 11 OM, 12 FAIRBETS, 13 SB247
 */
export const CLIENT_APP_CODES: Record<string, string> = Object.fromEntries(
  CLIENT_NAMES.map((name, i) => [name, String(i + 1).padStart(2, '0')]),
);

/** Alternate labels / URL keys → canonical CLIENT_NAMES entry. */
const CLIENT_ALIASES: Record<string, ClientName> = {
  FB: 'FAIRBETS',
  FAIRBET: 'FAIRBETS',
  FAIRBETS: 'FAIRBETS',
  THIRDEYE: 'OS',
  THIRDEYEASTRO: 'OS',
  ASTROADMIN: 'OS',
  OSGAMES: 'OS',
  // Deposit URL keys
  KSGAMESNEW: 'KS',
  KSGAMES_NEW: 'KS',
  SGGAMESNEW: 'SG',
  SGGAMES_NEW: 'SG',
  // Registration URL keys: AS01 … AS13
  AS01: 'OS',
  AS02: 'SM',
  AS03: 'SG',
  AS04: 'PS',
  AS05: 'LS',
  AS06: 'LM',
  AS07: 'KS',
  AS08: 'AB',
  AS09: 'PM',
  AS10: 'SB',
  AS11: 'OM',
  AS12: 'FAIRBETS',
  AS13: 'SB247',
};

function normalizeClientToken(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s_-]+/g, '')
    // ksGames_new / sgGames_new → KS / SG (strip Games+new together first)
    .replace(/GAMESNEW$/i, '')
    .replace(/GAMES$/i, '')
    .replace(/NEW$/i, '');
}

/** Resolve App Name / clientName / URL key to its two-digit code. */
export function appCodeForName(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';

  const token = normalizeClientToken(raw);
  const aliased = CLIENT_ALIASES[token] || token;
  const match = CLIENT_NAMES.find(
    (n) => n.toUpperCase() === aliased || normalizeClientToken(n) === token,
  );
  if (match) return CLIENT_APP_CODES[match];

  return CLIENT_APP_CODES[raw] || CLIENT_APP_CODES[token] || raw;
}
