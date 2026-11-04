import { DEPOSIT_PROVIDER_EXTRA_STATES, INDIA_STATES } from '@astro/shared';

/** Indian states for Deposit Providers "stateNotAllowed" multi-select (admin parity). */
export const INDIAN_STATES = [...INDIA_STATES, ...DEPOSIT_PROVIDER_EXTRA_STATES] as const;
