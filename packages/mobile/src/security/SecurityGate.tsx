/**
 * SecurityGate — wraps the whole app. Enables runtime protections and, if a
 * blocking threat is detected (root, hooking, tamper, emulator),
 * replaces the UI with a lockout screen instead of the app content.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { useSecurity } from './useSecurity';

const LABELS: Record<string, string> = {
  privilegedAccess: 'Rooted / jailbroken device',
  hooks: 'Instrumentation / hooking framework detected',
  appIntegrity: 'App integrity check failed (tampered build)',
  simulator: 'Emulator / simulator not allowed',
};

export function SecurityGate({ children }: { children: React.ReactNode }) {
  const { threats, blocked, refresh } = useSecurity();
  const [checking, setChecking] = React.useState(false);

  if (!blocked) return <>{children}</>;

  const reasons = threats.filter((t) => LABELS[t]).map((t) => LABELS[t]);

  const onCheck = async () => {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Access blocked</Text>
      <Text style={styles.subtitle}>
        This device does not meet the security requirements to run Astro Admin.
      </Text>
      <View style={styles.list}>
        {(reasons.length ? reasons : ['Security policy violation']).map((r) => (
          <Text key={r} style={styles.reason}>
            •  {r}
          </Text>
        ))}
      </View>
      <TouchableOpacity
        style={[styles.button, checking && styles.buttonDisabled]}
        onPress={onCheck}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.buttonText}>Check again</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(5),
  },
  icon: { fontSize: 48, marginBottom: spacing(3) },
  title: { color: colors.foreground, fontSize: 22, fontWeight: '700', marginBottom: spacing(2) },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing(4),
    maxWidth: 320,
  },
  list: { alignSelf: 'stretch', paddingHorizontal: spacing(4) },
  reason: { color: colors.destructive, fontSize: 14, marginBottom: spacing(1) },
  button: {
    marginTop: spacing(5),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(6),
    minWidth: 180,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 15 },
});
