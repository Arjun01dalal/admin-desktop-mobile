/**
 * Live online/offline status via expo-network (Expo module — reliable with New Arch).
 * Treats airplane mode / Wi‑Fi+cellular off as offline.
 * Does not use `isInternetReachable` — that can be false even when
 * the device has a working network connection.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

type NetworkSnapshot = {
  type?: string | null;
  isConnected?: boolean | null;
};

export function isOfflineState(state: NetworkSnapshot | null | undefined): boolean {
  if (!state) return false;
  if (state.type === Network.NetworkStateType.NONE) return true;
  if (String(state.type || '').toUpperCase() === 'NONE') return true;
  return state.isConnected === false;
}

export function useNetworkStatus(): {
  offline: boolean;
  checking: boolean;
  refresh: () => Promise<void>;
} {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const apply = useCallback((state: NetworkSnapshot) => {
    setOffline(isOfflineState(state));
  }, []);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const state = await Network.getNetworkStateAsync();
      apply(state);
    } catch {
      /* keep last known — native module missing / transient error */
    } finally {
      setChecking(false);
    }
  }, [apply]);

  useEffect(() => {
    let cancelled = false;

    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!cancelled) apply(state);
      })
      .catch(() => {
        /* ignore */
      });

    const sub = Network.addNetworkStateListener((state) => {
      if (!cancelled) apply(state);
    });

    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });

    return () => {
      cancelled = true;
      sub.remove();
      appSub.remove();
    };
  }, [apply, refresh]);

  return { offline, checking, refresh };
}
