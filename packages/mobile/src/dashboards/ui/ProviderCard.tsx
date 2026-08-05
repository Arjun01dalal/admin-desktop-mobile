/** Provider metric card — mirrors desktop ProviderMetricCard. */
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';
import type { ProviderCardModel } from '../types';

function formatValue(v: number | string): string {
  return typeof v === 'number' ? v.toLocaleString('en-IN') : String(v);
}

export function ProviderCard({ card }: { card: ProviderCardModel }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{card.title}</Text>
        {card.loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      {typeof card.activeCustomerCount === 'number' && card.activeCustomerCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            Active users: {card.activeCustomerCount.toLocaleString('en-IN')}
          </Text>
        </View>
      )}

      {card.selectOptions && card.selectOptions.length > 0 && card.onSelectChange && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectRow}
        >
          {[{ value: 'All', label: 'All' }, ...card.selectOptions].map((opt) => {
            const active = (card.selectValue ?? 'All') === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => card.onSelectChange?.(opt.value)}
                style={[styles.selChip, active && styles.selChipActive]}
              >
                <Text style={[styles.selChipText, active && styles.selChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.rows}>
        {card.rows.map((r, i) => (
          <View
            key={`${r.label}-${i}`}
            style={[styles.row, i < card.rows.length - 1 && styles.rowBorder]}
          >
            <Text style={styles.rowLabel}>{r.label}</Text>
            <Text
              style={[
                styles.rowValue,
                typeof r.value === 'number' && r.value < 0 && styles.negative,
              ]}
            >
              {formatValue(r.value)}
            </Text>
          </View>
        ))}
      </View>

      {card.actions && card.actions.length > 0 && (
        <View style={styles.actionsRow}>
          {card.actions.map((action) => (
            <TouchableOpacity key={action.label} onPress={action.onClick}>
              <Text style={styles.actionLink}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
  },
  title: { color: colors.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    marginBottom: spacing(2),
  },
  badgeText: { color: colors.success, fontSize: 11, fontWeight: '600' },
  selectRow: { gap: spacing(1.5), paddingBottom: spacing(2) },
  selChip: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  selChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selChipText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  selChipTextActive: { color: colors.primaryForeground },
  rows: {},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing(2),
    gap: spacing(2),
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  rowValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  negative: { color: colors.destructive },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing(4),
    marginTop: spacing(2),
    paddingTop: spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionLink: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
