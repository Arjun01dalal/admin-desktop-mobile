import { useCallback, useRef } from 'react';

/**
 * Stale-response guard for async loads.
 * Bump generation on each request; only the latest gen may commit results.
 * `begin`/`end` track in-flight count so silent polls can coalesce safely.
 */
export function useRequestGeneration() {
  const genRef = useRef(0);
  const inFlightRef = useRef(0);

  const next = useCallback(() => {
    genRef.current += 1;
    return genRef.current;
  }, []);

  const isCurrent = useCallback((gen: number) => gen === genRef.current, []);

  const begin = useCallback(() => {
    inFlightRef.current += 1;
  }, []);

  const end = useCallback(() => {
    inFlightRef.current = Math.max(0, inFlightRef.current - 1);
  }, []);

  const isInFlight = useCallback(() => inFlightRef.current > 0, []);

  return { next, isCurrent, begin, end, isInFlight };
}
