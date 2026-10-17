/**
 * Horizontal KPI strip — Gtel summary / C2C campaign stats.
 */
import React, { memo } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { styles } from './StatStrip.styles';

export type StatStripItem = {
  key: string;
  label: string;
  value: string | number;
};

type Props = {
  items: StatStripItem[];
  style?: StyleProp<ViewStyle>;
};

export const StatStrip = memo(function StatStrip({ items, style }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={[styles.row, style]}>
      {items.map((item) => (
        <View key={item.key} style={styles.stat}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
});
