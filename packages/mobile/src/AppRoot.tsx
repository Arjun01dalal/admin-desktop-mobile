/**
 * The real app tree. This module (and everything it imports) is required
 * LAZILY by App.tsx only after storage is hydrated and the stored theme has
 * been applied — screens capture `colors` in module-scope StyleSheet.create,
 * so the palette must be final before these imports run.
 *
 * Pre-auth: Splash → Astro Login
 *   - password 123456789 → panel OTP login
 *   - other password → customer site WebView (desktop parity)
 * Logout deep link: myastroapp://login?logged_out=1 → Astro Login
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SITE_ACCESS_TOKEN_KEY } from './api/astroSiteAuth';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppNavigator } from './navigation/AppNavigator';
import { AstroLoginScreen } from './screens/AstroLoginScreen';
import { AstroSiteScreen } from './screens/AstroSiteScreen';
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
import { parseAstroDeepLink } from './utils/astroDeepLink';

type GateScreen =
  | 'splash'
  | 'astro-login'
  | 'site'
  | 'login'
  | 'panel'
  | 'forgot'
  | 'terms';

function OfflineHost() {
  const { offline, checking, refresh } = useNetworkStatus();
  return <OfflineGate open={offline} checking={checking} onRetry={() => void refresh()} />;
}

function Root() {
  const { ready, token, logout } = useAuth();
  const [screen, setScreen] = useState<GateScreen>('splash');
  const [returnTo, setReturnTo] = useState<GateScreen>('astro-login');
  const [siteAccessToken, setSiteAccessToken] = useState('');
  const appliedDeepLinkRaw = useRef('');

  const goAstroLogin = useCallback(() => {
    setSiteAccessToken('');
    void AsyncStorage.removeItem(SITE_ACCESS_TOKEN_KEY).catch(() => undefined);
    setScreen('astro-login');
  }, []);

  const applyLogoutDeepLink = useCallback(
    async (url: string | null | undefined) => {
      const payload = parseAstroDeepLink(url);
      if (!payload) return;
      if (payload.raw && appliedDeepLinkRaw.current === payload.raw) return;
      if (payload.raw) appliedDeepLinkRaw.current = payload.raw;

      try {
        await AsyncStorage.removeItem(SITE_ACCESS_TOKEN_KEY);
      } catch {
        /* ignore */
      }
      setSiteAccessToken('');
      if (token) {
        await logout();
      }
      setScreen('astro-login');
      if (payload.loggedOut) {
        Alert.alert('Logged out', 'Please sign in again.');
      }
    },
    [logout, token],
  );

  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      void applyLogoutDeepLink(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void applyLogoutDeepLink(url);
    });
    return () => sub.remove();
  }, [applyLogoutDeepLink]);

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

  const openCustomerSite = useCallback((accessToken: string) => {
    const next = String(accessToken || '').trim();
    if (!next) {
      Alert.alert('Login error', 'Missing access token — cannot open Astro home.');
      return;
    }
    setSiteAccessToken(next);
    setScreen('site');
  }, []);

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

  if (screen === 'site' && siteAccessToken) {
    return (
      <AstroSiteScreen
        accessToken={siteAccessToken}
        onBackToNativeLogin={goAstroLogin}
        onLogoutDeepLink={() => {
          void applyLogoutDeepLink('myastroapp://login?logged_out=1');
        }}
      />
    );
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

  return (
    <AstroLoginScreen
      onOpenPanelLogin={() => setScreen('login')}
      onOpenAstroSite={openCustomerSite}
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
