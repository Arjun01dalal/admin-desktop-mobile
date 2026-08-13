/**
 * Live online/offline status from NetInfo.
 * Treats airplane mode / Wi‑Fi+cellular off as offline.
 * Does not use `isInternetReachable` — that is often false on VPN even when
 * the device is online.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

type NetInfoState = {
  type?: string | null;
  isConnected?: boolean | null;
};

type NetInfoLike = {
  fetch: () => Promise<NetInfoState>;
  refresh: () => Promise<NetInfoState>;
  addEventListener: (listener: (state: NetInfoState) => void) => () => void;
};

function loadNetInfo(): NetInfoLike | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@react-native-community/netinfo').default as NetInfoLike;
  } catch {
    return null;
  }
}

export function isOfflineState(state: NetInfoState | null | undefined): boolean {
  if (!state) return false;
  if (state.type === 'none') return true;
  return state.isConnected === false;
}

export function useNetworkStatus(): {
  offline: boolean;
  checking: boolean;
  refresh: () => Promise<void>;
} {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const apply = useCallback((state: NetInfoState) => {
    setOffline(isOfflineState(state));
  }, []);

  const refresh = useCallback(async () => {
    const NetInfo = loadNetInfo();
    if (!NetInfo) return;
    setChecking(true);
    try {
      const state = await NetInfo.refresh();
      apply(state);
    } catch {
      /* keep last known */
    } finally {
      setChecking(false);
    }
  }, [apply]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const NetInfo = loadNetInfo();
    if (!NetInfo) return;

    let cancelled = false;
    void NetInfo.fetch().then((state) => {
      if (!cancelled) apply(state);
    });
    const unsub = NetInfo.addEventListener((state) => {
      if (!cancelled) apply(state);
    });
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });

    return () => {
      cancelled = true;
      unsub();
      appSub.remove();
    };
  }, [apply, refresh]);

  return { offline, checking, refresh };
}
