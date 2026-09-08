import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../../../theme';
import { styles } from '../BannersScreen.styles';
import { ModalShell } from './ModalShell';
import { POSITION_OPTIONS } from './helpers';

type Props = {
  visible: boolean;
  title: string;
  position: string;
  message: string;
  saving: boolean;
  onClose: () => void;
  onPositionChange: (position: string) => void;
  onSave: () => void;
};

export function BannerPositionModal({
  visible,
  title,
  position,
  message,
  saving,
  onClose,
  onPositionChange,
  onSave,
}: Props) {
  return (
    <ModalShell visible={visible} title={title} onClose={onClose}>
      <TextInput
        style={styles.input}
        value={position}
        onChangeText={onPositionChange}
        placeholder="Position (1-25)"
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
      />
      <View style={styles.chipsRow}>
        {POSITION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, position === String(option) && styles.chipActive]}
            onPress={() => onPositionChange(String(option))}
          >
            <Text style={[styles.chipText, position === String(option) && styles.chipTextActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {message ? <Text style={styles.modalMsg}>{message}</Text> : null}
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.btnDisabled]}
        disabled={saving}
        onPress={onSave}
      >
        <Text style={styles.submitBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}
