/**
 * Compact status chip — shared by Gtel Calls, C2C Campaign, and similar lists.
 */
import React, { memo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { isDarkTheme } from '../theme';
import { styles } from './StatusPill.styles';

export type StatusPillTone =
  | 'answer'
  | 'noAnswer'
  | 'callback'
  | 'completed'
  | 'pending'
  | 'assigned'
  | 'muted';

const TONES_DARK: Record<StatusPillTone, { color: string; backgroundColor: string }> = {
  answer: { color: '#86efac', backgroundColor: 'rgba(22,163,74,0.28)' },
  noAnswer: { color: '#fca5a5', backgroundColor: 'rgba(239,68,68,0.28)' },
  callback: { color: '#fcd34d', backgroundColor: 'rgba(245,158,11,0.28)' },
  completed: { color: '#e0f2fe', backgroundColor: '#0284c7' },
  pending: { color: '#fcd34d', backgroundColor: 'rgba(245,158,11,0.28)' },
  assigned: { color: '#c4b5fd', backgroundColor: 'rgba(124,58,237,0.28)' },
  muted: { color: '#e2e8f0', backgroundColor: 'rgba(148,163,184,0.28)' },
};

const TONES_LIGHT: Record<StatusPillTone, { color: string; backgroundColor: string }> = {
  answer: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.16)' },
  noAnswer: { color: '#991b1b', backgroundColor: 'rgba(239,68,68,0.14)' },
  callback: { color: '#92400e', backgroundColor: 'rgba(245,158,11,0.18)' },
  completed: { color: '#075985', backgroundColor: 'rgba(14,165,233,0.2)' },
  pending: { color: '#92400e', backgroundColor: 'rgba(245,158,11,0.18)' },
  assigned: { color: '#5b21b6', backgroundColor: 'rgba(124,58,237,0.16)' },
  muted: { color: '#334155', backgroundColor: 'rgba(148,163,184,0.22)' },
};

type Props = {
  label: string;
  tone?: StatusPillTone;
  style?: StyleProp<ViewStyle>;
};

export const StatusPill = memo(function StatusPill({ label, tone = 'muted', style }: Props) {
  const palette = isDarkTheme() ? TONES_DARK : TONES_LIGHT;
  const colors = palette[tone] ?? palette.muted;
  return (
    <View style={[styles.pill, { backgroundColor: colors.backgroundColor }, style]}>
      <Text style={[styles.pillText, { color: colors.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});
