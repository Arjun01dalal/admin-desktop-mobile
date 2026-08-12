import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { TOKEN_CHECK_INTERVAL, runTokenValidation } from './sessionCheck';

/**
 * Polls check-token-blacklisted so a newer login on another panel/device
 * invalidates this session and returns the user to Login.
 */
export function useTokenValidator(
  enabled: boolean,
  onInvalid: (reason: string) => void,
): void {
  const logoutTriggered = useRef(false);
  const onInvalidRef = useRef(onInvalid);
  onInvalidRef.current = onInvalid;

  const handleLogout = useCallback((reason?: string) => {
    if (logoutTriggered.current) return;
    logoutTriggered.current = true;
    onInvalidRef.current(
      reason || 'Your session is no longer valid. Please login again.',
    );
  }, []);

  const validateToken = useCallback(
    async (opts?: { force?: boolean }) => {
      const status = await runTokenValidation(opts);
      if (status === 'invalid') {
        handleLogout('You were logged in elsewhere. Please login again.');
      }
    },
    [handleLogout],
  );

  useEffect(() => {
    if (!enabled) {
      logoutTriggered.current = false;
      return;
    }

    void validateToken({ force: true });

    const intervalId = setInterval(() => {
      void validateToken();
    }, TOKEN_CHECK_INTERVAL);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void validateToken({ force: true });
      }
    };

    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, [enabled, validateToken]);
}
