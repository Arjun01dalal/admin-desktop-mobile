/**
 * Wire React Query to React Native AppState (foreground refetch).
 * Screen-level freshness still uses useFreshOnFocus / useScreenQuery.
 */
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

export function setupQueryLifecycle(): () => void {
  const appSub = AppState.addEventListener('change', onAppStateChange);

  onlineManager.setEventListener((setOnline) => {
    let alive = true;
    const poll = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (alive) setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
      } catch {
        if (alive) setOnline(true);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  });

  return () => {
    appSub.remove();
  };
}
