/** VIP dashboard app list (hardcoded VIP dashboard filter). */
export const VIP_CLIENT_NAMES = [
  'GOLDEXCHANGE',
  'BETCLUB247',
  'GOLD247',
  'STAR247',
  'FAIRBETS',
] as const;

export type VipClientName = (typeof VIP_CLIENT_NAMES)[number];
