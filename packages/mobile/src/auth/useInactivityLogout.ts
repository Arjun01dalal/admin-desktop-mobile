/**
 * Auto-logout after 45 minutes without activity (foreground or background).
 * Calls `auth.inactivityLogoutStatus` then `onLogout`.
 *
 * Timers pause while JS is suspended in background — we persist last activity
 * and re-check on AppState `active` / periodic ticks so logout still applies.
 */
import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import {
  inactivityLogoutRemainingMs,
  isInactivityLogoutDue,
  isInactivityLogoutExempt,
  normalizeInactivityMobile,
  type InactivityLogoutUser,
} from '@astro/shared';
import { secureApi } from '../api/client';
import { appStorage } from '../lib/webShim';

const STORAGE_KEY = 'astroInactivityLastAt';
const POINTER_THROTTLE_MS = 1_000;
const WATCHDOG_MS = 30_000;

type Options = {
  user: InactivityLogoutUser | null | undefined;
  enabled?: boolean;
  onLogout: () => void | Promise<void>;
  /** Optional: parent can call this to mark UI activity (touches / navigation). */
  activitySignal?: number;
};

function readLastActivity(): number {
  try {
    const n = Number(appStorage.getItem(STORAGE_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastActivity(at: number): void {
  try {
    appStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // ignore
  }
}

function clearLastActivity(): void {
  try {
    appStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useInactivityLogout({
  user,
  enabled = true,
  onLogout,
  activitySignal = 0,
}: Options): { markActivity: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef(0);
  const lastMarkRef = useRef(0);
  const firingRef = useRef(false);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const markActivityRef = useRef(() => {});
  const exempt = isInactivityLogoutExempt(user);
  const mobile = normalizeInactivityMobile(user?.mobile);
  const userKey = user ? `${String(user._id || '')}:${mobile}` : '';

  useEffect(() => {
    if (!enabled || !userKey || exempt) {
      clearLastActivity();
      markActivityRef.current = () => {};
      return;
    }

    if (!mobile) {
      markActivityRef.current = () => {};
      return;
    }

    firingRef.current = false;

    const clearTimer = () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fireLogout = async () => {
      if (firingRef.current) return;
      firingRef.current = true;
      clearTimer();
      try {
        await secureApi('auth.inactivityLogoutStatus', { mobile });
      } catch {
        // Still force local logout if the status call fails.
      }
      clearLastActivity();
      Alert.alert('Logged out', 'Session ended due to inactivity.');
      await onLogoutRef.current();
    };

    const schedule = () => {
      clearTimer();
      const remaining = inactivityLogoutRemainingMs(lastActivityRef.current);
      if (remaining <= 0) {
        void fireLogout();
        return;
      }
      timerRef.current = setTimeout(() => {
        void fireLogout();
      }, remaining);
    };

    const markActivity = () => {
      if (firingRef.current) return;
      const now = Date.now();
      if (now - lastMarkRef.current < POINTER_THROTTLE_MS) return;
      lastMarkRef.current = now;
      lastActivityRef.current = now;
      writeLastActivity(now);
      schedule();
    };
    markActivityRef.current = markActivity;

    const checkDue = () => {
      if (isInactivityLogoutDue(lastActivityRef.current)) {
        void fireLogout();
      } else {
        schedule();
      }
    };

    const stored = readLastActivity();
    const now = Date.now();
    lastActivityRef.current = stored > 0 ? stored : now;
    if (!stored) writeLastActivity(now);

    if (isInactivityLogoutDue(lastActivityRef.current, now)) {
      void fireLogout();
    } else {
      schedule();
    }

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') checkDue();
    };
    const sub: NativeEventSubscription = AppState.addEventListener('change', onAppState);
    watchdogRef.current = setInterval(checkDue, WATCHDOG_MS);

    return () => {
      clearTimer();
      if (watchdogRef.current != null) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      sub.remove();
      markActivityRef.current = () => {};
    };
  }, [userKey, mobile, exempt, enabled]);

  useEffect(() => {
    if (activitySignal > 0) markActivityRef.current();
  }, [activitySignal]);

  return {
    markActivity: () => markActivityRef.current(),
  };
}
