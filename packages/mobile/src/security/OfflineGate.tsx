/**
 * Non-dismissible overlay when the device has no network (Wi‑Fi / cellular off).
 * Closes automatically once the device reports a connection again.
 */
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors} from '../theme';
import { styles } from './OfflineGate.styles';

type Props = {
  open: boolean;
  checking: boolean;
  onRetry: () => void;
};

export function OfflineGate({ open, checking, onRetry }: Props) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📡</Text>
          </View>
          <Text style={styles.title}>No internet</Text>
          <Text style={styles.body}>
            Your network is off. Turn on Wi‑Fi or mobile data to continue. This alert will close
            automatically once you are back online.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline]}
              onPress={() => void Linking.openSettings().catch(() => {})}
              disabled={checking}
              activeOpacity={0.85}
            >
              <Text style={styles.btnOutlineText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, checking && styles.btnDisabled]}
              onPress={onRetry}
              disabled={checking}
              activeOpacity={0.85}
            >
              {checking ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Try again</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

