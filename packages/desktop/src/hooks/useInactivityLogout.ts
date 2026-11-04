/**
 * Auto-logout after 45 minutes without user input (foreground or background).
 * Calls `auth.inactivityLogoutStatus` then `onLogout`.
 */
import { useEffect, useRef } from 'react';
import {
  inactivityLogoutRemainingMs,
  isInactivityLogoutDue,
  isInactivityLogoutExempt,
  normalizeInactivityMobile,
  type InactivityLogoutUser,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { toast } from 'react-toastify';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'click',
  'scroll',
  'keydown',
  'keypress',
  'touchstart',
];
const POINTER_THROTTLE_MS = 1_000;
const STORAGE_KEY = 'astroInactivityLastAt';

type Options = {
  user: InactivityLogoutUser | null | undefined;
  onLogout: () => void;
};

function readLastActivity(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastActivity(at: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // ignore quota / private mode
  }
}

function clearLastActivity(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function useInactivityLogout({ user, onLogout }: Options): void {
  const timerRef = useRef<number | null>(null);
  const lastActivityRef = useRef(0);
  const lastPointerRef = useRef(0);
  const firingRef = useRef(false);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const exempt = isInactivityLogoutExempt(user);
  const mobile = normalizeInactivityMobile(user?.mobile);
  const userKey = user ? `${String(user._id || '')}:${mobile}` : '';

  useEffect(() => {
    if (!userKey || exempt) {
      clearLastActivity();
      return;
    }

    if (!mobile) return;

    firingRef.current = false;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
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
      timerRef.current = window.setTimeout(() => {
        void fireLogout();
      }, remaining);
    };

    const markActivity = () => {
      if (firingRef.current) return;
      const now = Date.now();
      lastActivityRef.current = now;
      writeLastActivity(now);
      schedule();
    };

    const handlePointerMove = () => {
      const now = Date.now();
      if (now - lastPointerRef.current < POINTER_THROTTLE_MS) return;
      lastPointerRef.current = now;
      markActivity();
    };

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

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, markActivity, { passive: true });
    });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    document.addEventListener('visibilitychange', checkDue);
    window.addEventListener('focus', checkDue);

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, markActivity);
      });
      window.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('visibilitychange', checkDue);
      window.removeEventListener('focus', checkDue);
    };
  }, [userKey, mobile, exempt]);
}
