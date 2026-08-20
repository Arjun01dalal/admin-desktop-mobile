/**
 * Native RASP guard — starts freeRASP and reports detected threats.
 *
 * Preview/testing builds skip freeRASP entirely (native plugin removed + flag)
 * because misconfigured prod RASP was crashing sideloaded APKs on launch.
 */
import { useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { raspConfig, type ThreatKind } from './rasp';

const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const RASP_DISABLED =
  IS_EXPO_GO ||
  process.env.EXPO_PUBLIC_DISABLE_RASP === '1' ||
  Boolean((Constants.expoConfig?.extra as { raspDisabled?: boolean } | undefined)?.raspDisabled);

type FreeRaspHook = typeof import('freerasp-react-native').useFreeRasp;

let useFreeRaspHook: FreeRaspHook | null = null;
if (!RASP_DISABLED) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    useFreeRaspHook = (require('freerasp-react-native') as typeof import('freerasp-react-native'))
      .useFreeRasp;
  } catch {
    useFreeRaspHook = null;
  }
}

function useNoopRaspThreats(): { threats: ThreatKind[] } {
  return { threats: [] };
}

function useActiveRaspThreats(): { threats: ThreatKind[] } {
  const [threats, setThreats] = useState<ThreatKind[]>([]);
  const raise = (kind: ThreatKind) =>
    setThreats((prev) => (prev.includes(kind) ? prev : [...prev, kind]));

  // Hook is always present when this function is selected.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useFreeRaspHook!(raspConfig, {
    privilegedAccess: () => raise('privilegedAccess'),
    hooks: () => raise('hooks'),
    debug: () => raise('debug'),
    simulator: () => raise('simulator'),
    appIntegrity: () => raise('appIntegrity'),
    unofficialStore: () => raise('unofficialStore'),
    deviceBinding: () => raise('deviceBinding'),
    obfuscationIssues: () => raise('obfuscationIssues'),
    devMode: () => raise('devMode'),
    adbEnabled: () => raise('adbEnabled'),
    screenshot: () => raise('screenshot'),
    screenRecording: () => raise('screenRecording'),
  });

  return { threats };
}

export function useRaspThreats(): { threats: ThreatKind[] } {
  const enabled = Boolean(useFreeRaspHook) && !RASP_DISABLED;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return enabled ? useActiveRaspThreats() : useNoopRaspThreats();
}
