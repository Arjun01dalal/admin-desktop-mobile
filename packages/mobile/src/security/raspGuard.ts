/**
 * Default (web / non-native) RASP guard — no-op.
 * Metro loads raspGuard.native.ts on iOS/Android instead.
 */
import type { ThreatKind } from './rasp';

export function useRaspThreats(): { threats: ThreatKind[] } {
  return { threats: [] };
}
