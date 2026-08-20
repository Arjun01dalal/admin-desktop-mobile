import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { Button, Card, ErrorBanner, Input } from '../components/UI';
import { colors, spacing } from '../theme';

const MOBILE_RE = /^[6-9]\d{9}$/;

type Step = 'mobile' | 'otp' | 'password';

/** Native forgot-password flow — wire APIs when backend endpoints are ready. */
export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendOtp = async () => {
    setError(null);
    setInfo(null);
    if (!MOBILE_RE.test(mobile)) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setBusy(true);
    try {
      // TODO: secureApi('auth.forgotPasswordSendOtp', { mobile })
      await new Promise((r) => setTimeout(r, 400));
      setStep('otp');
      setInfo(`OTP will be sent to ${mobile} once API is connected.`);
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setInfo(null);
    if (otp.length !== 4) {
      setError('Enter the 4-digit OTP');
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      // TODO: secureApi('auth.forgotPasswordVerifyOtp', { mobile, otp: parseInt(otp, 10) })
      await new Promise((r) => setTimeout(r, 400));
      setStep('password');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    setInfo(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      // TODO: secureApi('auth.resetPassword', { mobile, otp: parseInt(otp, 10), password })
      await new Promise((r) => setTimeout(r, 400));
      setInfo('Password reset API will be connected soon. You can go back to login.');
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    step === 'mobile'
      ? 'Enter your registered mobile number'
      : step === 'otp'
        ? `Enter OTP for ${mobile}`
        : 'Choose a new password';

  return (
    <SafeAreaView style={styles.root}>
      <AppBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.center}
      >
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.overline}>ASTRO ADMIN</Text>
        <Card style={styles.card}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <ErrorBanner message={error} />
          {info ? <Text style={styles.info}>{info}</Text> : null}

          {step === 'mobile' ? (
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
          ) : null}

          {step === 'otp' ? (
            <>
              <Input
                placeholder="4-digit OTP"
                keyboardType="number-pad"
                maxLength={4}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />
              <Button title="Verify OTP" onPress={() => void verifyOtp()} loading={busy} />
              <Button
                title="Change number"
                variant="ghost"
                onPress={() => {
                  setStep('mobile');
                  setOtp('');
                }}
              />
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <Input
                placeholder="New password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoFocus
              />
              <Input
                placeholder="Confirm password"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <Button title="Reset Password" onPress={() => void resetPassword()} loading={busy} />
            </>
          ) : null}

          <Button title="Back to Login" variant="outline" onPress={onBack} />
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing(5),
    alignItems: 'center',
  },
  logo: { width: 72, height: 72, marginBottom: spacing(2) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(3),
  },
  card: { width: '100%', maxWidth: 420, gap: spacing(3) },
  title: { color: colors.foreground, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: spacing(2) },
  info: { color: colors.primary, fontSize: 13, textAlign: 'center' },
});
