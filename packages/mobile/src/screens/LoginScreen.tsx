import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { secureApi, type ApiResult } from '../api/client';
import { resolveLocation, useAuth } from '../auth/AuthContext';
import { AppBackground } from '../components/AppBackground';
import { Button, Card, ErrorBanner, Input } from '../components/UI';
import { colors, spacing } from '../theme';
import { getAppVersion } from '../utils/appVersion';
import type { AuthUser } from '../types/auth';
import { getRoleOptions, selectActiveRole } from '../auth/roleSelection';

const MOBILE_RE = /^[6-9]\d{9}$/;

async function secureApiWithUiTimeout<T>(
  promise: Promise<ApiResult<T>>,
  ms: number,
  timeoutMessage: string,
): Promise<ApiResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<ApiResult<T>>((resolve) => {
        timeoutId = setTimeout(() => resolve({ ok: false, message: timeoutMessage }), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function promiseWithUiTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/** OTP + location login, mirroring the desktop flow. */
export function LoginScreen({
  onBack,
  onForgotPassword,
  onTerms,
}: {
  onBack: () => void;
  onForgotPassword?: () => void;
  onTerms?: () => void;
}) {
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSession, setPendingSession] = useState<{
    token: string;
    user: AuthUser;
  } | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  const sendOtp = async () => {
    setError(null);
    if (!MOBILE_RE.test(mobile)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setBusy(true);
    const res = await secureApiWithUiTimeout(
      secureApi('auth.sendOtp', { mobile }),
      15_000,
      'Network seems unstable. Please try again.',
    );
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
    // Dismiss keyboard immediately for smooth UX.
    Keyboard.dismiss();
    setBusy(true);
    try {
      // Location can be slow on Android — bound so OTP flow doesn't feel stuck.
      const loc = await promiseWithUiTimeout(
        resolveLocation(),
        12_000,
        'Location is taking too long. Please try again.',
      );
      const res = await secureApiWithUiTimeout(
        secureApi<{ token?: string; payload?: AuthUser } & AuthUser>(
          'auth.verifyOtp',
          {
            mobile,
            otp: parseInt(otp, 10),
            state: loc.state || 'Madhya Pradesh',
            city: loc.city || 'Jabalpur',
            lat: loc.lat,
            long: loc.long,
            address: loc.address,
          },
          null,
        ),
        20_000,
        'Login request is taking too long. Please retry.',
      );
      if (!res.ok) {
        setError(res.message || 'OTP verification failed');
        return;
      }
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
      if (getRoleOptions(user).length > 0) {
        setPendingSession({ token, user });
        setSelectedRoleId('');
        return;
      }
      await login(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const chooseRole = async () => {
    if (!pendingSession || !selectedRoleId) {
      setError('Please select a role');
      return;
    }
    const role = getRoleOptions(pendingSession.user).find(
      (item) => item.id === selectedRoleId,
    );
    if (!role) {
      setError('Selected role is not available');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextUser = await selectActiveRole(
        pendingSession.user,
        pendingSession.token,
        role,
      );
      await login(pendingSession.token, nextUser);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <AppBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <Card style={styles.card}>
          <Text style={styles.title}>
            {pendingSession ? 'Change Role' : 'Astro Admin'}
          </Text>
          <Text style={styles.subtitle}>
            {pendingSession
              ? 'Select the role you want to use for this session'
              : otpSent
                ? `OTP sent to ${mobile}`
                : 'Sign in with your registered mobile'}
          </Text>
          <ErrorBanner message={error} />
          {pendingSession ? (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.roleList}
                nestedScrollEnabled
              >
                {getRoleOptions(pendingSession.user).map((role) => {
                  const active = selectedRoleId === role.id;
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleOption, active && styles.roleOptionActive]}
                      onPress={() => setSelectedRoleId(role.id)}
                      disabled={busy}
                    >
                      <Text style={[styles.roleText, active && styles.roleTextActive]}>
                        {role.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Button
                title="Submit"
                onPress={() => void chooseRole()}
                loading={busy}
                disabled={!selectedRoleId}
              />
            </>
          ) : !otpSent ? (
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
              {onForgotPassword ? (
                <TouchableOpacity onPress={onForgotPassword} disabled={busy}>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              ) : null}
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
          {!pendingSession ? <Button title="Back" variant="outline" onPress={onBack} /> : null}
          {!pendingSession && onTerms ? (
            <TouchableOpacity onPress={onTerms} disabled={busy}>
              <Text style={styles.linkMuted}>Terms & Conditions</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.version}>v{getAppVersion()}</Text>
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
  version: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing(1) },
  roleList: { maxHeight: 260 },
  roleOption: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
    marginBottom: spacing(2),
  },
  roleOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  roleTextActive: { color: colors.primaryForeground },
  link: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  linkMuted: { color: colors.muted, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
});
