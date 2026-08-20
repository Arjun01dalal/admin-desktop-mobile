/**
 * freeRASP runtime application self-protection.
 *
 * Detects rooted/jailbroken devices, hooking frameworks (Frida/Xposed),
 * emulators, debuggers, and tampered/repackaged builds.
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
 * Android certificateHashes must be Base64(SHA-256) of the release signing cert.
 * Default below is the EAS remote keystore used for @arjun1308/astro production APKs.
 * Override with EXPO_PUBLIC_ANDROID_CERT_HASHES if the signing key changes.
 *
 * Prod RASP: EXPO_PUBLIC_RASP_PROD=1 (and hashes present). Preview keeps RASP off.
 */
/** EAS Build Credentials keystore — SHA-256 Base64 (from apksigner on signed APK). */
const DEFAULT_ANDROID_CERT_HASH = 'Tu3djWkQPOFLVbzfw3yUYJF0ag/0Ypyn7ML4887z+/0=';

const CERT_HASHES = (process.env.EXPO_PUBLIC_ANDROID_CERT_HASHES ?? DEFAULT_ANDROID_CERT_HASH)
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

export const RASP_IS_PROD =
  process.env.EXPO_PUBLIC_RASP_PROD === '1' && CERT_HASHES.length > 0;

export const raspConfig = {
  androidConfig: {
    packageName: process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'vip.astrotalk.panel',
    certificateHashes: CERT_HASHES,
    supportedAlternativeStores: [] as string[],
  },
  iosConfig: {
    appBundleId: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID ?? 'vip.astrotalk.panel',
    appTeamId: process.env.EXPO_PUBLIC_IOS_TEAM_ID ?? '',
  },
  watcherMail: process.env.EXPO_PUBLIC_RASP_MAIL ?? 'security@astrotalk.vip',
  // Prod RASP (EXPO_PUBLIC_RASP_PROD=1): full signing / store / emulator checks.
  isProd: RASP_IS_PROD,
  // Keep false for APK sideload — native kill looks like a launch crash.
  // SecurityGate still locks the UI on root / hooks / etc.
  killOnBypass: false,
};

export function isRaspSupported(): boolean {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}
