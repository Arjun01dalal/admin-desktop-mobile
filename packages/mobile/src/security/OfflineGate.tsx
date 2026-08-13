/**
 * Non-dismissible overlay when the device has no network (Wi‑Fi / cellular off).
 * Closes automatically once NetInfo reports a connection again.
 */
import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  open: boolean;
  checking: boolean;
  onRetry: () => void;
};

export function OfflineGate({ open, checking, onRetry }: Props) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📡</Text>
          </View>
          <Text style={styles.title}>No internet</Text>
          <Text style={styles.body}>
            Your network is off. Turn on Wi‑Fi or mobile data to continue. This
            alert will close automatically once you are back online.
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(5),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#2b2b30',
    borderRadius: radius.lg,
    padding: spacing(5),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: spacing(3),
  },
  icon: { fontSize: 18 },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  body: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing(3),
  },
  actions: {
    flexDirection: 'row',
    gap: spacing(2),
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  btnOutlineText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.7,
  },
});
