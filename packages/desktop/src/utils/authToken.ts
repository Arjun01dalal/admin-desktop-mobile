/**
 * Renderer auth token helpers — memory cache + OS-encrypted main vault.
 * Avoids keeping JWT in localStorage when Electron safeStorage is available.
 */

const LEGACY_KEY = 'token';

let memoryToken: string | null = null;
let initPromise: Promise<void> | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  // Brief sync fallback while initAuthToken() migrates legacy storage.
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    return legacy && legacy.trim() ? legacy.trim() : null;
  } catch {
    return null;
  }
}

export async function initAuthToken(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const res = await window.gcalc?.getSessionToken?.();
      if (res?.token) {
        memoryToken = res.token;
        localStorage.removeItem(LEGACY_KEY);
        return;
      }
    } catch {
      // ignore
    }

    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy && legacy.trim()) {
        memoryToken = legacy.trim();
        await window.gcalc?.setSessionToken?.(memoryToken);
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch {
      // ignore
    }
  })();
  return initPromise;
}

export async function setAuthToken(token: string): Promise<void> {
  const value = String(token || '').trim();
  memoryToken = value || null;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  if (value) {
    await window.gcalc?.setSessionToken?.(value);
  } else {
    await window.gcalc?.clearSessionToken?.();
  }
}

export async function clearAuthToken(): Promise<void> {
  memoryToken = null;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
  try {
    await window.gcalc?.clearSessionToken?.();
  } catch {
    // ignore
  }
}
