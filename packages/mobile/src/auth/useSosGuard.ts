/**
 * SOS flag guard (desktop sosMonitor + useSosFlagGuard parity, poll-based —
 * no Electron IPC on mobile). A single provider polls `auth.getSosFlag`;
 * consumers read lock state + block details via useSos().
 *
 * Siren + acknowledge popup live in SosAlertOverlay (rendered at app root).
 * The device that pressed SOS marks itself originator so it never sirens
 * for its own alert (desktop "alert suppressed for this panel" parity).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getSosBlock, isSosFlagEnabled, type SosBlockInfo } from '@astro/shared';
import { secureApi } from '../api/client';

const POLL_MS = 30_000;

type SosState = {
  sosEnabled: boolean;
  block: SosBlockInfo | null;
  /** True when this device sent the active SOS (no local siren/popup). */
  originator: boolean;
  setSosEnabled: (value: boolean) => void;
  markOriginator: () => void;
  refresh: () => Promise<void>;
};

const SosContext = createContext<SosState>({
  sosEnabled: false,
  block: null,
  originator: false,
  setSosEnabled: () => undefined,
  markOriginator: () => undefined,
  refresh: async () => undefined,
});

export function useSos(): SosState {
  return useContext(SosContext);
}

export function SosProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [sosEnabled, setSosEnabled] = useState(false);
  const [block, setBlock] = useState<SosBlockInfo | null>(null);
  const [originator, setOriginator] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await secureApi('auth.getSosFlag', {});
      if (!res.ok) return;
      const active = isSosFlagEnabled(res.data);
      setSosEnabled(active);
      setBlock(active ? getSosBlock(res.data) : null);
      if (!active) setOriginator(false);
    } catch {
      // Network blips — next poll retries.
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSosEnabled(false);
      setBlock(null);
      setOriginator(false);
      return;
    }
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  const value = useMemo<SosState>(
    () => ({
      sosEnabled,
      block,
      originator,
      setSosEnabled,
      markOriginator: () => setOriginator(true),
      refresh,
    }),
    [sosEnabled, block, originator, refresh],
  );

  return React.createElement(SosContext.Provider, { value }, children);
}
