/**
 * UpdateGate — OTA update prompt (EAS Update / expo-updates).
 *
 * Every time you publish new code with `eas update`, the app checks for it on
 * launch and when it returns to the foreground. If a newer bundle is available,
 * a popup appears: "Update available" → tapping "Update now" downloads the new
 * JS bundle and reloads the app into it.
 *
 * No-op in Expo Go / dev (Updates.isEnabled === false) so local development is
 * unaffected — this only runs in real dev/preview/production builds.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Updates from 'expo-updates';
import { colors, radius, spacing } from '../theme';

export function UpdateGate() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const check = useCallback(async () => {
    // Disabled in Expo Go / dev builds without updates configured.
    if (!Updates.isEnabled) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setAvailable(true);
    } catch {
      /* offline or no update server — ignore silently */
    }
  }, []);

  // Check on mount and whenever the app comes back to the foreground.
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const applyUpdate = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) {
        await Updates.reloadAsync(); // restarts into the new bundle
      } else {
        setAvailable(false);
      }
    } catch {
      setError('Update failed. Please check your connection and try again.');
      setBusy(false);
    }
  }, []);

  if (!available) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !busy && setAvailable(false)}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>⬇️</Text>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.body}>
            A new version of Astro Admin is ready. Update now to get the latest features and fixes.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            onPress={() => void applyUpdate()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryText}>Update now</Text>
            )}
          </TouchableOpacity>
          {!busy ? (
            <TouchableOpacity style={styles.laterBtn} onPress={() => setAvailable(false)}>
              <Text style={styles.laterText}>Later</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.downloading}>Downloading update…</Text>
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
