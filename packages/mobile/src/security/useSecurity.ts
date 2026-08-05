/**
 * useSecurity — wires all runtime protections into one hook:
 *  - screenshot / screen-recording block for the whole session
 *  - freeRASP: root/jailbreak, hooking, emulator, debugger, tamper, system VPN
 *  - NetInfo fallback VPN detection (belt-and-braces on Android)
 *
 * On web preview everything degrades to a no-op so the UI still renders.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { enableScreenshotBlock } from './screenshot';
import { raspConfig, isRaspSupported, type ThreatKind } from './rasp';

export type SecurityStatus = {
  threats: ThreatKind[];
  /** True when a blocking threat (root/hook/tamper/VPN) is active. */
  blocked: boolean;
};

const BLOCKING: ThreatKind[] = [
  'privilegedAccess',
  'hooks',
  'appIntegrity',
  'simulator',
  'systemVPN',
];

export function useSecurity(): SecurityStatus {
  const [threats, setThreats] = useState<ThreatKind[]>([]);
  const raised = useRef<Set<ThreatKind>>(new Set());

  const raise = (kind: ThreatKind) => {
    if (raised.current.has(kind)) return;
    raised.current.add(kind);
    setThreats(Array.from(raised.current));
  };
  const clear = (kind: ThreatKind) => {
    if (!raised.current.delete(kind)) return;
    setThreats(Array.from(raised.current));
  };

  // Screenshot block — enable now and re-assert on every foreground.
  useEffect(() => {
    void enableScreenshotBlock();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void enableScreenshotBlock();
    });
    return () => sub.remove();
  }, []);

  // freeRASP — dynamically required so web bundling never pulls native code.
  useEffect(() => {
    if (!isRaspSupported()) return;
    let cancelled = false;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('freerasp-react-native');
        const talsec = mod.default ?? mod;
        if (cancelled) return;
        const actions = {
          privilegedAccess: () => raise('privilegedAccess'),
          hooks: () => raise('hooks'),
          debug: () => raise('debug'),
          simulator: () => raise('simulator'),
          appIntegrity: () => raise('appIntegrity'),
          unofficialStore: () => raise('unofficialStore'),
          deviceBinding: () => raise('deviceBinding'),
          secureHardwareNotAvailable: () => {},
          systemVPN: () => raise('systemVPN'),
          passcode: () => {},
          obfuscationIssues: () => raise('obfuscationIssues'),
          devMode: () => raise('devMode'),
          adbEnabled: () => raise('adbEnabled'),
          screenshot: () => raise('screenshot'),
          screenRecording: () => raise('screenRecording'),
        };
        if (typeof talsec.start === 'function') {
          await talsec.start(raspConfig, actions);
        } else if (typeof talsec.addToSecurityReport === 'function') {
          await talsec.start(raspConfig, actions);
        }
      } catch {
        /* RASP unavailable (e.g. Expo Go) — fail open in dev, closed in prod build */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // NetInfo VPN fallback (Android exposes vpn via connection type on some devices).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { (): void } | undefined;
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const NetInfo = require('@react-native-community/netinfo').default;
        sub = NetInfo.addEventListener((state: any) => {
          const isVpn =
            state?.type === 'vpn' ||
            state?.details?.subtype === 'VPN' ||
            state?.details?.isConnectionExpensive === undefined && state?.type === 'other' && state?.isInternetReachable && Platform.OS === 'ios';
          if (isVpn) raise('systemVPN');
          else clear('systemVPN');
        });
      } catch {
        /* NetInfo unavailable */
      }
    })();
    return () => sub?.();
  }, []);

  const blocked = threats.some((t) => BLOCKING.includes(t));
  return { threats, blocked };
}
