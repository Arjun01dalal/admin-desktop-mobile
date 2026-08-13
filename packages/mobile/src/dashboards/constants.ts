import type { ProviderFilter } from './types';
import { PROVIDER_FILTERS as JYOTISH_PROVIDER_FILTERS } from './jyotish/jyotishMapping';

/** Provider filter options — Jyotish UI names (same values used for filtering). */
export const PROVIDER_FILTERS: ProviderFilter[] = [...JYOTISH_PROVIDER_FILTERS];

/** VIP dashboard app list — shared with desktop. */
export { VIP_CLIENT_NAMES } from '@astro/shared/vipClients';

export { metricJyotishLabel } from './jyotish/jyotishMapping';
