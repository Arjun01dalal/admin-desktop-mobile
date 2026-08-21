/**
 * Native Astro site login — desktop AstroSiteLogin parity.
 * - Gate password 123456789 → panel OTP login
 * - Any other password → api.astrothirdeye.com login-via-password → Astro site WebView
 */
import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SITE_ACCESS_TOKEN_KEY,
  siteLoginViaPassword,
} from '../api/astroSiteAuth';
import { AppBackground } from '../components/AppBackground';
import { Button, Card, ErrorBanner, Input } from '../components/UI';
import { colors, spacing, radius } from '../theme';
import {
  astroSiteModelNumber,
  astroSiteOs,
  getAstroSiteDeviceId,
  getAstroSitePushToken,
  resolveAstroSiteGeo,
} from '../utils/astroSiteDevice';

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

      try {
        await AsyncStorage.setItem(SITE_ACCESS_TOKEN_KEY, res.accessToken);
      } catch {
        /* ignore */
      }
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
          contentContainerStyle={styles.scroll}
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
              placeholder="Enter Email / Mobile"
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 96, height: 96, marginBottom: spacing(2) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(2),
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing(4),
  },
  card: { width: '100%', maxWidth: 420, gap: spacing(3) },
  linksRow: { alignItems: 'flex-end', marginTop: -spacing(2) },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  termsText: { color: colors.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxCheck: { color: colors.primaryForeground, fontWeight: '900', fontSize: 12 },
  forgotWrap: { alignSelf: 'flex-end' },
  loginBtn: { marginTop: spacing(1) },
});
