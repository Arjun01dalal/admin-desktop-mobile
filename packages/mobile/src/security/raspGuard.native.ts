/**
 * Native RASP guard — starts freeRASP and reports detected threats.
 *
 * freeRASP threats are treated as sticky: once a device is found rooted /
 * hooked / tampered, we do not un-flag it for the rest of the session.
 * (VPN toggling is handled separately by the NetInfo source in useSecurity.)
 */
import { useState } from 'react';
import { useFreeRasp } from 'freerasp-react-native';
import { raspConfig, type ThreatKind } from './rasp';

export function useRaspThreats(): { threats: ThreatKind[] } {
  const [threats, setThreats] = useState<ThreatKind[]>([]);

  const raise = (kind: ThreatKind) =>
    setThreats((prev) => (prev.includes(kind) ? prev : [...prev, kind]));

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
