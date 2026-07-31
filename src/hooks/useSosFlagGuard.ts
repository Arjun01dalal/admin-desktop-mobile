import { useCallback, useEffect, useRef, useState } from 'react';
import { secureApi } from '@/api/secureClient';

const SOS_POLL_INTERVAL_MS = 10_000;

type SosFlagPayload = {
  sosEnabled?: boolean;
  enabled?: boolean;
  data?: {
    sosEnabled?: boolean;
    enabled?: boolean;
  };
};

export function isSosFlagEnabled(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as SosFlagPayload;
  if (obj.sosEnabled === true || obj.enabled === true) return true;
  if (obj.data?.sosEnabled === true || obj.data?.enabled === true) return true;
  return false;
}

type Options = {
  /** When true, poll while the panel is active. */
  enabled: boolean;
  /** Live check — exempt roles stay in panel. */
  isExempt: () => boolean;
  onKick: () => void;
};

/**
 * Globally polls SubAdmin/get-sos-flag while the user is in the panel.
 * Non-exempt users are kicked when sosEnabled is true.
 */
export function useSosFlagGuard({ enabled, isExempt, onKick }: Options): {
  sosEnabled: boolean;
  setSosEnabled: (value: boolean) => void;
  refresh: () => Promise<void>;
} {
  const [sosEnabled, setSosEnabled] = useState(false);
  const kickedRef = useRef(false);
  const onKickRef = useRef(onKick);
  const isExemptRef = useRef(isExempt);
  onKickRef.current = onKick;
  isExemptRef.current = isExempt;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!localStorage.getItem('token')) return;

    try {
      const res = await secureApi<SosFlagPayload>('auth.getSosFlag', {});
      if (!res.ok) return;

      const active = isSosFlagEnabled(res.data);
      setSosEnabled(active);

      if (!active) {
        kickedRef.current = false;
        return;
      }

      if (isExemptRef.current() || kickedRef.current) return;
      kickedRef.current = true;
      onKickRef.current();
    } catch {
      // Network blips — keep polling.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      kickedRef.current = false;
      setSosEnabled(false);
      return;
    }

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, SOS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, refresh]);

  return { sosEnabled, setSosEnabled, refresh };
}
