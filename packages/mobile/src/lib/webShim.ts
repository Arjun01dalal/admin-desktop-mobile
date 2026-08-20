/**
 * Web-API shims so shared desktop code (permissions.ts) runs unmodified in React Native.
 * Provides a synchronous localStorage backed by AsyncStorage and a minimal window.dispatchEvent.
 * Session token + user JSON are stored in expo-secure-store (see secureStorage.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SECURE_TOKEN_KEY,
  SECURE_USER_KEY,
  eraseSessionSecrets,
  eraseToken,
  eraseUser,
  hydrateToken,
  hydrateUser,
  persistToken,
  persistUser,
} from './secureStorage';

type Listener = () => void;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<Listener>>();
let hydrated = false;

const SECURE_CACHE_KEYS = new Set([SECURE_TOKEN_KEY, SECURE_USER_KEY]);

function persistSecureKey(key: string, value: string): void {
  if (key === SECURE_TOKEN_KEY) void persistToken(value);
  else if (key === SECURE_USER_KEY) void persistUser(value);
}

function eraseSecureKey(key: string): void {
  if (key === SECURE_TOKEN_KEY) void eraseToken();
  else if (key === SECURE_USER_KEY) void eraseUser();
}

export async function hydrateStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  for (const k of keys) {
    if (SECURE_CACHE_KEYS.has(k)) continue;
    const v = await AsyncStorage.getItem(k);
    if (v != null) cache.set(k, v);
  }
  const [token, user] = await Promise.all([hydrateToken(), hydrateUser()]);
  if (token) cache.set(SECURE_TOKEN_KEY, token);
  if (user) cache.set(SECURE_USER_KEY, user);
  hydrated = true;
}

export function isStorageHydrated(): boolean {
  return hydrated;
}

const storageShim = {
  getItem(key: string): string | null {
    return cache.has(key) ? (cache.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    cache.set(key, String(value));
    if (SECURE_CACHE_KEYS.has(key)) {
      persistSecureKey(key, String(value));
      return;
    }
    void AsyncStorage.setItem(key, String(value));
  },
  removeItem(key: string): void {
    cache.delete(key);
    if (SECURE_CACHE_KEYS.has(key)) {
      eraseSecureKey(key);
      return;
    }
    void AsyncStorage.removeItem(key);
  },
  clear(): void {
    cache.clear();
    void AsyncStorage.clear();
    void eraseSessionSecrets();
  },
};

export function addAppEventListener(name: string, fn: Listener): () => void {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(fn);
  return () => listeners.get(name)?.delete(fn);
}

const windowShim = {
  dispatchEvent(evt: { type?: string } | Event): boolean {
    const name = (evt as { type?: string })?.type ?? '';
    listeners.get(name)?.forEach((fn) => fn());
    return true;
  },
};

const g = globalThis as Record<string, unknown>;
if (typeof g.localStorage === 'undefined') g.localStorage = storageShim;
if (typeof g.window === 'undefined') g.window = windowShim;
else if (typeof (g.window as Record<string, unknown>).dispatchEvent === 'undefined') {
  (g.window as Record<string, unknown>).dispatchEvent = windowShim.dispatchEvent;
}
// Minimal Event constructor for `new Event('...')` in shared code.
if (typeof g.Event === 'undefined') {
  g.Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}

export function getStoredUser<T = Record<string, unknown>>(): T | null {
  try {
    const raw = storageShim.getItem(SECURE_USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const appStorage = storageShim;
