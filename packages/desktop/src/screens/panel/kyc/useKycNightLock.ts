import { useCallback, useEffect, useState } from 'react';
import { isKycNightHours, NIGHT_LOCK_KEY, NIGHT_UNLOCK_MS } from './types';

/**
 * KYC night lock (8pm–10am IST). Enable-flow OTP unlocks for 1 minute.
 */
export function useKycNightLock() {
  const [isNightLockActive, setIsNightLockActive] = useState(false);
  const [disableNightCheck, setDisableNightCheck] = useState(false);

  useEffect(() => {
    const unlockUntil = localStorage.getItem(NIGHT_LOCK_KEY);
    if (unlockUntil && Date.now() < Number(unlockUntil)) {
      setDisableNightCheck(true);
      setIsNightLockActive(false);
      const remaining = Number(unlockUntil) - Date.now();
      const t = window.setTimeout(() => {
        setIsNightLockActive(true);
        setDisableNightCheck(false);
        localStorage.removeItem(NIGHT_LOCK_KEY);
      }, remaining);
      return () => window.clearTimeout(t);
    }
    if (unlockUntil) localStorage.removeItem(NIGHT_LOCK_KEY);
    return undefined;
  }, []);

  useEffect(() => {
    if (disableNightCheck) return undefined;

    const checkTime = () => setIsNightLockActive(isKycNightHours());
    checkTime();
    const interval = window.setInterval(checkTime, 60_000);
    return () => window.clearInterval(interval);
  }, [disableNightCheck]);

  const unlockNightLock = useCallback(() => {
    const unlockUntil = Date.now() + NIGHT_UNLOCK_MS;
    localStorage.setItem(NIGHT_LOCK_KEY, String(unlockUntil));
    setIsNightLockActive(false);
    setDisableNightCheck(true);
    window.setTimeout(() => {
      setIsNightLockActive(true);
      setDisableNightCheck(false);
      localStorage.removeItem(NIGHT_LOCK_KEY);
    }, NIGHT_UNLOCK_MS);
  }, []);

  return {
    isNightLockActive,
    setIsNightLockActive,
    disableNightCheck,
    setDisableNightCheck,
    unlockNightLock,
  };
}
