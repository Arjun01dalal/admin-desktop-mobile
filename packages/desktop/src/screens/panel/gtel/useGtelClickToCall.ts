/**
 * Shared manual C2C click-to-call — used by Gtel Calls, Played Today/Yesterday, etc.
 * Opens the shell-level Active Call modal (admin Click2CallBtn parity).
 */
import { useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { sanitizeGtelPhone, type GtelC2cTarget } from '@astro/shared';
import { useGtelAuth } from './useGtelAuth';
import { useGtelCallSession } from './GtelCallSession';

type StartC2cOptions = {
  /** Fired when the Active Call modal ends hangup successfully. */
  onSuccess?: () => void;
};

export function useGtelClickToCall(options?: StartC2cOptions) {
  // Visibility from auth (stable) — not from session NOOP fallback.
  const { canShowC2c } = useGtelAuth();
  const { startC2c: sessionStart, isCalling, callingPhone } = useGtelCallSession();
  const onSuccessRef = useRef(options?.onSuccess);
  onSuccessRef.current = options?.onSuccess;

  const startC2c = useCallback(
    async (phoneRaw: string | GtelC2cTarget, userId?: string) => {
      if (!canShowC2c) {
        toast.error('C2C not available for your account');
        return false;
      }
      const onEnded = () => onSuccessRef.current?.();
      const ok =
        typeof phoneRaw === 'string'
          ? sessionStart(phoneRaw, userId, onEnded)
          : sessionStart(phoneRaw, undefined, onEnded);
      if (!ok) {
        const phone =
          typeof phoneRaw === 'string'
            ? sanitizeGtelPhone(phoneRaw)
            : sanitizeGtelPhone(phoneRaw.phoneNumber);
        if (!phone) toast.error('Phone number is required');
        else toast.error('Call could not be initiated');
        return false;
      }
      return true;
    },
    [canShowC2c, sessionStart],
  );

  return {
    canShowC2c,
    callingPhone,
    startC2c,
    isCalling,
  };
}
