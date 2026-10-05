/**
 * Native Astro site login — desktop AstroSiteLogin parity.
 * - Gate password 123456789 → panel OTP login
 * - Any other password → api.astrothirdeye.com login-via-password → Astro site WebView
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type KeyboardEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { siteLoginViaPassword } from '../api/astroSiteAuth';
import { AppBackground } from '../components/AppBackground';
import { Button, Card, ErrorBanner, Input } from '../components/UI';
import { spacing} from '../theme';
import {
  astroSiteModelNumber,
  astroSiteOs,
  getAstroSiteDeviceId,
  getAstroSitePushToken,
  resolveAstroSiteGeo,
} from '../utils/astroSiteDevice';
import { styles } from './AstroLoginScreen.styles';

const SITE_IDENTITY_KEY = 'astro_site_identity_v1';
const PANEL_GATE_PASSWORD = '123456789';

type SavedIdentity = { email: string; mobile: string };

export function AstroLoginScreen({
  onOpenPanelLogin,
  onOpenAstroSite,
  onForgotPassword,
  onTerms,
}: {
  onOpenPanelLogin: () => void;
  onOpenAstroSite: (accessToken: string) => void;
  onForgotPassword: () => void;
  onTerms: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardPad, setKeyboardPad] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      setKeyboardPad(event.endCoordinates.height);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardPad(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardPad <= 0) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(id);
  }, [keyboardPad]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SITE_IDENTITY_KEY);
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as SavedIdentity;
        const savedEmail = String(parsed?.email || '').trim();
        if (savedEmail) setEmail(savedEmail);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistIdentity = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    const mobile = /^[6-9]\d{9}$/.test(trimmed.replace(/\D/g, '').slice(-10))
      ? trimmed.replace(/\D/g, '').slice(-10)
      : '';
    const payload: SavedIdentity = { email: trimmed, mobile };
    await AsyncStorage.setItem(SITE_IDENTITY_KEY, JSON.stringify(payload));
  };

  const onLogin = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email or mobile');
      return;
    }
    if (!password) {
      setError('Enter your password');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept Terms & Conditions');
      return;
    }

    setBusy(true);
    try {
      await persistIdentity();

      // Gate password → panel OTP only (never open site SSO).
      if (password === PANEL_GATE_PASSWORD) {
        onOpenPanelLogin();
        return;
      }

      // Customer password → site API → astrotalk.vip SSO (desktop parity).
      const [deviceId, push, geo] = await Promise.all([
        getAstroSiteDeviceId(),
        getAstroSitePushToken(),
        resolveAstroSiteGeo(),
      ]);
      if (!push.ok) {
        setError(push.message);
        return;
      }

      const res = await siteLoginViaPassword({
        email: email.trim(),
        password,
        deviceId,
        os: astroSiteOs(),
        modelNumber: astroSiteModelNumber(),
        longitude: geo.longitude,
        latitude: geo.latitude,
        fcmToken: push.fcmToken,
      });

      if (!res.ok) {
        setError(res.message || 'Login failed');
        return;
      }

      // Keep the customer SSO token only in the in-memory AppRoot state.
      // It must not be persisted in ordinary app storage.
      onOpenAstroSite(res.accessToken);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <AppBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            keyboardPad > 0 && styles.scrollKeyboard,
            Platform.OS === 'android' ? { paddingBottom: spacing(5) + keyboardPad } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.overline}>ASTRO ADMIN</Text>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Welcome to Astro Admin</Text>

          <Card style={styles.card}>
            <ErrorBanner message={error} />

            <Input
              placeholder="Enter Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <Input
              placeholder="Enter Your Password"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.linksRow}>
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Text style={styles.linkText}>{showPassword ? 'Hide' : 'Show'} password</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.termsRow}>
              <Pressable
                onPress={() => setAcceptedTerms((v) => !v)}
                style={[styles.checkbox, acceptedTerms && styles.checkboxOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
              >
                <Text style={styles.checkboxCheck}>{acceptedTerms ? '✓' : ''}</Text>
              </Pressable>

              <Text style={styles.termsText}>
                I accept all{' '}
                <Text style={styles.linkText} onPress={onTerms}>
                  Terms & Conditions
                </Text>
              </Text>
            </View>

            <TouchableOpacity onPress={onForgotPassword} style={styles.forgotWrap}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <Button
              title="LOGIN"
              onPress={() => void onLogin()}
              loading={busy}
              disabled={busy}
              style={styles.loginBtn}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

