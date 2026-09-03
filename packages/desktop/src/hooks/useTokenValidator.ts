import { useCallback, useEffect, useRef } from 'react';
import { getAuthToken } from '@/utils/authToken';
import { notifySessionExpired } from '@/utils/session';
import { runTokenValidation, TOKEN_CHECK_INTERVAL } from '@/utils/sessionCheck';

/**
 * Port of laxminarayan `useTokenValidator` — validates session via
 * check-token-blacklisted on an interval, focus/visibility, and API activity.
 * Enforces single active session per mobile (latest login wins).
 */
export function useTokenValidator(): void {
  const logoutTriggered = useRef(false);

  const handleLogout = useCallback((reason?: string) => {
    if (logoutTriggered.current) return;
    logoutTriggered.current = true;
    notifySessionExpired(reason || 'Your session is no longer valid. Please login again.');
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
    const token = getAuthToken();
    // Login / site screens are outside this router — only run while panel routes mount.
    if (!token) {
      logoutTriggered.current = false;
      return;
    }

    void validateToken({ force: true });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void validateToken();
      }
    }, TOKEN_CHECK_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void validateToken({ force: true });
      }
    };

    const onFocus = () => {
      void validateToken({ force: true });
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'token' && !event.newValue && localStorage.getItem('user')) {
        handleLogout('Session ended in another tab. Please login again.');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
    // Mount once while panel router is alive — do not reset on every route change.
  }, [validateToken, handleLogout]);
}

export { resetTokenValidationThrottle } from '@/utils/sessionCheck';
