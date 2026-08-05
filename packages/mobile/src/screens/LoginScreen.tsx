import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { secureApi } from '../api/client';
import { resolveLocation, useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorBanner, Input } from '../components/UI';
import { colors, spacing } from '../theme';
import type { AuthUser } from '../types/auth';

const MOBILE_RE = /^[6-9]\d{9}$/;

/** OTP + location login, mirroring the desktop flow. */
export function LoginScreen({ onBack }: { onBack: () => void }) {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    if (!MOBILE_RE.test(mobile)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setBusy(true);
    const res = await secureApi('auth.sendOtp', { mobile });
    setBusy(false);
    if (res.ok) setOtpSent(true);
    else setError(res.message || 'Failed to send OTP');
  };

  const verify = async () => {
    setError(null);
    if (otp.length !== 4) {
      setError('Enter the 4-digit OTP');
      return;
    }
    setBusy(true);
    try {
      const loc = await resolveLocation();
      const res = await secureApi<{ token?: string; payload?: AuthUser } & AuthUser>(
        'auth.verifyOtp',
        {
          mobile,
          // Desktop sends OTP as an integer.
          otp: parseInt(otp, 10),
          state: loc.state || 'Madhya Pradesh',
          city: loc.city || 'Jabalpur',
          lat: loc.lat,
          long: loc.long,
          address: loc.address,
        },
        null,
      );
      if (!res.ok) {
        setError(res.message || 'OTP verification failed');
        return;
      }
      // Desktop verifyOtp: session token lives on the OUTER envelope (response.data.token);
      // the decrypted payload is the user object.
      const raw = res.data as Record<string, unknown> | undefined;
      const user = ((raw?.payload as AuthUser) ?? (raw as AuthUser)) || {};
      const token = res.token || '';
      if (!token) {
        setError('Login succeeded but no session token was returned');
        return;
      }
      if (user.block) {
        setError('This account is blocked');
        return;
      }
      login(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <Card style={styles.card}>
          <Text style={styles.title}>Astro Admin</Text>
          <Text style={styles.subtitle}>
            {otpSent ? `OTP sent to ${mobile}` : 'Sign in with your registered mobile'}
          </Text>
          <ErrorBanner message={error} />
          {!otpSent ? (
            <>
              <Input
                placeholder="Mobile number"
                keyboardType="number-pad"
                maxLength={10}
                value={mobile}
                onChangeText={setMobile}
                autoFocus
              />
              <Button title="Send OTP" onPress={() => void sendOtp()} loading={busy} />
            </>
          ) : (
            <>
              <Input
                placeholder="4-digit OTP"
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />
              <Button title="Verify & Login" onPress={() => void verify()} loading={busy} />
              <Button
                title="Change number"
                variant="ghost"
                onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                }}
              />
            </>
          )}
          <Button title="Back" variant="outline" onPress={onBack} />
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', padding: spacing(5) },
  card: { gap: spacing(3) },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: spacing(2) },
});
