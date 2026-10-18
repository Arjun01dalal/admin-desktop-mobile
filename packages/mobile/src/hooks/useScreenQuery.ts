/**
 * Standard screen data hook — FAANG-style defaults for this app:
 * - always stale → network on mount
 * - gcTime 0 → no stale list flash when revisiting
 * - refetch on navigation focus + pull-to-refresh via returned `refresh`
 */
import { useCallback } from 'react';
import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { FRESH_QUERY_DEFAULTS } from '../api/queryClient';
import { captureException } from '../observability/sentry';
import { useFreshOnFocus } from './useFreshOnFocus';

type ScreenQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> = Omit<
  UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'queryKey' | 'queryFn'
> & {
  queryKey: TQueryKey;
  queryFn: () => Promise<TQueryFnData>;
  /** When false, skip focus refetch (rare). Default true. */
  refetchOnFocus?: boolean;
};

export type ScreenQueryResult<TData, TError = Error> = UseQueryResult<TData, TError> & {
  /** Alias for pull-to-refresh / retry buttons. */
  refresh: () => Promise<unknown>;
  /** True while a network request is in flight. */
  refreshing: boolean;
  /** Initial load with no data yet. */
  loading: boolean;
  errorMessage: string | null;
};

export function useScreenQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: ScreenQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): ScreenQueryResult<TData, TError> {
  const { refetchOnFocus = true, queryFn, ...rest } = options;

  const query = useQuery<TQueryFnData, TError, TData, TQueryKey>({
    ...FRESH_QUERY_DEFAULTS,
    ...rest,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (err) {
        captureException(err, { queryKey: rest.queryKey });
        throw err;
      }
    },
  });

  const refresh = useCallback(() => query.refetch(), [query.refetch]);
  useFreshOnFocus(refetchOnFocus ? refresh : async () => query);

  const err = query.error as { message?: string } | null;

  return {
    ...query,
    refresh,
    refreshing: query.isFetching,
    loading: query.isLoading || (query.isFetching && query.data === undefined),
    errorMessage: err?.message ?? null,
  };
}
