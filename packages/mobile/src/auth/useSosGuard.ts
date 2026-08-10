/**
 * SOS flag guard (desktop useSosFlagGuard parity, poll-based — no Electron IPC
 * on mobile). Polls `auth.getSosFlag` while logged in; when SOS is active and
 * the role is not exempt, the user is kicked out of the panel (logout).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isSosFlagEnabled } from '@astro/shared';
import { secureApi } from '../api/client';
import { isSosExemptRole } from './permissions';

const POLL_MS = 30_000;

export function useSosGuard(enabled: boolean, onKick: () => void): {
  sosEnabled: boolean;
  setSosEnabled: (value: boolean) => void;
  refresh: () => Promise<void>;
} {
  const [sosEnabled, setSosEnabled] = useState(false);
  const kickedRef = useRef(false);
  const onKickRef = useRef(onKick);
  onKickRef.current = onKick;

  const applyActive = useCallback((active: boolean) => {
    setSosEnabled(active);
    if (!active) {
      kickedRef.current = false;
      return;
    }
    if (isSosExemptRole() || kickedRef.current) return;
    kickedRef.current = true;
    onKickRef.current();
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await secureApi('auth.getSosFlag', {});
      if (!res.ok) return;
      applyActive(isSosFlagEnabled(res.data));
    } catch {
      // Network blips — next poll retries.
    }
  }, [enabled, applyActive]);

  useEffect(() => {
    if (!enabled) {
      kickedRef.current = false;
      setSosEnabled(false);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { sosEnabled, setSosEnabled, refresh };
}
