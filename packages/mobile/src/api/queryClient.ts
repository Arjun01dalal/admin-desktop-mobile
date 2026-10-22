/**
 * TanStack Query — always-fresh defaults.
 * Page focus + pull-to-refresh must hit the network; do not serve stale cache.
 */
import { QueryClient } from '@tanstack/react-query';

/** Shared defaults — every screen load / focus / reconnect hits the network. */
export const FRESH_QUERY_DEFAULTS = {
  staleTime: 0,
  /** Drop unused cache immediately so revisiting a page cannot show old rows. */
  gcTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: 'always' as const,
  refetchOnReconnect: 'always' as const,
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
