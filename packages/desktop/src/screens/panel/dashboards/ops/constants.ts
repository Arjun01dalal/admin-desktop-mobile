/**
 * App constants. Jyotish / Astro UI renames live in `jyotishMapping.ts`
 * (single source — also documented in docs/Jyotish-UI-Mapping.md for release).
 */

export {
  DEFAULT_PROVIDER_FILTER,
  PROVIDER_FILTER_META,
  PROVIDER_FILTERS,
  providerDetailsTitle,
  metricJyotishLabel,
  FILTER_BY_MAP,
  METRIC_MAP,
  NAV_MAP,
  PANEL_LABELS,
  ACTIVE_EXCHANGE_MAP,
  activeExchangeJyotishLabel,
  KPI_MAP,
  COMMON_UI_MAP,
  toDisplayText,
  displayApiValue,
} from './jyotishMapping';

/** VIP dashboard app list (hardcoded in VipDashboard.tsx). */
export const VIP_CLIENT_NAMES = [
  'GOLDEXCHANGE',
  'BETCLUB247',
  'GOLD247',
  'STAR247',
  'FAIRBETS',
] as const;
