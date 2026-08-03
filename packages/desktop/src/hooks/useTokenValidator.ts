import { useCallback, useEffect, useRef } from 'react';
import { secureApi } from '@/api/secureClient';
import { getAuthToken } from '@/utils/authToken';
import { isJwtExpired, notifySessionExpired } from '@/utils/session';

/** How often we hit check-token-blacklisted while the panel is open (laxminarayan). */
const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000;
const LAST_CHECK_KEY = 'token_last_validated_at';
const VALIDATION_LOCK_KEY = 'token_validation_lock';
const LOCK_TTL_MS = 15_000;

type BlacklistPayload = {
  isBlacklisted?: boolean;
  hasToken?: boolean;
};

type SessionStatus = 'valid' | 'invalid' | 'unknown';

let inFlightValidation: Promise<SessionStatus> | null = null;

function shouldThisTabRunCheck(): boolean {
  const now = Date.now();
  const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);

  if (lastCheck && now - lastCheck < TOKEN_CHECK_INTERVAL) {
    return false;
  }

  const lock = localStorage.getItem(VALIDATION_LOCK_KEY);
  if (lock && now - Number(lock) < LOCK_TTL_MS) {
    return false;
  }

  localStorage.setItem(VALIDATION_LOCK_KEY, String(now));
  return true;
}

function markCheckComplete(): void {
  localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  localStorage.removeItem(VALIDATION_LOCK_KEY);
}

async function checkSession(userId: string): Promise<SessionStatus> {
  const token = getAuthToken();
  if (!token || !userId) return 'unknown';

  if (isJwtExpired(token)) return 'invalid';

  try {
    const res = await secureApi<BlacklistPayload>('auth.checkTokenBlacklisted', {
      _id: userId,
    });

    if (!res.ok && (res.status === 401 || res.status === 403)) {
      return 'invalid';
    }

    const payload = res.data || {};
    if (payload.isBlacklisted === true || payload.hasToken === false) {
      return 'invalid';
    }
    if (payload.isBlacklisted === false && payload.hasToken === true) {
      return 'valid';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Port of laxminarayan `useTokenValidator` — validates session via
 * check-token-blacklisted on an interval, tab focus, and cross-tab token clear.
 */
export function useTokenValidator(): void {
  const logoutTriggered = useRef(false);

  const handleLogout = useCallback((reason?: string) => {
    if (logoutTriggered.current) return;
    logoutTriggered.current = true;
    notifySessionExpired(
      reason || 'Your session is no longer valid. Please login again.',
    );
  }, []);

  const validateToken = useCallback(async () => {
    if (!shouldThisTabRunCheck()) return;

    const token = getAuthToken();
    const storedUser = localStorage.getItem('user');

    if (!token || !storedUser) {
      markCheckComplete();
      return;
    }

    let userId: string | undefined;
    try {
      userId = (JSON.parse(storedUser) as { _id?: string })?._id;
    } catch {
      markCheckComplete();
      return;
    }

    if (!userId) {
      markCheckComplete();
      return;
    }

    try {
      if (!inFlightValidation) {
        inFlightValidation = checkSession(userId).finally(() => {
          inFlightValidation = null;
        });
      }

      const status = await inFlightValidation;
      markCheckComplete();

      if (status === 'invalid') {
        handleLogout();
      }
    } catch {
      markCheckComplete();
    }
  }, [handleLogout]);

  useEffect(() => {
    const token = getAuthToken();
    // Login / site screens are outside this router — only run while panel routes mount.
    if (!token) {
      logoutTriggered.current = false;
      return;
    }

    void validateToken();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void validateToken();
      }
    }, TOKEN_CHECK_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void validateToken();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === 'token' && !event.newValue && localStorage.getItem('user')) {
        handleLogout('Session ended in another tab. Please login again.');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
    // Mount once while panel router is alive — do not reset on every route change.
  }, [validateToken, handleLogout]);
}
