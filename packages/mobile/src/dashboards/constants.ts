import type { ProviderFilter } from './types';
import { PROVIDER_FILTERS as JYOTISH_PROVIDER_FILTERS } from './jyotish/jyotishMapping';

/** Provider filter options — Jyotish UI names (same values used for filtering). */
export const PROVIDER_FILTERS: ProviderFilter[] = [...JYOTISH_PROVIDER_FILTERS];

/** VIP dashboard app list (hardcoded in VipDashboard.tsx). */
export const VIP_CLIENT_NAMES = [
  'GOLDEXCHANGE',
  'BETCLUB247',
  'GOLD247',
  'STAR247',
  'FAIRBETS',
] as const;

export { metricJyotishLabel } from './jyotish/jyotishMapping';
