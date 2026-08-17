/**
 * The real app tree. This module (and everything it imports) is required
 * LAZILY by App.tsx only after storage is hydrated and the stored theme has
 * been applied — screens capture `colors` in module-scope StyleSheet.create,
 * so the palette must be final before these imports run.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';
import { AstroSiteScreen } from './screens/AstroSiteScreen';
import { LoginScreen } from './screens/LoginScreen';
import { LocationRequiredGate } from './security/LocationRequiredGate';
import { OfflineGate } from './security/OfflineGate';
import { SecurityGate } from './security/SecurityGate';
import { useLiveLocation } from './security/useLiveLocation';
import { useNetworkStatus } from './security/useNetworkStatus';
import { UpdateGate } from './updates/UpdateGate';
import { colors, isDarkTheme } from './theme';

/** Desktop AppScreen parity: always open on the Astro site, never auto-enter the panel. */
type GateScreen = 'site' | 'login' | 'panel';

function OfflineHost() {
  const { offline, checking, refresh } = useNetworkStatus();
  return <OfflineGate open={offline} checking={checking} onRetry={() => void refresh()} />;
}

function Root() {
  const { ready, token } = useAuth();
  const [screen, setScreen] = useState<GateScreen>('site');

  // Continuously fetch location while authenticated (compliance/audit).
  // Hard-blocks the panel when Location is off — desktop LocationProvider parity.
  const inPanel = screen === 'panel' && Boolean(token);
  const { blocked, loading, error, retry, openSettings } = useLiveLocation(inPanel);

  useEffect(() => {
    if (token && screen === 'login') setScreen('panel');
  }, [token, screen]);

  useEffect(() => {
    if (!token && screen === 'panel') setScreen('site');
  }, [token, screen]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (inPanel) {
    return (
      <>
        <AppNavigator />
        <LocationRequiredGate
          open={blocked}
          loading={loading}
          error={error}
          onRetry={retry}
          onOpenSettings={openSettings}
        />
      </>
    );
  }
  if (screen === 'login') {
    return <LoginScreen onBack={() => setScreen('site')} />;
  }
  return (
    <AstroSiteScreen
      onOpenLogin={() => {
        if (token) setScreen('panel');
        else setScreen('login');
      }}
    />
  );
}

export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SecurityGate>
          <AuthProvider>
            <StatusBar
              style={isDarkTheme() ? 'light' : 'dark'}
              backgroundColor={colors.background}
            />
            <Root />
            <OfflineHost />
            <UpdateGate />
          </AuthProvider>
        </SecurityGate>
      </View>
    </SafeAreaProvider>
  );
}
