import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import { secureApi, setAuthFailureHandler } from '../api/client';
import { eraseSessionSecrets, persistToken, persistUser } from '../lib/secureStorage';
import { appStorage } from '../lib/webShim';
import { persistRoleFromLogin } from './permissions';
import { clearLlmChatStorage } from '@astro/shared';
import { registerSubAdminFcmToken } from './registerFcmToken';
import { resetTokenValidationThrottle } from './sessionCheck';
import { useTokenValidator } from './useTokenValidator';
import type { AuthUser } from '../types/auth';
import { getRoleOptions, selectActiveRole } from './roleSelection';

/** Login defaults — same fallbacks LoginScreen / desktop verify-otp use. */
const FALLBACK_STATE = 'Madhya Pradesh';
const FALLBACK_CITY = 'Jabalpur';
const FALLBACK_LAT = 23.1815;
const FALLBACK_LNG = 79.9864;

const POSITION_TIMEOUT_MS = 6_000;
const ADDRESS_BUDGET_MS = 3_500;
const LAST_KNOWN_MAX_AGE_MS = 15 * 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const id = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} timed out`));
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

type AuthState = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => Promise<void>;
  switchRole: (roleId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const t = appStorage.getItem('token');
    const raw = appStorage.getItem('user');
    if (t && raw) {
      try {
        const restoredUser = JSON.parse(raw) as AuthUser;
        setUser(restoredUser);
        setToken(t);
        void registerSubAdminFcmToken(restoredUser);
      } catch {
        /* corrupted session — stay logged out */
      }
    }
    setReady(true);
  }, []);

  const login = useCallback(async (newToken: string, newUser: AuthUser) => {
    resetTokenValidationThrottle();
    const userJson = JSON.stringify(newUser);
    appStorage.setItem('token', newToken);
    appStorage.setItem('user', userJson);
    await Promise.all([persistToken(newToken), persistUser(userJson)]);
    if (newUser.Role_ID) appStorage.setItem('role_id', String(newUser.Role_ID));
    try {
      persistRoleFromLogin(newUser);
    } catch {
      /* role mapping is best-effort */
    }
    setToken(newToken);
    setUser(newUser);
    void registerSubAdminFcmToken(newUser);
  }, []);

  const switchRole = useCallback(
    async (roleId: string) => {
      if (!token || !user) throw new Error('No active session');
      const role = getRoleOptions(user).find((item) => item.id === roleId);
      if (!role) throw new Error('Selected role is not available');

      const nextUser = await selectActiveRole(user, token, role);
      const userJson = JSON.stringify(nextUser);
      appStorage.setItem('token', token);
      appStorage.setItem('user', userJson);
      await persistUser(userJson);
      appStorage.setItem('role_id', role.id);
      appStorage.setItem('role', role.name);
      setUser(nextUser);
    },
    [token, user],
  );

  const logout = useCallback(async () => {
    clearLlmChatStorage(appStorage);
    appStorage.removeItem('token');
    appStorage.removeItem('user');
    await eraseSessionSecrets();
    appStorage.removeItem('role_id');
    appStorage.removeItem('role');
    resetTokenValidationThrottle();
    setToken(null);
    setUser(null);
  }, []);

  // Auto-logout when the API reports an invalid/blacklisted/expired session
  // (HTTP 401 or a token-blacklist message from any secureApi call).
  useEffect(() => {
    setAuthFailureHandler((reason) => {
      console.log(`[auth] session rejected (${reason}); logging out`);
      void logout();
    });
    return () => setAuthFailureHandler(null);
  }, [logout]);

  // Single-session: poll check-token-blacklisted while logged in.
  useTokenValidator(Boolean(token), (reason) => {
    console.log(`[auth] session superseded (${reason}); logging out`);
    void logout();
  });

  const value = useMemo(
    () => ({ ready, token, user, login, switchRole, logout }),
    [ready, token, user, login, switchRole, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Mirrors desktop AddressInfo — the API's verify-otp expects `address` to be an OBJECT. */
export type AddressInfo = {
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  region?: string;
  postalCode?: string;
  source?: string;
};

export type OtpLocation = {
  lat: string;
  long: string;
  state: string;
  city: string;
  address: AddressInfo;
};

/** Get device location + reverse-geocoded address (uses API getAddress like desktop). */
export async function resolveLocation(): Promise<OtpLocation> {
  // Emulator: skip native GPS (hangs / "Array already consumed").
  if (Platform.OS !== 'web' && !Device.isDevice) {
    return {
      lat: String(FALLBACK_LAT),
      long: String(FALLBACK_LNG),
      state: FALLBACK_STATE,
      city: FALLBACK_CITY,
      address: { state: FALLBACK_STATE, city: FALLBACK_CITY, source: 'emulator' },
    };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission is required to log in');

  let lat = FALLBACK_LAT;
  let lng = FALLBACK_LNG;
  let gotFix = false;

  try {
    const last = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: 5_000,
    });
    if (last) {
      lat = last.coords.latitude;
      lng = last.coords.longitude;
      gotFix = true;
    }
  } catch {
    /* continue */
  }

  if (!gotFix) {
    try {
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        }),
        POSITION_TIMEOUT_MS,
        'loginLocation',
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      gotFix = true;
    } catch {
      // GPS flakes are common indoors — proceed with city defaults so OTP login
      // isn't blocked (desktop falls back to network/IP location).
      gotFix = false;
    }
  }

  let state = '';
  let city = '';
  let address: AddressInfo = {};

  // Cap address work so geocode / getAddress cannot push past the login UI timeout.
  await Promise.race([
    (async () => {
      try {
        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const p = places[0];
        if (p) {
          state = p.region ?? '';
          city = p.city ?? p.district ?? '';
        }
      } catch {
        /* fall through */
      }

      try {
        const res = await secureApi<AddressInfo>('auth.getAddress', { lat, lng });
        if (res.ok && res.data && typeof res.data === 'object') {
          address = res.data;
          state = state || address.state || '';
          city = city || address.city || '';
        }
      } catch {
        /* keep local geocode values */
      }
    })(),
    new Promise<void>((resolve) => setTimeout(resolve, ADDRESS_BUDGET_MS)),
  ]);

  if (!address || Object.keys(address).length === 0) {
    address = {
      state: state || FALLBACK_STATE,
      city: city || FALLBACK_CITY,
      source: gotFix ? 'device' : 'fallback',
    };
  }

  return {
    lat: String(lat),
    long: String(lng),
    state: state || FALLBACK_STATE,
    city: city || FALLBACK_CITY,
    address,
  };
}
