/**
 * Temporary reveal of original (non-Jyotish) UI labels after OTP verify.
 * Valid for 1 hour, then auto-resets.
 */

const STORAGE_KEY = 'astroRevealCodesUntil';
export const REVEAL_CODES_TTL_MS = 60 * 60 * 1000; // 1 hour

type Listener = () => void;

const listeners = new Set<Listener>();
let until = readUntil();
let timer: ReturnType<typeof setTimeout> | null = null;

function readUntil(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function scheduleExpiry() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const remaining = until - Date.now();
  if (remaining <= 0) {
    if (until > 0) clearRevealCodes();
    return;
  }
  timer = setTimeout(() => {
    clearRevealCodes();
  }, remaining);
}

export function getRevealCodesUntil(): number {
  return until;
}

export function isRevealCodesActive(): boolean {
  return Date.now() < until;
}

export function activateRevealCodes(ttlMs = REVEAL_CODES_TTL_MS): void {
  until = Date.now() + ttlMs;
  try {
    localStorage.setItem(STORAGE_KEY, String(until));
  } catch {
    // ignore quota / private mode
  }
  emit();
  scheduleExpiry();
}

export function clearRevealCodes(): void {
  until = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  emit();
}

export function subscribeRevealCodes(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Restore / clear stale session on load
if (until > 0) {
  if (Date.now() >= until) {
    until = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  } else {
    scheduleExpiry();
  }
}
