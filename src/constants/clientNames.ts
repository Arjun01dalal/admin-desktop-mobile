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
  'WEBOS',
  'BETCLUB247',
  'STAR247',
  'GOLDEXCHANGE',
  'SP365',
  'GOLD247',
  'SB',
  'OM',
  'FAIRBETS',
  'SB247',
  'KB',
  'KG',
] as const;

export type ClientName = (typeof CLIENT_NAMES)[number];
