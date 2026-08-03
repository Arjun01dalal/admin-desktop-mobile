import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSosFlagEnabled,
  type SosBlockInfo,
  type SosFlagPayload,
} from '@astro/shared';
import { astroApi } from '@/api/astroApi';
import { getAuthToken } from '@/utils/authToken';

export type { SosBlockInfo, SosFlagPayload };
export { getSosBlock, isSosFlagEnabled } from '@astro/shared';

type Options = {
  /** When true, subscribe to main-process SOS state while the panel is active. */
  enabled: boolean;
  /** Live check — exempt roles stay in panel. */
  isExempt: () => boolean;
  onKick: () => void;
};

/**
 * Kicks non-exempt users when SOS is active.
 * Subscribes to main-process `sos:state` (sosMonitor polls get-sos-flag once).
 * `refresh()` remains for manual post-activate / unblock sync.
 * SOS parse logic lives in @astro/shared (same as future mobile).
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

  const applyActive = useCallback((active: boolean) => {
    setSosEnabled(active);
    if (!active) {
      kickedRef.current = false;
      window.gcalc?.sosCleared?.();
      return;
    }
    // Do NOT call sosActivated — main sosMonitor + push handle remote alerts.
    if (isExemptRef.current() || kickedRef.current) return;
    kickedRef.current = true;
    onKickRef.current();
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (!getAuthToken()) return;

    try {
      const res = await astroApi.auth.getSosFlag();
      if (!res.ok) return;
      applyActive(isSosFlagEnabled(res.data));
    } catch {
      // Network blips — main-process IPC remains source of truth.
    }
  }, [enabled, applyActive]);

  useEffect(() => {
    if (!enabled) {
      kickedRef.current = false;
      setSosEnabled(false);
      return;
    }

    let cancelled = false;

    void window.gcalc?.getSosState?.().then((state) => {
      if (!cancelled) applyActive(Boolean(state?.active));
    });

    const unsubscribe = window.gcalc?.onSosState?.((d) => {
      if (!cancelled) applyActive(Boolean(d?.active));
    });

    // One-shot API sync if IPC state is stale (no interval — sosMonitor polls).
    void refresh();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled, applyActive, refresh]);

  return { sosEnabled, setSosEnabled, refresh };
}
