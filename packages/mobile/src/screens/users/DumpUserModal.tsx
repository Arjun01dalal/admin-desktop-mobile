/** Dump-user confirmation with a required reason (desktop parity). */
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
import { display, type Row } from './helpers';

export function DumpUserModal({
  row,
  onClose,
  onDone,
}: {
  row: Row | null;
  onClose: () => void;
  /** Called with dumped user id on success (parent should remove row locally). */
  onDone: (userId: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReason('');
    setBusy(false);
  }, [row]);

  if (!row) return null;

  const confirmDump = async () => {
    if (!reason.trim()) {
      Alert.alert('Reason is required');
      return;
    }
    setBusy(true);
    try {
      // IST date YYYY-MM-DD (desktop parity)
      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await secureApi<unknown>('ops.dumpUsersUpdate', {
        _id: row._id,
        dump: true,
        dumpReason: {
          name: getSessionUser()?.name || '',
          reason: reason.trim(),
          Date: istDate,
        },
      });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to dump user');
        return;
      }
      const dumpedId = row._id;
      onClose();
      onDone(dumpedId);
      Alert.alert('User dumped');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Dump {display(row.name)}?</Text>
          <Text style={styles.modalSub}>
            Are you sure you want to dump this user? Reason (required)
          </Text>
          <TextInput
            style={styles.modalInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Reason…"
            placeholderTextColor={colors.muted}
            multiline
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnGhost]}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.mBtnGhostText}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary, busy && styles.disabled]}
              onPress={() => void confirmDump()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.mBtnPrimaryText}>Yes, Dump</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
