/**
 * Shared device id for Astro site auth (login / forgot OTP).
 */
const DEVICE_ID_KEY = 'astro_site_device_id_v1';

function randomId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getAstroSiteDeviceId(): string {
  try {
    const existing = String(localStorage.getItem(DEVICE_ID_KEY) || '').trim();
    if (existing) return existing;
    const next = randomId();
    localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}
