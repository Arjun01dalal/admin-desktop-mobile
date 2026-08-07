/**
 * Web-API shims so shared desktop code (permissions.ts) runs unmodified in React Native.
 * Provides a synchronous localStorage backed by AsyncStorage and a minimal window.dispatchEvent.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = () => void;
const cache = new Map<string, string>();
const listeners = new Map<string, Set<Listener>>();
let hydrated = false;

export async function hydrateStorage(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    if (v != null) cache.set(k, v);
  }
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
    void AsyncStorage.setItem(key, String(value));
  },
  removeItem(key: string): void {
    cache.delete(key);
    void AsyncStorage.removeItem(key);
  },
  clear(): void {
    cache.clear();
    void AsyncStorage.clear();
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
    const raw = storageShim.getItem('user');
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const appStorage = storageShim;
