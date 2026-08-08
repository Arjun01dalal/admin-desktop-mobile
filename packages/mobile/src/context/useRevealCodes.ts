import { useSyncExternalStore } from 'react';
import {
  activateRevealCodes,
  clearRevealCodes,
  getRevealCodesUntil,
  subscribeRevealCodes,
} from './revealCodesStore';

/** Subscribe to temporary original-name reveal (OTP-gated, 1 hour). */
export function useRevealCodes() {
  const expiresAt = useSyncExternalStore(subscribeRevealCodes, getRevealCodesUntil, () => 0);
  const active = expiresAt > Date.now();
  return { active, expiresAt, activate: activateRevealCodes, clear: clearRevealCodes };
}
