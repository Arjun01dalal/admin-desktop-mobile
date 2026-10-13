import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Schedule work after sheet/modal close animations; always cleared on unmount.
 * Default delay matches iOS nested-modal settle (~350ms) vs Android (~80ms).
 */
export function useDeferredTimeout(defaultMs?: number) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const delay =
    defaultMs ?? (Platform.OS === 'ios' ? 350 : 80);

  useEffect(() => {
    return () => {
      for (const id of timersRef.current) clearTimeout(id);
      timersRef.current = [];
    };
  }, []);

  const defer = useCallback(
    (fn: () => void, ms = delay) => {
      const id = setTimeout(() => {
        timersRef.current = timersRef.current.filter((t) => t !== id);
        fn();
      }, ms);
      timersRef.current.push(id);
      return id;
    },
    [delay],
  );

  const clearAll = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current = [];
  }, []);

  return { defer, clearAll };
}
