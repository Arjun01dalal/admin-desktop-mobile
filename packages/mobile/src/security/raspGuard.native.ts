/**
 * Native RASP guard — starts freeRASP and reports detected threats.
 *
 * freeRASP threats are treated as sticky: once a device is found rooted /
 * hooked / tampered, we do not un-flag it for the rest of the session.
 * (VPN toggling is handled separately by the NetInfo source in useSecurity.)
 */
import { useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { raspConfig, type ThreatKind } from './rasp';

/**
 * freeRASP is a custom native module that is NOT bundled inside the Expo Go
 * store client. Calling it there throws "Exception in HostFunction". Only
 * load and start it in a real dev/production build (bare / expo run / EAS).
 * This is constant for the entire app lifetime, so the conditional hook
 * call below never changes order between renders.
 */
const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function useRaspThreats(): { threats: ThreatKind[] } {
  const [threats, setThreats] = useState<ThreatKind[]>([]);

  const raise = (kind: ThreatKind) =>
    setThreats((prev) => (prev.includes(kind) ? prev : [...prev, kind]));

  if (IS_EXPO_GO) {
    // Expo Go: native protection layer unavailable; no-op (dev only).
    return { threats };
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useFreeRasp } = require('freerasp-react-native') as typeof import('freerasp-react-native');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useFreeRasp(raspConfig, {
    privilegedAccess: () => raise('privilegedAccess'),
    hooks: () => raise('hooks'),
    debug: () => raise('debug'),
    simulator: () => raise('simulator'),
    appIntegrity: () => raise('appIntegrity'),
    unofficialStore: () => raise('unofficialStore'),
    deviceBinding: () => raise('deviceBinding'),
    systemVPN: () => raise('systemVPN'),
    obfuscationIssues: () => raise('obfuscationIssues'),
    devMode: () => raise('devMode'),
    adbEnabled: () => raise('adbEnabled'),
    screenshot: () => raise('screenshot'),
    screenRecording: () => raise('screenRecording'),
  });

  return { threats };
}
