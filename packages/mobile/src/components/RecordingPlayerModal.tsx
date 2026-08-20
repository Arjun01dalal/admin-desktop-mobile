/**
 * Downloads recording via native FileSystem (desktop proxy parity), then plays locally.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { colors, radius, spacing } from '../theme';
import { normalizeRecordingUrl, prepareRecordingFile } from '../utils/recordingPlayback';

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
    void Linking.openURL(normalizeRecordingUrl(url)).catch(() => undefined);
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(3),
  },
  title: { color: colors.foreground, fontSize: 17, fontWeight: '700' },
  time: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  error: { color: colors.destructive, fontSize: 13, lineHeight: 20 },
  loadingBox: { alignItems: 'center', gap: spacing(2), paddingVertical: spacing(2) },
  controls: { alignItems: 'center', paddingVertical: spacing(1) },
  playBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(3),
    minWidth: 120,
    alignItems: 'center',
  },
  playBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignSelf: 'center',
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  closeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    alignSelf: 'flex-end',
  },
  closeBtnText: { color: colors.foreground, fontWeight: '600', fontSize: 13 },
});
