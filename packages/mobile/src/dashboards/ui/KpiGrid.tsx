/** Responsive KPI tile grid — mirrors desktop KpiStatGrid (2 cols on phones). */
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import type { KpiItem } from '../types';

function formatValue(item: KpiItem): string {
  if (typeof item.value === 'number') {
    return `${item.prefix ?? ''}${item.value.toLocaleString('en-IN')}`;
  }
  return `${item.prefix ?? ''}${item.value}`;
}

export function KpiGrid({ items }: { items: KpiItem[] }) {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  if (!items.length) return null;
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.id} style={[styles.tile, { flexBasis: `${100 / cols - 2}%` }]}>
          <Text style={styles.label} numberOfLines={2}>
            {item.label}
          </Text>
          {!item.headingOnly && <Text style={styles.value}>{formatValue(item)}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  tile: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing(3),
    minHeight: 74,
    justifyContent: 'space-between',
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  value: { color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: spacing(1) },
});
