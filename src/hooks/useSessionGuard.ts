import { useCallback, useEffect } from 'react';
import { secureApi } from '@/api/secureClient';
import { isJwtExpired, notifySessionExpired } from '@/utils/session';

const TOKEN_CHECK_INTERVAL_MS = 30_000;
const LAST_CHECK_KEY = 'token_last_validated_at';
const VALIDATION_LOCK_KEY = 'token_validation_lock';

type BlacklistPayload = {
  isBlacklisted?: boolean;
  hasToken?: boolean;
};

function shouldRunCheck(force: boolean): boolean {
  if (force) return true;

  const now = Date.now();
  const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);
  if (lastCheck && now - lastCheck < TOKEN_CHECK_INTERVAL_MS) {
    return false;
  }

  const lock = localStorage.getItem(VALIDATION_LOCK_KEY);
  if (lock && now - Number(lock) < 15_000) {
    return false;
  }

  localStorage.setItem(VALIDATION_LOCK_KEY, String(now));
  return true;
}

function markCheckComplete(): void {
  localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  localStorage.removeItem(VALIDATION_LOCK_KEY);
}

type SessionGuardOptions = {
  /** When true, run token validation (panel is active). */
  enabled: boolean;
};

/**
 * While the user is in the panel, periodically validate the session
 * (JWT exp + check-token-blacklisted). 401/403 from any secureApi call
 * is handled in secureClient → notifySessionExpired.
 */
export function useSessionGuard({ enabled }: SessionGuardOptions): void {
  const validateToken = useCallback(
    async (force = false) => {
      if (!enabled) return;
      if (!shouldRunCheck(force)) return;

      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!token || !storedUser) {
        markCheckComplete();
        notifySessionExpired('Session expired. Please login again.');
        return;
      }

      if (isJwtExpired(token)) {
        markCheckComplete();
        notifySessionExpired('Your session has expired. Please login again.');
        return;
      }

      let userId: string | undefined;
      try {
        userId = (JSON.parse(storedUser) as { _id?: string })?._id;
      } catch {
        markCheckComplete();
        notifySessionExpired('Session data is invalid. Please login again.');
        return;
      }

      if (!userId) {
        markCheckComplete();
        notifySessionExpired('Session data is invalid. Please login again.');
        return;
      }

      try {
        const res = await secureApi<BlacklistPayload>(
          'auth.checkTokenBlacklisted',
          { _id: userId },
        );
        markCheckComplete();

        // 401/403 already handled inside secureApi via notifySessionExpired
        if (!res.ok && (res.status === 401 || res.status === 403)) {
          return;
        }

        const payload = res.data || {};
        if (payload.isBlacklisted === true || payload.hasToken === false) {
          notifySessionExpired(
            'Your session is no longer valid. Please login again.',
          );
        }
      } catch {
        markCheckComplete();
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    void validateToken(true);
    const intervalId = window.setInterval(() => {
      void validateToken(false);
    }, TOKEN_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, validateToken]);
}
