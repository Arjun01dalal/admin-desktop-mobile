import { useEffect, useRef } from 'react';
import { secureApi } from '@/api/secureClient';

const INACTIVITY_LIMIT = 30_000;
const HEARTBEAT_INTERVAL = 30_000;
const MAX_CHUNK = HEARTBEAT_INTERVAL + 2_000;
/** Throttle pointer moves — raw mousemove floods the main thread on Windows. */
const POINTER_THROTTLE_MS = 1_000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'click',
  'scroll',
  'keydown',
  'keypress',
  'touchstart',
];

/**
 * Laxmi-compatible staff activity tracker.
 * Sends one active/inactive duration chunk every 30 seconds.
 */
export function useInactivityTracker(userId?: string): void {
  const inactivityTimer = useRef<number | null>(null);
  const heartbeatTimer = useRef<number | null>(null);
  const sessionStart = useRef(Date.now());
  const isInactive = useRef(false);
  const lastPointerActivity = useRef(0);

  useEffect(() => {
    if (!userId) return;

    const resetInactivityTimer = () => {
      if (inactivityTimer.current !== null) {
        window.clearTimeout(inactivityTimer.current);
      }
      inactivityTimer.current = window.setTimeout(() => {
        isInactive.current = true;
      }, INACTIVITY_LIMIT);
    };

    const handleActivity = () => {
      if (isInactive.current) {
        sessionStart.current = Date.now();
        isInactive.current = false;
      }
      resetInactivityTimer();
    };

    const handlePointerMove = () => {
      const now = Date.now();
      if (now - lastPointerActivity.current < POINTER_THROTTLE_MS) return;
      lastPointerActivity.current = now;
      handleActivity();
    };

    const heartbeat = () => {
      const now = Date.now();
      const elapsed = now - sessionStart.current;
      sessionStart.current = now;
      if (elapsed <= 0 || elapsed > MAX_CHUNK) return;

      const action = isInactive.current ? 'auth.updateInactiveTime' : 'auth.updateActiveTime';
      void secureApi(action, {
        _id: userId,
        minutes: Number((elapsed / 60_000).toFixed(2)),
      });
    };

    sessionStart.current = Date.now();
    isInactive.current = false;
    resetInactivityTimer();
    heartbeatTimer.current = window.setInterval(heartbeat, HEARTBEAT_INTERVAL);

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    window.addEventListener('beforeunload', heartbeat);

    return () => {
      heartbeat();
      if (inactivityTimer.current !== null) {
        window.clearTimeout(inactivityTimer.current);
      }
      if (heartbeatTimer.current !== null) {
        window.clearInterval(heartbeatTimer.current);
      }
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('beforeunload', heartbeat);
    };
    // Intentionally not keyed on route — remounting every navigation sent extra heartbeats
    // and re-bound listeners, which made Windows feel sticky during page switches.
  }, [userId]);
}
