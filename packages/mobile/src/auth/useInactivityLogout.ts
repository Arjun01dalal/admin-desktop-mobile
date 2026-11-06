/**
 * Auto-logout after 45 minutes without activity (foreground or background).
 * Session starts on login (`startInactivitySession`) and stops on any logout
 * (manual, token-blacklist, or inactivity) via `stopInactivitySession`.
 */
import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import {
  inactivityLogoutRemainingMs,
  inactivitySessionOwnerKey,
  isInactivityLogoutDue,
  isInactivityLogoutExempt,
  normalizeInactivityMobile,
  readInactivityLastAt,
  startInactivitySession,
  stopInactivitySession,
  touchInactivitySession,
  type InactivityLogoutUser,
} from '@astro/shared';
import { secureApi } from '../api/client';
import { appStorage } from '../lib/webShim';

const POINTER_THROTTLE_MS = 1_000;
const WATCHDOG_MS = 30_000;
const STATUS_API_TIMEOUT_MS = 8_000;

type Options = {
  user: InactivityLogoutUser | null | undefined;
  enabled?: boolean;
  onLogout: () => void | Promise<void>;
};

export function useInactivityLogout({
  user,
  enabled = true,
  onLogout,
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
  const ownerKey = inactivitySessionOwnerKey(user);

  useEffect(() => {
    // Stop storage only when logged out (no owner) or exempt.
    // Leaving panel (`!enabled`) pauses timers but keeps the login-started clock.
    if (!ownerKey || exempt) {
      stopInactivitySession(appStorage);
      markActivityRef.current = () => {};
      return;
    }
    if (!enabled) {
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
        await Promise.race([
          secureApi('auth.inactivityLogoutStatus', { mobile }),
          new Promise<void>((resolve) => setTimeout(resolve, STATUS_API_TIMEOUT_MS)),
        ]);
      } catch {
        // Still force local logout if the status call fails / times out.
      }
      stopInactivitySession(appStorage);
      try {
        await onLogoutRef.current();
      } finally {
        Alert.alert('Logged out', 'Session ended due to inactivity.');
      }
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
      lastActivityRef.current = touchInactivitySession(appStorage, ownerKey, now);
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

    // Prefer session started at login; only seed if missing (e.g. app restore).
    const now = Date.now();
    const stored = readInactivityLastAt(appStorage, ownerKey);
    lastActivityRef.current = stored ?? startInactivitySession(appStorage, ownerKey, now);

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
  }, [ownerKey, mobile, exempt, enabled]);

  return {
    markActivity: () => markActivityRef.current(),
  };
}
