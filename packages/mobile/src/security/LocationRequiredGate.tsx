/**
 * Non-dismissible overlay when Location is off / denied.
 * Mirrors desktop LocationEnableDialog — panel stays blocked until location works.
 */
import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { styles } from './LocationRequiredGate.styles';

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSettings: () => void;
};

export function LocationRequiredGate({ open, loading, error, onRetry, onOpenSettings }: Props) {
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
            Location is required to use the panel. Make sure Location Services are ON and Astro has
            Location permission (While Using / Allow). This alert closes automatically once a fix is
            available.
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

