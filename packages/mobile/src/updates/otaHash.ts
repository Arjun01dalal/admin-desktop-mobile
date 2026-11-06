/**
 * Stallion sometimes returns a truncated checksum (32 hex) while the native
 * active hash is full (64). Treat prefix matches as equal.
 */
export function otaHashesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = typeof a === 'string' ? a.trim().toLowerCase() : '';
  const right = typeof b === 'string' ? b.trim().toLowerCase() : '';
  if (!left || !right) return false;
  if (left === right) return true;
  const n = Math.min(left.length, right.length);
  if (n < 16) return false;
  return left.slice(0, n) === right.slice(0, n);
}

export function getActiveOtaHash(): string | null {
  try {
    const { ACTIVE_RELEASE_HASH } = require('react-native-stallion') as {
      ACTIVE_RELEASE_HASH?: string | null;
    };
    if (typeof ACTIVE_RELEASE_HASH === 'string' && ACTIVE_RELEASE_HASH.trim()) {
      return ACTIVE_RELEASE_HASH.trim();
    }
  } catch {
    /* Stallion unavailable */
  }
  return null;
}

/** True when the offered / downloaded release is already what this JS session runs. */
export function isAlreadyRunningOta(releaseHash: string | null | undefined): boolean {
  return otaHashesEqual(releaseHash, getActiveOtaHash());
}
