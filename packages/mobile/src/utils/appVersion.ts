import Constants from 'expo-constants';

/**
 * Version of the running native binary (EAS remote / app.json), plus build number when present.
 */
export function getAppVersion(): string {
  const version =
    Constants.nativeAppVersion ||
    Constants.expoConfig?.version ||
    '1.0.0';
  const build = Constants.nativeBuildVersion;
  if (build && String(build) !== String(version)) {
    return `${version} (${build})`;
  }
  return String(version);
}
