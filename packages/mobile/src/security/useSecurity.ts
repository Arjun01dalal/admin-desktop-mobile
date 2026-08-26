/**
 * useSecurity — aggregates runtime protections.
 * Preview builds: no freeRASP.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { enableScreenshotBlock, disableScreenshotBlock } from './screenshot';
import { useRaspThreats } from './raspGuard';
import type { ThreatKind } from './rasp';

export type SecurityStatus = {
  threats: ThreatKind[];
  blocked: boolean;
  refresh: () => Promise<void>;
};

const BLOCKING: ThreatKind[] = [
  'privilegedAccess',
  'hooks',
  'appIntegrity',
  'simulator',
];

export function useSecurity(): SecurityStatus {
  useEffect(() => {
    void enableScreenshotBlock().catch(() => undefined);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void enableScreenshotBlock().catch(() => undefined);
    });
    return () => {
      sub.remove();
      void disableScreenshotBlock().catch(() => undefined);
    };
  }, []);

  const { threats: raspThreats } = useRaspThreats();
  // Preview: do not hard-block on freeRASP integrity (sideload false positives).
  const threats = raspThreats.filter(
    (t) =>
      t !== 'appIntegrity' &&
      t !== 'unofficialStore' &&
      // VPN must not lock the panel — staff often work over VPN.
      t !== 'systemVPN',
  );

  const blocked = threats.some((t) => BLOCKING.includes(t));
  return { threats, blocked, refresh: async () => {} };
}
