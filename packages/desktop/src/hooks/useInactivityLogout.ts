/**
 * Auto-logout after 45 minutes without user input (foreground or background).
 * Session starts on login (`startInactivitySession`) and stops on any logout
 * (manual, token-blacklist, or inactivity) via `stopInactivitySession`.
 *
 * Windows note: do NOT clearTimeout/setTimeout or write localStorage on every
 * pointer/scroll event — that flooded the main thread and made laptops sticky.
 * Keep last-activity in memory; persist + due-check on a slow cadence.
 */
import { useEffect, useRef } from 'react';
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
import { secureApi } from '@/api/secureClient';
import { toast } from 'react-toastify';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];
/** Ignore bursts of input — raw mousemove/scroll floods Windows Electron. */
const ACTIVITY_THROTTLE_MS = 1_000;
/** localStorage sync is expensive; persist at most this often while active. */
const STORAGE_THROTTLE_MS = 10_000;
/** Cap timeout chunks so a stale timer re-checks after activity without rescheduling every move. */
const CHECK_CHUNK_MS = 30_000;
const STATUS_API_TIMEOUT_MS = 8_000;

type Options = {
  user: InactivityLogoutUser | null | undefined;
  enabled?: boolean;
  onLogout: () => void;
};

export function useInactivityLogout({ user, enabled = true, onLogout }: Options): void {
  const timerRef = useRef<number | null>(null);
  const lastActivityRef = useRef(0);
  const lastMarkRef = useRef(0);
  const lastPersistRef = useRef(0);
  const firingRef = useRef(false);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const exempt = isInactivityLogoutExempt(user);
  const mobile = normalizeInactivityMobile(user?.mobile);
  const ownerKey = inactivitySessionOwnerKey(user);

  useEffect(() => {
    // Stop storage only when logged out (no owner) or exempt.
    // `!enabled` pauses timers but keeps the login-started clock.
    if (!ownerKey || exempt) {
      stopInactivitySession(localStorage);
      return;
    }
    if (!enabled) return;

    if (!mobile) return;

    firingRef.current = false;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const persist = (at: number, force = false) => {
      if (!force && at - lastPersistRef.current < STORAGE_THROTTLE_MS) return;
      lastPersistRef.current = at;
      touchInactivitySession(localStorage, ownerKey, at);
    };

    const fireLogout = async () => {
      if (firingRef.current) return;
      firingRef.current = true;
      clearTimer();
      try {
        await Promise.race([
          secureApi('auth.inactivityLogoutStatus', { mobile }),
          new Promise<void>((resolve) => window.setTimeout(resolve, STATUS_API_TIMEOUT_MS)),
        ]);
      } catch {
        // Still force local logout if the status call fails / times out.
      }
      stopInactivitySession(localStorage);
      toast.error('Logged out due to inactivity.');
      onLogoutRef.current();
    };

    const schedule = () => {
      clearTimer();
      const remaining = inactivityLogoutRemainingMs(lastActivityRef.current);
      if (remaining <= 0) {
        void fireLogout();
        return;
      }
      // Chunk long waits so we re-read lastActivity after user input
      // without clearTimeout/setTimeout on every mouse move.
      timerRef.current = window.setTimeout(() => {
        if (isInactivityLogoutDue(lastActivityRef.current)) {
          void fireLogout();
        } else {
          schedule();
        }
      }, Math.min(remaining, CHECK_CHUNK_MS));
    };

    const markActivity = () => {
      if (firingRef.current) return;
      const now = Date.now();
      if (now - lastMarkRef.current < ACTIVITY_THROTTLE_MS) return;
      lastMarkRef.current = now;
      lastActivityRef.current = now;
      persist(now);
      // Do not reschedule here — next CHECK_CHUNK tick picks up the new lastActivity.
    };

    const checkDue = () => {
      if (isInactivityLogoutDue(lastActivityRef.current)) {
        void fireLogout();
      } else {
        schedule();
      }
    };

    const now = Date.now();
    const stored = readInactivityLastAt(localStorage, ownerKey);
    lastActivityRef.current = stored ?? startInactivitySession(localStorage, ownerKey, now);
    lastPersistRef.current = lastActivityRef.current;

    if (isInactivityLogoutDue(lastActivityRef.current, now)) {
      void fireLogout();
    } else {
      schedule();
    }

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, markActivity, { passive: true });
    });
    window.addEventListener('mousemove', markActivity, { passive: true });
    document.addEventListener('visibilitychange', checkDue);
    window.addEventListener('focus', checkDue);

    return () => {
      // Flush latest activity so restore / other windows see it.
      if (lastActivityRef.current > 0) {
        persist(lastActivityRef.current, true);
      }
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, markActivity);
      });
      window.removeEventListener('mousemove', markActivity);
      document.removeEventListener('visibilitychange', checkDue);
      window.removeEventListener('focus', checkDue);
    };
  }, [ownerKey, mobile, exempt, enabled]);
}
