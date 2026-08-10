import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as Location from 'expo-location';
import { secureApi, setAuthFailureHandler } from '../api/client';
import { appStorage, hydrateStorage } from '../lib/webShim';
import { persistRoleFromLogin } from './permissions';
import type { AuthUser } from '../types/auth';

type AuthState = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void (async () => {
      await hydrateStorage();
      const t = appStorage.getItem('token');
      const raw = appStorage.getItem('user');
      if (t && raw) {
        try {
          setUser(JSON.parse(raw) as AuthUser);
          setToken(t);
        } catch {
          /* corrupted session — stay logged out */
        }
      }
      setReady(true);
    })();
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    appStorage.setItem('token', newToken);
    appStorage.setItem('user', JSON.stringify(newUser));
    if (newUser.Role_ID) appStorage.setItem('role_id', String(newUser.Role_ID));
    try {
      persistRoleFromLogin(newUser);
    } catch {
      /* role mapping is best-effort */
    }
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    appStorage.removeItem('token');
    appStorage.removeItem('user');
    appStorage.removeItem('role_id');
    appStorage.removeItem('role');
    setToken(null);
    setUser(null);
  }, []);

  // Auto-logout when the API reports an invalid/blacklisted/expired session
  // (HTTP 401 or a token-blacklist message from any secureApi call).
  useEffect(() => {
    setAuthFailureHandler((reason) => {
      console.log(`[auth] session rejected (${reason}); logging out`);
      logout();
    });
    return () => setAuthFailureHandler(null);
  }, [logout]);

  const value = useMemo(
    () => ({ ready, token, user, login, logout }),
    [ready, token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Mirrors desktop AddressInfo — the API's verify-otp expects `address` to be an OBJECT. */
export type AddressInfo = Record<string, unknown>;

export type OtpLocation = {
  lat: string;
  long: string;
  state: string;
  city: string;
  address: AddressInfo;
};

/** Get device location + reverse-geocoded address (uses API getAddress like desktop). */
export async function resolveLocation(): Promise<OtpLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission is required to log in');
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  let state = '';
  let city = '';
  let address: AddressInfo = {};
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const p = places[0];
    if (p) {
      state = p.region ?? '';
      city = p.city ?? p.district ?? '';
    }
  } catch {
    /* fall through to API address resolution */
  }

  // Desktop sends the getAddress API result object as `address` — the API
  // rejects string addresses ("address must be of type object").
  try {
    const res = await secureApi<Record<string, unknown>>('auth.getAddress', { lat, lng });
    if (res.ok && res.data && typeof res.data === 'object') {
      address = res.data as AddressInfo;
      state = state || (address.state as string) || '';
      city = city || (address.city as string) || '';
    }
  } catch {
    /* keep local geocode values */
  }
  if (!address || Object.keys(address).length === 0) {
    address = { state, city, source: 'device' };
  }

  return { lat: String(lat), long: String(lng), state, city, address };
}
