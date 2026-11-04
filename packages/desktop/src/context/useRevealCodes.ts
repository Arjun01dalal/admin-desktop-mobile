import { useSyncExternalStore } from 'react';
import {
  activateRevealCodes,
  clearRevealCodes,
  getRevealCodesUntil,
  isRevealCodesActive,
  subscribeRevealCodes,
} from './revealCodesStore';

/** Subscribe to temporary original-name reveal (OTP-gated, 1 hour). */
export function useRevealCodes() {
  // Single snapshot (expiresAt) — clearing sets 0 so UI flips immediately on toggle-off.
  const expiresAt = useSyncExternalStore(subscribeRevealCodes, getRevealCodesUntil, () => 0);
  // Re-read role-aware flag when store ticks (and on every render for full_access).
  void expiresAt;
  const active = isRevealCodesActive();

  return {
    active,
    expiresAt,
    activate: activateRevealCodes,
    clear: clearRevealCodes,
  };
}
