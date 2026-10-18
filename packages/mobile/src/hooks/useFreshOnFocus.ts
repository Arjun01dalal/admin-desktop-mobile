/**
 * Every time the screen gains focus → network refetch (not cache).
 * Pair with FRESH_QUERY_DEFAULTS (staleTime/gcTime 0).
 */
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { QueryObserverResult } from '@tanstack/react-query';

export function useFreshOnFocus(refetch: () => Promise<QueryObserverResult | unknown>): void {
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
}
