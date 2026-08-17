import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { secureApi } from '../api/client';
import { resolveLocation, useAuth } from '../auth/AuthContext';
import { AppBackground } from '../components/AppBackground';
import { Button, Card, ErrorBanner, Input } from '../components/UI';
import { colors, spacing } from '../theme';
import type { AuthUser } from '../types/auth';
import { getRoleOptions, selectActiveRole } from '../auth/roleSelection';

const MOBILE_RE = /^[6-9]\d{9}$/;

/** OTP + location login, mirroring the desktop flow. */
export function LoginScreen({ onBack }: { onBack: () => void }) {
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

      if (getRoleOptions(user).length > 0) {
        setPendingSession({ token, user });
        setSelectedRoleId('');
        return;
      }
      login(token, user);
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
      login(pendingSession.token, nextUser);
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
              <ScrollView style={styles.roleList} nestedScrollEnabled>
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
});
