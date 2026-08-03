import { useCallback, useEffect, useRef, useState } from 'react';
import { secureApi } from '@/api/secureClient';

/** Shape from `/SubAdmin/get-sos-flag` → `data.block`. */
export type SosBlockInfo = {
  enabled?: boolean;
  blockedById?: string;
  blockedByName?: string;
  blockedAt?: string;
  location?: string;
  officeLocation?: string;
  type?: string;
};

type SosFlagPayload = {
  sosEnabled?: boolean;
  enabled?: boolean;
  block?: SosBlockInfo;
  data?: {
    sosEnabled?: boolean;
    enabled?: boolean;
    block?: SosBlockInfo;
  };
  payload?: SosFlagPayload;
};

/** Prefer `data.block` / `block` from get-sos-flag. */
export function getSosBlock(payload: unknown): SosBlockInfo | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as SosFlagPayload & Record<string, unknown>;
  if (obj.block && typeof obj.block === 'object') return obj.block;
  if (obj.data?.block && typeof obj.data.block === 'object') return obj.data.block;
  if (obj.payload && typeof obj.payload === 'object') {
    return getSosBlock(obj.payload);
  }
  return null;
}

export function isSosFlagEnabled(payload: unknown): boolean {
  if (payload == null) return false;

  // Canonical API shape: { block: { enabled, blockedByName, ... } }
  const block = getSosBlock(payload);
  if (block) {
    return (
      block.enabled === true ||
      String(block.enabled).toLowerCase() === 'true' ||
      String(block.enabled) === '1'
    );
  }

  if (typeof payload !== 'object') {
    if (payload === true || payload === 1) return true;
    if (typeof payload === 'string') {
      const v = payload.trim().toLowerCase();
      return v === 'true' || v === '1' || v === 'yes' || v === 'on';
    }
    return false;
  }

  const obj = payload as SosFlagPayload & {
    sos?: boolean;
    sos_flag?: boolean;
    sosFlag?: boolean;
    flag?: boolean;
  };
  if (obj.sosEnabled === true || obj.enabled === true) return true;
  if (obj.sos === true || obj.sos_flag === true || obj.sosFlag === true || obj.flag === true) {
    return true;
  }
  if (obj.data?.sosEnabled === true || obj.data?.enabled === true) return true;
  if (obj.payload && typeof obj.payload === 'object') {
    return isSosFlagEnabled(obj.payload);
  }
  return false;
}

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
    if (!localStorage.getItem('token')) return;

    try {
      const res = await secureApi<SosFlagPayload>('auth.getSosFlag', {});
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
