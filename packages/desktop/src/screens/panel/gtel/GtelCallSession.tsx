/**
 * Single Active Call session for the whole panel shell.
 * Avoids mounting duplicate C2C modals from every CallingBtn / page.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { sanitizeGtelPhone, type GtelC2cTarget } from '@astro/shared';

import { GtelClick2CallModal } from './GtelClick2CallModal';
import { useGtelAuth } from './useGtelAuth';

type StartArgs = string | GtelC2cTarget;

type GtelCallSessionValue = {
  canShowC2c: boolean;
  /** Open Active Call modal (phone string or full target). */
  startC2c: (target: StartArgs, userId?: string, onEnded?: () => void) => boolean;
  isCalling: (phoneRaw: string) => boolean;
  callingPhone: string | null;
};

const GtelCallSessionContext = createContext<GtelCallSessionValue | null>(null);

function normalizeTarget(target: StartArgs, userId?: string): GtelC2cTarget | null {
  if (typeof target === 'string') {
    const phone = sanitizeGtelPhone(target);
    if (!phone) return null;
    return { phoneNumber: target, userId: userId || undefined, source: 'Manual' };
  }
  const phone = sanitizeGtelPhone(target.phoneNumber);
  if (!phone) return null;
  return { ...target, source: target.source || (target.campaignDataId ? 'Campaign' : 'Manual') };
}

export function GtelCallSessionProvider({ children }: { children: ReactNode }) {
  const { canShowC2c } = useGtelAuth();
  const [target, setTarget] = useState<GtelC2cTarget | null>(null);
  const onEndedRef = useRef<(() => void) | null>(null);
  const callingPhoneRef = useRef<string | null>(null);

  const startC2c = useCallback(
    (next: StartArgs, userId?: string, onEnded?: () => void) => {
      if (!canShowC2c) return false;
      const normalized = normalizeTarget(next, userId);
      if (!normalized) return false;
      onEndedRef.current = onEnded || null;
      setTarget(normalized);
      return true;
    },
    [canShowC2c],
  );

  const clearTarget = useCallback(() => {
    setTarget(null);
    onEndedRef.current = null;
  }, []);

  const handleEnded = useCallback(() => {
    onEndedRef.current?.();
    onEndedRef.current = null;
  }, []);

  const callingPhone = target ? sanitizeGtelPhone(target.phoneNumber) || null : null;
  callingPhoneRef.current = callingPhone;

  const isCalling = useCallback((phoneRaw: string) => {
    const phone = sanitizeGtelPhone(phoneRaw);
    return Boolean(phone && callingPhoneRef.current === phone);
  }, []);

  const value = useMemo<GtelCallSessionValue>(
    () => ({
      canShowC2c,
      startC2c,
      callingPhone,
      isCalling,
    }),
    [canShowC2c, callingPhone, isCalling, startC2c],
  );

  return (
    <GtelCallSessionContext.Provider value={value}>
      {children}
      {/* Mount only while a call is active — avoids idle resetSession / unstable onClose loops. */}
      {target ? (
        <GtelClick2CallModal target={target} onClose={clearTarget} onEnded={handleEnded} />
      ) : null}
    </GtelCallSessionContext.Provider>
  );
}

const NOOP_SESSION: GtelCallSessionValue = {
  canShowC2c: false,
  startC2c: () => false,
  isCalling: () => false,
  callingPhone: null,
};

export function useGtelCallSession(): GtelCallSessionValue {
  return useContext(GtelCallSessionContext) ?? NOOP_SESSION;
}
