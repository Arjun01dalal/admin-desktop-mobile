/**
 * Non-dismissible overlay when Location is off / denied.
 * Mirrors desktop LocationEnableDialog — panel stays blocked until location works.
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSettings: () => void;
};

export function LocationRequiredGate({
  open,
  loading,
  error,
  onRetry,
  onOpenSettings,
}: Props) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      // Non-cancelable: back / outside tap must not dismiss.
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📍</Text>
          </View>
          <Text style={styles.title}>Location Required</Text>
          <Text style={styles.body}>
            Location is turned off. You cannot use the panel until Location is ON.
            Turn it on in System Settings — this alert will close automatically once
            location is available.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline]}
              onPress={onOpenSettings}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnOutlineText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={onRetry}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
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
  error: {
    color: colors.destructive,
    fontSize: 12,
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
