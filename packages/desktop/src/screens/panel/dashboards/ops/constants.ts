import type { ProviderFilter } from './types';

/** Provider filter options — matches admin-panel-domains ProviderLists. */
export const PROVIDER_FILTERS: ProviderFilter[] = [
  'All',
  'Exchange',
  'Casino',
  'Qtech',
  'WCO',
  'SportBook',
  'BetConstruct',
  'Jetfair',
  'Falcon',
  'AAA Exchange',
  'Satta Matka',
  'Crazy Wheel',
  'Plutus Gaming',
  'Indian Diva',
  'Ludo',
];

/** VIP dashboard app list (hardcoded in VipDashboard.tsx). */
export const VIP_CLIENT_NAMES = [
  'GOLDEXCHANGE',
  'BETCLUB247',
  'GOLD247',
  'STAR247',
  'FAIRBETS',
] as const;
