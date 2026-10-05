/**
 * Downloads recording via native FileSystem (desktop proxy parity), then plays locally.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors } from '../theme';
import {
  isAllowedRecordingUrl,
  normalizeRecordingUrl,
  prepareRecordingFile,
} from '../utils/recordingPlayback';
import { styles } from './RecordingPlayerModal.styles';

type Props = {
  visible: boolean;
  url: string | null;
  onClose: () => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function LocalPlayer({ localUri, onClose }: { localUri: string; onClose: () => void }) {
  const player = useAudioPlayer({ uri: localUri });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    return () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player]);

  const toggle = () => {
    try {
      if (status.playing) player.pause();
      else player.play();
    } catch {
      // ignore
    }
  };

  const duration = status.duration > 0 ? status.duration : 0;

  return (
    <>
      <Text style={styles.time}>
        {formatTime(status.currentTime)} / {duration > 0 ? formatTime(duration) : '--:--'}
      </Text>
      <Text style={styles.hint}>
        {status.playing ? 'Playing' : status.isLoaded ? 'Tap Play to listen' : 'Loading audio…'}
      </Text>
      <View style={styles.controls}>
        <TouchableOpacity style={styles.playBtn} onPress={toggle}>
          <Text style={styles.playBtnText}>{status.playing ? 'Pause' : 'Play'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export function RecordingPlayerModal({ visible, url, onClose }: Props) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!visible || !url) {
      setLocalUri(null);
      setError('');
      setLoading(false);
      setElapsed(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setLocalUri(null);
    setElapsed(0);

    const tick = setInterval(() => setElapsed((n) => n + 1), 1000);

    void (async () => {
      try {
        const uri = await prepareRecordingFile(url);
        if (!cancelled) setLocalUri(uri);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Recording could not be reached.');
        }
      } finally {
        clearInterval(tick);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [visible, url]);

  const openExternal = () => {
    if (!url) return;
    const normalized = normalizeRecordingUrl(url);
    if (!isAllowedRecordingUrl(normalized)) {
      setError('Recording host is not approved for external opening.');
      return;
    }
    void Linking.openURL(normalized).catch(() => undefined);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Call Recording</Text>

          {loading ? (
            <>
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.hint}>Downloading recording… {elapsed}s</Text>
              </View>
              <TouchableOpacity style={styles.secondaryBtn} onPress={openExternal}>
                <Text style={styles.secondaryBtnText}>Open in browser instead</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </>
          ) : error ? (
            <>
              <Text style={styles.error}>{error}</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={openExternal}>
                  <Text style={styles.secondaryBtnText}>Open in browser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : localUri ? (
            <LocalPlayer key={localUri} localUri={localUri} onClose={onClose} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

