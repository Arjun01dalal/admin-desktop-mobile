/**
 * Shared manual C2C click-to-call — used by Gtel Calls, Played Today/Yesterday, etc.
 */
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';

import { createGtelCallId, sanitizeGtelPhone } from '@astro/shared';
import { secureApi } from '@/api/secureClient';

import { useGtelAuth } from './useGtelAuth';

type StartC2cOptions = {
  /** Optional callback after a successful dial (e.g. refetch list). */
  onSuccess?: () => void;
};

export function useGtelClickToCall(options?: StartC2cOptions) {
  const { admin, loginExtensionId, canShowC2c } = useGtelAuth();
  const [callingPhone, setCallingPhone] = useState<string | null>(null);
  const onSuccess = options?.onSuccess;

  const startC2c = useCallback(
    async (phoneRaw: string, userId?: string) => {
      const phone = sanitizeGtelPhone(phoneRaw);
      if (!phone) {
        toast.error('Phone number is required');
        return false;
      }
      if (!loginExtensionId) {
        toast.error('Extension not found for your account');
        return false;
      }
      setCallingPhone(phone);
      try {
        const callId = createGtelCallId();
        const res = await secureApi('gtel.clickToCall', {
          callId,
          phoneNumber: phone,
          extension: loginExtensionId,
          userId: userId || '',
          subAdminId: String(admin?._id || ''),
          source: 'Manual',
        });
        if (!res.ok || res.success === false) {
          toast.error(res.message || 'Call could not be initiated');
          return false;
        }
        toast.success('Call initiated');
        onSuccess?.();
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Call failed');
        return false;
      } finally {
        setCallingPhone(null);
      }
    },
    [admin?._id, loginExtensionId, onSuccess],
  );

  return {
    canShowC2c,
    callingPhone,
    startC2c,
    isCalling: (phoneRaw: string) => {
      const phone = sanitizeGtelPhone(phoneRaw);
      return Boolean(phone && callingPhone === phone);
    },
  };
}
