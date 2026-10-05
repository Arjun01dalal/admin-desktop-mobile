/**
 * Full-screen SOS alert (desktop sos-alert window parity for mobile).
 * When SOS activates and this device is not the originator:
 * - loops a siren sound (plays even in iOS silent mode)
 * - shows a blocking acknowledge popup with who raised the alert
 * On Acknowledge: siren stops; non-exempt roles are logged out (panel lock).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useAuth } from '../auth/AuthContext';
import { isSosExemptRole } from '../auth/permissions';
import { useSos } from '../auth/useSosGuard';
import { styles } from './SosAlertOverlay.styles';

const SIREN = require('../../assets/siren.mp3');

export function SosAlertOverlay() {
  const { sosEnabled, block, originator } = useSos();
  const { logout } = useAuth();
  const [acked, setAcked] = useState(false);
  const player = useAudioPlayer(SIREN);
  const playingRef = useRef(false);

  const show = sosEnabled && !originator && !acked;

  // New SOS round → require a fresh acknowledge.
  useEffect(() => {
    if (!sosEnabled) setAcked(false);
  }, [sosEnabled]);

  useEffect(() => {
    if (show && !playingRef.current) {
      playingRef.current = true;
      void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
      player.loop = true;
      try {
        player.seekTo(0);
        player.play();
      } catch {
        // Audio unavailable (e.g. web preview) — popup still blocks.
      }
    } else if (!show && playingRef.current) {
      playingRef.current = false;
      try {
        player.pause();
      } catch {
        // ignore
      }
    }
  }, [show, player]);

  if (!show) return null;

  const who = String(block?.blockedByName || 'Admin');
  const where = String(block?.location || block?.officeLocation || '');

  const acknowledge = () => {
    playingRef.current = false;
    try {
      player.pause();
    } catch {
      // ignore
    }
    setAcked(true);
    if (!isSosExemptRole()) logout();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>🚨</Text>
          <Text style={styles.title}>SOS ACTIVE</Text>
          <Text style={styles.line}>
            Raised by <Text style={styles.bold}>{who}</Text>
            {where ? ` · ${where}` : ''}
          </Text>
          <Text style={styles.sub}>
            Emergency lock is active. Contact the admin team immediately.
          </Text>
          <TouchableOpacity style={styles.ackBtn} onPress={acknowledge}>
            <Text style={styles.ackText}>Acknowledge</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

