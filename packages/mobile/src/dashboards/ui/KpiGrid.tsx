/** Responsive KPI tile grid — mirrors desktop KpiStatGrid (2 cols on phones). */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import type { KpiItem } from '../types';

function formatValue(item: KpiItem): string {
  if (typeof item.value === 'number') {
    return `${item.prefix ?? ''}${item.value.toLocaleString('en-IN')}`;
  }
  return `${item.prefix ?? ''}${item.value}`;
}

export function KpiGrid({
  items,
  onItemPress,
  isItemTappable,
}: {
  items: KpiItem[];
  /** When provided, tiles with a target become tappable. */
  onItemPress?: (item: KpiItem) => void;
  /** Extra gate — e.g. only hrefs with an implemented mobile screen. */
  isItemTappable?: (item: KpiItem) => boolean;
}) {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  if (!items.length) return null;
  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const tappable =
          !!onItemPress && !!item.href && (isItemTappable ? isItemTappable(item) : true);
        const body = (
          <>
            <Text style={[styles.label, tappable && styles.labelLink]} numberOfLines={2}>
              {item.label}
            </Text>
            {!item.headingOnly && <Text style={styles.value}>{formatValue(item)}</Text>}
          </>
        );
        const tileStyle = [
          styles.tile,
          { flexBasis: `${100 / cols - 2}%` as const },
          tappable && styles.tileTappable,
        ];
        return tappable ? (
          <TouchableOpacity
            key={item.id}
            style={tileStyle}
            activeOpacity={0.7}
            onPress={() => onItemPress?.(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            {body}
          </TouchableOpacity>
        ) : (
          <View key={item.id} style={tileStyle}>
            {body}
          </View>
        );
      })}
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
  tileTappable: { borderColor: colors.primary },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  labelLink: { color: colors.primary },
  value: { color: colors.foreground, fontSize: 17, fontWeight: '700', marginTop: spacing(1) },
});
