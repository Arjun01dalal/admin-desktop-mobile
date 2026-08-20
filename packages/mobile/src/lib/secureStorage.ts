/**
 * Session secrets — expo-secure-store (Keychain / EncryptedSharedPreferences).
 * Falls back to AsyncStorage on web or when SecureStore is unavailable.
 *
 * Large values (e.g. user JSON) are split into chunks because SecureStore
 * rejects payloads over ~2048 bytes on some devices.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** appStorage / localStorage cache keys */
export const SECURE_TOKEN_KEY = 'token';
export const SECURE_USER_KEY = 'user';

/** SecureStore key namespace (may differ from cache keys for chunk metadata). */
const STORE_TOKEN = 'astro_session_token';
const STORE_USER = 'astro_session_user';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Stay under SecureStore's ~2048-byte limit per entry. */
const CHUNK_SIZE = 1800;

async function secureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function readLegacy(asyncKey: string): Promise<string | null> {
  return AsyncStorage.getItem(asyncKey);
}

async function removeLegacy(asyncKey: string): Promise<void> {
  await AsyncStorage.removeItem(asyncKey);
}

async function readChunkCount(storeKey: string): Promise<number> {
  const meta = await SecureStore.getItemAsync(`${storeKey}__chunks`, SECURE_OPTIONS);
  if (!meta) return 0;
  const n = Number(meta);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function eraseChunks(storeKey: string): Promise<void> {
  const count = await readChunkCount(storeKey);
  try {
    await SecureStore.deleteItemAsync(`${storeKey}__chunks`, SECURE_OPTIONS);
  } catch {
    /* already removed */
  }
  for (let i = 0; i < count; i++) {
    try {
      await SecureStore.deleteItemAsync(`${storeKey}__${i}`, SECURE_OPTIONS);
    } catch {
      /* already removed */
    }
  }
}

async function readSecureValue(storeKey: string, asyncKey: string): Promise<string | null> {
  if (!(await secureStoreAvailable())) {
    return readLegacy(asyncKey);
  }

  const single = await SecureStore.getItemAsync(storeKey, SECURE_OPTIONS);
  if (single) {
    await removeLegacy(asyncKey);
    return single;
  }

  const chunkCount = await readChunkCount(storeKey);
  if (chunkCount > 0) {
    const parts: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const part = await SecureStore.getItemAsync(`${storeKey}__${i}`, SECURE_OPTIONS);
      if (part == null) return null;
      parts.push(part);
    }
    await removeLegacy(asyncKey);
    return parts.join('');
  }

  const legacy = await readLegacy(asyncKey);
  if (legacy) {
    await writeSecureValue(storeKey, asyncKey, legacy);
    await removeLegacy(asyncKey);
    return legacy;
  }

  return null;
}

async function writeSecureValue(
  storeKey: string,
  asyncKey: string,
  value: string,
): Promise<void> {
  const trimmed = String(value ?? '');
  if (!trimmed) {
    await eraseSecureValue(storeKey, asyncKey);
    return;
  }

  if (!(await secureStoreAvailable())) {
    await AsyncStorage.setItem(asyncKey, trimmed);
    return;
  }

  try {
    if (trimmed.length <= CHUNK_SIZE) {
      await eraseChunks(storeKey);
      await SecureStore.setItemAsync(storeKey, trimmed, SECURE_OPTIONS);
    } else {
      try {
        await SecureStore.deleteItemAsync(storeKey, SECURE_OPTIONS);
      } catch {
        /* single-key copy may not exist */
      }
      const chunks = Math.ceil(trimmed.length / CHUNK_SIZE);
      await SecureStore.setItemAsync(`${storeKey}__chunks`, String(chunks), SECURE_OPTIONS);
      for (let i = 0; i < chunks; i++) {
        const slice = trimmed.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await SecureStore.setItemAsync(`${storeKey}__${i}`, slice, SECURE_OPTIONS);
      }
    }
    await removeLegacy(asyncKey);
  } catch (err) {
    console.warn(`[secureStorage] SecureStore write failed for ${asyncKey}; using AsyncStorage`, err);
    await eraseSecureValue(storeKey, asyncKey);
    await AsyncStorage.setItem(asyncKey, trimmed);
  }
}

async function eraseSecureValue(storeKey: string, asyncKey: string): Promise<void> {
  if (await secureStoreAvailable()) {
    try {
      await SecureStore.deleteItemAsync(storeKey, SECURE_OPTIONS);
    } catch {
      /* already removed */
    }
    await eraseChunks(storeKey);
  }
  await removeLegacy(asyncKey);
}

/** Load token from SecureStore, migrating any legacy AsyncStorage copy. */
export async function hydrateToken(): Promise<string | null> {
  return readSecureValue(STORE_TOKEN, SECURE_TOKEN_KEY);
}

export async function persistToken(value: string): Promise<void> {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    await eraseToken();
    return;
  }
  await writeSecureValue(STORE_TOKEN, SECURE_TOKEN_KEY, trimmed);
}

export async function eraseToken(): Promise<void> {
  await eraseSecureValue(STORE_TOKEN, SECURE_TOKEN_KEY);
}

/** Load user JSON from SecureStore, migrating any legacy AsyncStorage copy. */
export async function hydrateUser(): Promise<string | null> {
  return readSecureValue(STORE_USER, SECURE_USER_KEY);
}

export async function persistUser(value: string): Promise<void> {
  const trimmed = String(value ?? '');
  if (!trimmed) {
    await eraseUser();
    return;
  }
  await writeSecureValue(STORE_USER, SECURE_USER_KEY, trimmed);
}

export async function eraseUser(): Promise<void> {
  await eraseSecureValue(STORE_USER, SECURE_USER_KEY);
}

/** Clear all session secrets (token + user). */
export async function eraseSessionSecrets(): Promise<void> {
  await Promise.all([eraseToken(), eraseUser()]);
}
