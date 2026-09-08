/** OTP-gated block / unblock confirmation for a user row (desktop parity). */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { secureApi } from '../../api/client';
import { getSessionUser } from '../../auth/permissions';
import { colors } from '../../theme';
import { styles } from '../UsersScreen.styles';
import { display, isBlocked, resolveBlockOtpMobile, type Row } from './helpers';

export function BlockUserModal({
  row,
  onClose,
  onDone,
}: {
  row: Row | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'reason' | 'otp'>('reason');
  const [busy, setBusy] = useState(false);
  const target = resolveBlockOtpMobile(getSessionUser()?.mobile);

  useEffect(() => {
    setReason('');
    setOtp('');
    setStep('reason');
    setBusy(false);
  }, [row]);

  if (!row) return null;
  const blocking = !isBlocked(row);

  const sendOtp = async () => {
    if (!reason.trim()) {
      Alert.alert('Remark is required');
      return;
    }
    setBusy(true);
    try {
      const res = await secureApi<unknown>('users.sendBlockOtp', { mobile: target });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to send OTP');
        return;
      }
      setStep('otp');
    } finally {
      setBusy(false);
    }
  };

  const verifyAndApply = async () => {
    if (!/^\d{4}$/.test(otp.trim())) {
      Alert.alert('OTP must be 4 digits');
      return;
    }
    setBusy(true);
    try {
      const v = await secureApi<unknown>('users.verifyBlockOtp', {
        mobile: target,
        otp: Number(otp.trim()),
      });
      if (!v.ok) {
        Alert.alert(v.message || 'Invalid OTP');
        return;
      }
      const res = await secureApi<unknown>('users.blockUnblock', {
        _id: row._id,
        blockUser: blocking,
        blockUserReason: reason.trim(),
      });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to update user');
        return;
      }
      Alert.alert(res.message || (blocking ? 'User blocked' : 'User unblocked'));
      onClose();
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {blocking ? 'Block' : 'Unblock'} {display(row.name)}
          </Text>
          {step === 'reason' ? (
            <>
              <Text style={styles.modalSub}>Remark (required)</Text>
              <TextInput
                style={styles.modalInput}
                value={reason}
                onChangeText={setReason}
                placeholder="Reason…"
                placeholderTextColor={colors.muted}
                multiline
              />
            </>
          ) : (
            <>
              <Text style={styles.modalSub}>4-digit OTP sent for verification</Text>
              <TextInput
                style={[styles.modalInput, styles.otpInput]}
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 4))}
                placeholder="OTP"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={4}
              />
            </>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnGhost]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.mBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary, busy && styles.disabled]}
              onPress={() => void (step === 'reason' ? sendOtp() : verifyAndApply())}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.mBtnPrimaryText}>
                  {step === 'reason'
                    ? 'Send OTP'
                    : blocking
                      ? 'Verify & Block'
                      : 'Verify & Unblock'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
