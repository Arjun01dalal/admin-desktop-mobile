/**
 * freeRASP runtime application self-protection.
 *
 * Detects rooted/jailbroken devices, hooking frameworks (Frida/Xposed),
 * emulators, debuggers, tampered/repackaged builds, and active system VPN.
 *
 * Native-only: on web preview the hook is a no-op so the app still renders.
 */
import { Platform } from 'react-native';

export type ThreatKind =
  | 'privilegedAccess' // root / jailbreak
  | 'hooks' // Frida / Xposed / Cydia Substrate
  | 'debug'
  | 'simulator'
  | 'appIntegrity' // repackaged / resigned
  | 'unofficialStore'
  | 'deviceBinding'
  | 'systemVPN'
  | 'devMode'
  | 'adbEnabled'
  | 'obfuscationIssues'
  | 'screenshot'
  | 'screenRecording';

export type ThreatHandler = (kind: ThreatKind) => void;

/**
 * freeRASP configuration.
 *
 * NOTE: certificateHashes / teamId / bundle ids MUST be filled in with the
 * real signing values before a production build, or integrity checks will
 * fire on every launch. `isProd: false` (dev) relaxes signing checks so the
 * app is testable in Expo dev builds.
 */
export const RASP_IS_PROD = process.env.EXPO_PUBLIC_RASP_PROD === '1';

export const raspConfig = {
  androidConfig: {
    packageName: process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.astro.admin',
    certificateHashes: (process.env.EXPO_PUBLIC_ANDROID_CERT_HASHES ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
    supportedAlternativeStores: [] as string[],
  },
  iosConfig: {
    appBundleId: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? 'com.astro.admin',
    appTeamId: process.env.EXPO_PUBLIC_IOS_TEAM_ID ?? '',
  },
  watcherMail: process.env.EXPO_PUBLIC_RASP_MAIL ?? 'security@astro.local',
  isProd: RASP_IS_PROD,
  // Terminate the app if the native protection layer is bypassed/hooked.
  killOnBypass: RASP_IS_PROD,
};

export function isRaspSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
