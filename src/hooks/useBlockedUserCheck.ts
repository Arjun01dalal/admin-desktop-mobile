import { useCallback, useEffect, useRef } from 'react';
import { secureApi } from '@/api/secureClient';
import { notifySessionExpired } from '@/utils/session';

const CHECK_INTERVAL = 60 * 1000;
const CACHE_TTL = 60 * 1000;
const LAST_CHECK_KEY = 'blocked_users_last_checked_at';
const VALIDATION_LOCK_KEY = 'blocked_users_validation_lock';
const CACHE_KEY = 'blocked_user_ids_cache';

type CacheState = {
  ids: string[];
  fetchedAt: number;
};

let memoryCache: CacheState | null = null;
let inFlightRequest: Promise<string[]> | null = null;

const isFresh = (cache: CacheState | null) =>
  Boolean(cache && Date.now() - cache.fetchedAt < CACHE_TTL);

function readPersistedCache(): CacheState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheState;
    if (!Array.isArray(parsed?.ids) || typeof parsed?.fetchedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getCache(): CacheState | null {
  if (isFresh(memoryCache)) return memoryCache;

  const persisted = readPersistedCache();
  if (isFresh(persisted)) {
    memoryCache = persisted;
    return memoryCache;
  }

  return memoryCache || persisted;
}

function setCache(ids: string[]): void {
  memoryCache = { ids, fetchedAt: Date.now() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(memoryCache));
}

function clearBlockedCache(): void {
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);
}

function shouldThisTabRunCheck(): boolean {
  const now = Date.now();
  const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);

  if (lastCheck && now - lastCheck < CHECK_INTERVAL) {
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

function unpackBlockedIds(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.map(String).filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const obj = data as { payload?: unknown; ids?: unknown };
    const raw = obj.payload ?? obj.ids;
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  }
  return [];
}

async function fetchBlockedIds(): Promise<string[]> {
  const fresh = getCache();
  if (isFresh(fresh) && fresh) {
    return fresh.ids;
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = (async () => {
    try {
      const res = await secureApi<unknown>('auth.getAllBlockedUserIds', {});
      if (res.ok !== false && res.success !== false) {
        const ids = unpackBlockedIds(res.data);
        setCache(ids);
        return ids;
      }
      return getCache()?.ids || [];
    } catch {
      return getCache()?.ids || [];
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

/**
 * Port of laxminarayan `useBlockedUserCheck` — logs out if the current
 * admin id appears in `/SubAdmin/get-all-blockedUserId`.
 */
export function useBlockedUserCheck(): void {
  const logoutTriggered = useRef(false);

  const handleLogout = useCallback(() => {
    if (logoutTriggered.current) return;
    logoutTriggered.current = true;
    clearBlockedCache();
    notifySessionExpired('Your account has been blocked. Please contact admin.');
  }, []);

  const checkBlockedUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) return;

    let userId: string | undefined;
    try {
      userId = (JSON.parse(storedUser) as { _id?: string })?._id;
    } catch {
      return;
    }
    if (!userId) return;

    const cached = getCache();
    if (cached?.ids.includes(userId)) {
      handleLogout();
      return;
    }

    if (isFresh(cached)) return;

    if (!shouldThisTabRunCheck()) return;

    try {
      const ids = await fetchBlockedIds();
      markCheckComplete();
      if (ids.includes(userId)) {
        handleLogout();
      }
    } catch {
      markCheckComplete();
    }
  }, [handleLogout]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      logoutTriggered.current = false;
      return;
    }

    void checkBlockedUser();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkBlockedUser();
      }
    }, CHECK_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkBlockedUser();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // Mount once while panel router is alive — do not reset on every route change.
  }, [checkBlockedUser]);
}
