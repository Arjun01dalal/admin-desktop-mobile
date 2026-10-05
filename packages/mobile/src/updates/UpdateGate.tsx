/**
 * UpdateGate — OTA prompt (Stallion).
 *
 * Stallion syncs on launch/resume. When a production release is downloaded
 * and waiting, this prompt lets the user restart into it.
 *
 * No-op on web / Expo Go / Metro (__DEV__) — Stallion only applies in
 * preview/production native builds.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { restart, useStallionUpdate } from 'react-native-stallion';
import { colors, radius, spacing } from '../theme';

function stallionOtaEnabled(): boolean {
  if (Platform.OS === 'web' || __DEV__) return false;
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo';
  return !inExpoGo;
}

export function UpdateGate() {
  if (!stallionOtaEnabled()) return null;
  return <StallionUpdatePrompt />;
}

function StallionUpdatePrompt() {
  const { isRestartRequired, newReleaseBundle } = useStallionUpdate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const applyUpdate = useCallback(() => {
    setBusy(true);
    setError('');
    try {
      restart();
    } catch {
      setError('Update failed. Please check your connection and try again.');
      setBusy(false);
    }
  }, []);

  if (!isRestartRequired || dismissed) return null;

  const notes =
    typeof newReleaseBundle?.releaseNote === 'string' && newReleaseBundle.releaseNote.trim()
      ? newReleaseBundle.releaseNote.trim()
      : 'A new version of Astro Admin is ready. Update now to get the latest features and fixes.';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => !busy && setDismissed(true)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>⬇️</Text>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.body}>{notes}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={applyUpdate}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryText}>Update now</Text>
            )}
          </TouchableOpacity>
          {!busy ? (
            <TouchableOpacity style={styles.laterBtn} onPress={() => setDismissed(true)}>
              <Text style={styles.laterText}>Later</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.downloading}>Restarting…</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing(5),
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
    alignItems: 'center',
  },
  icon: { fontSize: 40, marginBottom: spacing(2) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', marginBottom: spacing(2) },
  body: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing(4),
    lineHeight: 20,
  },
  error: { color: colors.destructive, fontSize: 13, textAlign: 'center', marginBottom: spacing(3) },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  primaryText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 15 },
  laterBtn: { marginTop: spacing(3), paddingVertical: spacing(1) },
  laterText: { color: colors.muted, fontSize: 14 },
  downloading: { color: colors.muted, fontSize: 13, marginTop: spacing(3) },
});
