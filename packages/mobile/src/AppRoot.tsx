/**
 * The real app tree. This module (and everything it imports) is required
 * LAZILY by App.tsx only after storage is hydrated and the stored theme has
 * been applied — screens capture `colors` in module-scope StyleSheet.create,
 * so the palette must be final before these imports run.
 */
import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';
import { CalculatorScreen } from './screens/CalculatorScreen';
import { LoginScreen } from './screens/LoginScreen';
import { LocationRequiredGate } from './security/LocationRequiredGate';
import { SecurityGate } from './security/SecurityGate';
import { useLiveLocation } from './security/useLiveLocation';
import { UpdateGate } from './updates/UpdateGate';
import { colors, isDarkTheme } from './theme';

function Root() {
  const { ready, token } = useAuth();
  const [unlocked, setUnlocked] = useState(false);

  // Continuously fetch location while authenticated (compliance/audit).
  // Hard-blocks the panel when Location is off — desktop LocationProvider parity.
  const { blocked, loading, error, retry, openSettings } = useLiveLocation(Boolean(token));

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (token) {
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
  if (unlocked) return <LoginScreen onBack={() => setUnlocked(false)} />;
  return <CalculatorScreen onUnlock={() => setUnlocked(true)} />;
}

export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <SecurityGate>
        <AuthProvider>
          <StatusBar style={isDarkTheme() ? 'light' : 'dark'} />
          <Root />
          <UpdateGate />
        </AuthProvider>
      </SecurityGate>
    </SafeAreaProvider>
  );
}
