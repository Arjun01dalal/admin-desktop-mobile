/**
 * UpdateGate — OTA prompt (Stallion).
 *
 * Syncs on launch + foreground. Shows when a new release is downloaded
 * (different hash than the OTA already running). Restart only happens when
 * the user taps "Update now" — never auto-restart.
 *
 * No-op on web / Expo Go / Metro (__DEV__).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import {
  addEventListener,
  removeEventListener,
  restart,
  sync,
  useStallionUpdate,
} from 'react-native-stallion';
import { colors } from '../theme';
import { isAlreadyRunningOta } from './otaHash';
import { styles } from './UpdateGate.styles';

function stallionOtaEnabled(): boolean {
  if (Platform.OS === 'web' || __DEV__) return false;
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo';
  return !inExpoGo;
}

function bundleChecksum(
  bundle: { sha256Checksum?: string; id?: string } | null | undefined,
): string {
  if (!bundle) return '';
  if (typeof bundle.sha256Checksum === 'string' && bundle.sha256Checksum.trim()) {
    return bundle.sha256Checksum.trim();
  }
  if (typeof bundle.id === 'string' && bundle.id.trim()) return bundle.id.trim();
  return '';
}

export function UpdateGate() {
  if (!stallionOtaEnabled()) return null;
  return <StallionUpdatePrompt />;
}

function StallionUpdatePrompt() {
  const { isRestartRequired, newReleaseBundle } = useStallionUpdate();
  const [downloadReady, setDownloadReady] = useState(false);
  const [downloadNote, setDownloadNote] = useState('');
  const [pendingHash, setPendingHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const requestSync = useCallback(() => {
    try {
      sync?.();
    } catch {
      // Native module may be unavailable on odd binaries.
    }
  }, []);

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

  // Launch + resume sync.
  useEffect(() => {
    requestSync();
    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') requestSync();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [requestSync]);

  useEffect(() => {
    const onEvent = (event: {
      type?: string;
      releaseNote?: string;
      releaseHash?: string;
      message?: string;
    }) => {
      const type = event?.type || '';
      if (type === 'DOWNLOAD_COMPLETE_PROD' || type === 'DOWNLOAD_COMPLETE_STAGE') {
        const hash = typeof event.releaseHash === 'string' ? event.releaseHash.trim() : '';
        // Already on this CodePush — ignore (stops every-launch popup loop).
        if (!hash || isAlreadyRunningOta(hash)) return;

        setPendingHash(hash);
        setDownloadReady(true);
        setDismissed(false);
        if (typeof event.releaseNote === 'string' && event.releaseNote.trim()) {
          setDownloadNote(event.releaseNote.trim());
        }
        return;
      }
      if (type === 'SYNC_ERROR_PROD' || type === 'DOWNLOAD_ERROR_PROD') {
        console.warn('[stallion] sync/download error', event?.message || event);
      }
    };
    addEventListener(onEvent);
    return () => removeEventListener(onEvent);
  }, []);

  useEffect(() => {
    if (!isRestartRequired) return;
    const metaHash = bundleChecksum(
      newReleaseBundle as { sha256Checksum?: string; id?: string } | null,
    );
    if (!metaHash && !pendingHash) return;
    const hash = metaHash || pendingHash;
    if (isAlreadyRunningOta(hash)) return;

    setPendingHash(hash);
    setDownloadReady(true);
    setDismissed(false);
  }, [isRestartRequired, newReleaseBundle, pendingHash]);

  const offeredHash =
    pendingHash ||
    bundleChecksum(newReleaseBundle as { sha256Checksum?: string; id?: string } | null);

  const visible =
    !dismissed &&
    (downloadReady || isRestartRequired) &&
    Boolean(offeredHash) &&
    !isAlreadyRunningOta(offeredHash);

  if (!visible) return null;

  const notes =
    (typeof newReleaseBundle?.releaseNote === 'string' && newReleaseBundle.releaseNote.trim()) ||
    downloadNote ||
    'A new version of Astro Admin is ready. Update now to get the latest features and fixes.';

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
