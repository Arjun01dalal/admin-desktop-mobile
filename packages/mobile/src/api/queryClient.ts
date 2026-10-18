/**
 * TanStack Query — always-fresh defaults.
 * Page focus + pull-to-refresh must hit the network; do not serve stale cache.
 */
import { QueryClient } from '@tanstack/react-query';

/** Shared defaults for Balance / CX lists / menu stats. */
export const FRESH_QUERY_DEFAULTS = {
  staleTime: 0,
  /** Drop unused cache immediately so revisiting a page cannot show old rows. */
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnReconnect: true,
  retry: 1,
};

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...FRESH_QUERY_DEFAULTS,
      },
    },
  });
}

export const appQueryClient = createAppQueryClient();
