/**
 * The real app tree. This module (and everything it imports) is required
 * LAZILY by App.tsx only after storage is hydrated and the stored theme has
 * been applied — screens capture `colors` in module-scope StyleSheet.create,
 * so the palette must be final before these imports run.
 *
 * Pre-auth default is native Splash → Astro Login (not the website WebView).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';
import { AstroLoginScreen } from './screens/AstroLoginScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SplashScreen } from './screens/SplashScreen';
import { TermsAndConditionsScreen } from './screens/TermsAndConditionsScreen';
import { LocationRequiredGate } from './security/LocationRequiredGate';
import { OfflineGate } from './security/OfflineGate';
import { SecurityGate } from './security/SecurityGate';
import { useLiveLocation } from './security/useLiveLocation';
import { useNetworkStatus } from './security/useNetworkStatus';
import { UpdateGate } from './updates/UpdateGate';
import { colors, isDarkTheme } from './theme';

type GateScreen = 'splash' | 'astro-login' | 'login' | 'panel' | 'forgot' | 'terms';

function OfflineHost() {
  const { offline, checking, refresh } = useNetworkStatus();
  return <OfflineGate open={offline} checking={checking} onRetry={() => void refresh()} />;
}

function Root() {
  const { ready, token } = useAuth();
  const [screen, setScreen] = useState<GateScreen>('splash');
  const [returnTo, setReturnTo] = useState<GateScreen>('astro-login');

  const openTerms = (from: GateScreen) => {
    setReturnTo(from);
    setScreen('terms');
  };

  const openForgot = (from: GateScreen) => {
    setReturnTo(from);
    setScreen('forgot');
  };

  const finishSplash = useCallback(() => {
    setScreen(token ? 'panel' : 'astro-login');
  }, [token]);

  // Continuously fetch location while authenticated (compliance/audit).
  // Hard-blocks the panel when Location is off — desktop LocationProvider parity.
  const inPanel = screen === 'panel' && Boolean(token);
  const { blocked, loading, error, retry, openSettings } = useLiveLocation(inPanel);

  useEffect(() => {
    if (token && (screen === 'login' || screen === 'astro-login' || screen === 'splash')) {
      setScreen('panel');
    }
  }, [token, screen]);

  useEffect(() => {
    if (!token && screen === 'panel') setScreen('astro-login');
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

  if (screen === 'splash') {
    return <SplashScreen onDone={finishSplash} />;
  }

  if (screen === 'login') {
    return (
      <LoginScreen
        onBack={() => setScreen('astro-login')}
        onForgotPassword={() => openForgot('login')}
        onTerms={() => openTerms('login')}
      />
    );
  }

  if (screen === 'forgot') {
    return <ForgotPasswordScreen onBack={() => setScreen(returnTo)} />;
  }

  if (screen === 'terms') {
    return <TermsAndConditionsScreen onBack={() => setScreen(returnTo)} />;
  }

  // Default pre-auth surface: native Astro login (replaces website WebView)
  return (
    <AstroLoginScreen
      onOpenPanelLogin={() => setScreen('login')}
      onForgotPassword={() => openForgot('astro-login')}
      onTerms={() => openTerms('astro-login')}
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
