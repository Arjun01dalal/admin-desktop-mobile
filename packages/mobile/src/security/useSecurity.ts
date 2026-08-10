/**
 * useSecurity — aggregates all runtime protections:
 *  - screenshot / screen-recording block for the whole app session
 *  - freeRASP (native): root/jailbreak, hooking, emulator, debugger, tamper, VPN
 *  - NetInfo VPN source (native): independent, toggle-able VPN signal
 *
 * On web everything degrades to a no-op so the UI still renders.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { enableScreenshotBlock, disableScreenshotBlock } from './screenshot';
import { useRaspThreats } from './raspGuard';
import type { ThreatKind } from './rasp';

export type SecurityStatus = {
  threats: ThreatKind[];
  /** True when a blocking threat (root/hook/tamper/emulator/VPN) is active. */
  blocked: boolean;
  /** Re-queries the current network/VPN state (for the "Check again" button). */
  refresh: () => Promise<void>;
};

const BLOCKING: ThreatKind[] = [
  'privilegedAccess',
  'hooks',
  'appIntegrity',
  'simulator',
  'systemVPN',
];

/** Independent NetInfo VPN detector (native only). Toggles on/off with the network. */
function useNetInfoVpn(): { vpn: boolean; refresh: () => Promise<void> } {
  const [vpn, setVpn] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NetInfo = require('@react-native-community/netinfo').default;
        if (cancelled) return;
        unsubscribe = NetInfo.addEventListener((state: { type?: string }) => {
          // Only Android reliably reports a dedicated 'vpn' connection type.
          // iOS VPN detection is left to freeRASP to avoid false positives.
          setVpn(state?.type === 'vpn');
        });
      } catch {
        /* NetInfo unavailable */
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // Forces a fresh read (used by the "Check again" button so the user can
  // disable their VPN and re-enter the app without restarting).
  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NetInfo = require('@react-native-community/netinfo').default;
      const state = await NetInfo.refresh();
      setVpn(state?.type === 'vpn');
    } catch {
      /* NetInfo unavailable */
    }
  }, []);

  return { vpn, refresh };
}

export function useSecurity(): SecurityStatus {
  // Screenshot block — app-wide policy; enable now, re-assert on foreground,
  // and release on unmount.
  useEffect(() => {
    void enableScreenshotBlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void enableScreenshotBlock();
    });
    return () => {
      sub.remove();
      void disableScreenshotBlock();
    };
  }, []);

  const { threats: raspThreats } = useRaspThreats();
  const { vpn: netVpn, refresh } = useNetInfoVpn();

  const threats = netVpn && !raspThreats.includes('systemVPN')
    ? [...raspThreats, 'systemVPN' as ThreatKind]
    : raspThreats;

  const blocked = threats.some((t) => BLOCKING.includes(t));
  return { threats, blocked, refresh };
}
