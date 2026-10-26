/**
 * Compact C2C call chip — same action as desktop PhoneInTalk C2C icon.
 */
import React from 'react';
import { Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function GtelC2cCallButton({ onPress, style }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="C2C Call"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <MaterialCommunityIcons name="phone-in-talk" size={14} color={colors.primaryForeground} />
      <Text style={styles.text}>Call</Text>
    </TouchableOpacity>
  );
}

const styles = {
  btn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing(1),
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: 5,
  },
  text: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
  },
};
