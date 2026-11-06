import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

function getNativeSemver(): string {
  return String(Constants.nativeAppVersion || Constants.expoConfig?.version || '1.0.0');
}

/**
 * Version of the running native binary (EAS / app.json), plus build number when present.
 */
export function getAppVersion(): string {
  const version = getNativeSemver();
  const build = Constants.nativeBuildVersion;
  if (build && String(build) !== String(version)) {
    return `${version} (${build})`;
  }
  return version;
}

function stallionReadable(): boolean {
  if (Platform.OS === 'web' || __DEV__) return false;
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo';
  return !inExpoGo;
}

/**
 * Short Stallion OTA hash when the JS bundle is running from a downloaded
 * release (not the embedded APK bundle). Null when no CodePush is applied.
 */
export function getOtaReleaseHashShort(): string | null {
  if (!stallionReadable()) return null;
  try {
    // Lazy require — native module missing in Expo Go / odd binaries.
    const { ACTIVE_RELEASE_HASH } = require('react-native-stallion') as {
      ACTIVE_RELEASE_HASH?: string | null;
    };
    if (typeof ACTIVE_RELEASE_HASH === 'string' && ACTIVE_RELEASE_HASH.trim().length >= 8) {
      return ACTIVE_RELEASE_HASH.trim().slice(0, 8);
    }
  } catch {
    /* Stallion unavailable */
  }
  return null;
}

/**
 * Label for UI: native version alone, or with Stallion OTA counter when active.
 *
 * Examples:
 *   "1.1.1"
 *   "1.1.1 (2)"          — native build, no OTA
 *   "1.1.1 (V7)"         — OTA release version 7 applied
 */
export function formatAppVersionLabel(opts?: {
  /** Stallion bundle meta `version` (incremental), when known */
  otaVersion?: number | null;
  /** True when a downloaded OTA release is running */
  otaActive?: boolean | null;
}): string {
  const otaVersion = opts?.otaVersion;
  const otaActive =
    opts?.otaActive === true ||
    (typeof otaVersion === 'number' && Number.isFinite(otaVersion) && otaVersion > 0);

  if (otaActive && typeof otaVersion === 'number' && Number.isFinite(otaVersion) && otaVersion > 0) {
    return `${getNativeSemver()} (V${otaVersion})`;
  }
  return getAppVersion();
}
