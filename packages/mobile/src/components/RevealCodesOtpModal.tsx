/**
 * Reveal-codes OTP modal — mobile port of desktop RevealCodesOtpModal.
 * Sends a 4-digit OTP to the signed-in admin's registered mobile via
 * users.sendBlockOtp, verifies with users.verifyBlockOtp, then activates the
 * 1-hour "reveal original names" window (revealCodesStore).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { secureApi } from '../api/client';
import { getSessionUser } from '../auth/permissions';
import { activateRevealCodes, REVEAL_CODES_TTL_MS } from '../context/revealCodesStore';
import { colors} from '../theme';
import { styles } from './RevealCodesOtpModal.styles';

function apiFailed(res: { ok: boolean; success?: boolean }): boolean {
  return !res.ok || res.success === false;
}

type Props = { visible: boolean; onClose: () => void };

export function RevealCodesOtpModal({ visible, onClose }: Props) {
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const mobileRef = useRef('');

  useEffect(() => {
    if (!visible) {
      setOtp('');
      setSent(false);
      setSending(false);
      setVerifying(false);
      mobileRef.current = '';
      return;
    }
    const target = String(getSessionUser()?.mobile || '').trim();
    mobileRef.current = target;
    if (!target) {
      Alert.alert('Registered mobile not found on this session');
      onClose();
      return;
    }
    let alive = true;
    setSending(true);
    void (async () => {
      const res = await secureApi<unknown>('users.sendBlockOtp', { mobile: target });
      if (!alive) return;
      setSending(false);
      if (apiFailed(res)) {
        Alert.alert(res.message || 'Failed to send OTP');
        onClose();
        return;
      }
      setSent(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const verify = async () => {
    const target = mobileRef.current;
    const code = otp.trim();
    if (!/^\d{4}$/.test(code)) {
      Alert.alert('OTP must be 4 digits');
      return;
    }
    setVerifying(true);
    try {
      const res = await secureApi<unknown>('users.verifyBlockOtp', {
        mobile: target,
        otp: Number(code),
      });
      if (apiFailed(res)) {
        Alert.alert(res.message || 'Invalid OTP');
        return;
      }
      activateRevealCodes(REVEAL_CODES_TTL_MS);
      onClose();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={() => !verifying && onClose()}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>
        <View style={styles.card}>
          <Text style={styles.title}>Reveal original names</Text>
          {sending && !sent ? (
            <View style={styles.sendingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.sendingText}>Sending OTP…</Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4-digit OTP"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
            />
          )}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
              disabled={verifying}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, (verifying || !sent) && styles.btnDisabled]}
              onPress={() => void verify()}
              disabled={verifying || !sent}
            >
              <Text style={styles.btnPrimaryText}>{verifying ? 'Verifying…' : 'Verify'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

