/**
 * UpdateGate — OTA prompt (Stallion).
 *
 * Stallion syncs on launch; we also re-sync on foreground so production
 * releases are not missed until the next cold start.
 *
 * Prompt shows when:
 * - SDK says restart is required (PROD + tempHash + meta), OR
 * - native DOWNLOAD_COMPLETE_* fired (meta fetch can lag/fail — Stallion's
 *   isRestartRequired also requires newBundle.id, which often never flips)
 *
 * Mandatory downloads auto-apply after a short delay so OTA cannot get stuck
 * waiting on a modal that never appears in older prompt logic.
 *
 * No-op on web / Expo Go / Metro (__DEV__).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { styles } from './UpdateGate.styles';

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
  const [downloadReady, setDownloadReady] = useState(false);
  const [downloadNote, setDownloadNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const autoApplyRef = useRef(false);

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

  // Launch + resume sync — without this, a release published while the app
  // stayed warm is easy to miss until a full process kill.
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
      message?: string;
      isMandatory?: boolean;
    }) => {
      const type = event?.type || '';
      if (type === 'DOWNLOAD_COMPLETE_PROD' || type === 'DOWNLOAD_COMPLETE_STAGE') {
        setDownloadReady(true);
        setDismissed(false);
        if (typeof event.releaseNote === 'string' && event.releaseNote.trim()) {
          setDownloadNote(event.releaseNote.trim());
        }
        // Permanent fix: don't depend on isRestartRequired / modal alone.
        // Stallion leaves the new bundle in temp until restart() mounts it.
        if (!autoApplyRef.current) {
          autoApplyRef.current = true;
          setTimeout(() => {
            try {
              restart();
            } catch {
              autoApplyRef.current = false;
            }
          }, 1200);
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

  // If SDK eventually flips isRestartRequired (meta caught up), apply once.
  useEffect(() => {
    if (!isRestartRequired || autoApplyRef.current) return;
    const mandatory =
      typeof (newReleaseBundle as { isMandatory?: boolean } | undefined)?.isMandatory === 'boolean'
        ? Boolean((newReleaseBundle as { isMandatory?: boolean }).isMandatory)
        : true;
    if (!mandatory) return;
    autoApplyRef.current = true;
    const t = setTimeout(() => {
      try {
        restart();
      } catch {
        autoApplyRef.current = false;
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [isRestartRequired, newReleaseBundle]);

  const visible = (isRestartRequired || downloadReady) && !dismissed;
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
