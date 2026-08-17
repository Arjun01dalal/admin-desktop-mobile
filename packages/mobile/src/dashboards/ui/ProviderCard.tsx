/** Provider metric card — mirrors desktop ProviderMetricCard. */
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { toDisplayText } from '../jyotish/jyotishMapping';
import type { ProviderCardModel } from '../types';
import { LudoGameStatsPicker } from './LudoGameStatsPicker';

function formatValue(v: number | string): string {
  return typeof v === 'number' ? v.toLocaleString('en-IN') : String(v);
}

function isGgrLabel(label: string): boolean {
  return label.toLowerCase().includes('ggr');
}

export function ProviderCard({
  card,
  onPress,
  onActiveCustomersPress,
}: {
  card: ProviderCardModel;
  /** When provided, the card body becomes tappable (drill-in navigation). */
  onPress?: () => void;
  /** Laxmi ActiveUserData deep-link from player count. */
  onActiveCustomersPress?: () => void;
}) {
  const Wrapper: React.ElementType = onPress ? TouchableOpacity : View;
  const activeLabel = card.activeCustomerLabel || 'Active Customer';
  const useLudoTable =
    Boolean(card.selectStatsMap) &&
    Boolean(card.selectOptions?.length) &&
    Boolean(card.onSelectChange);

  return (
    <Wrapper
      style={styles.card}
      {...(onPress
        ? { onPress, activeOpacity: 0.75, accessibilityRole: 'button' as const }
        : {})}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{toDisplayText(card.title)}</Text>
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
        {card.loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
      </View>

      {useLudoTable ? (
        <View style={styles.ludoSelectWrap}>
          <LudoGameStatsPicker
            value={card.selectValue ?? 'All'}
            options={card.selectOptions!}
            statsMap={card.selectStatsMap}
            onChange={(v) => card.onSelectChange?.(v)}
            onGgrPress={card.onSelectGgrPress}
          />
        </View>
      ) : card.selectOptions &&
        card.selectOptions.length > 0 &&
        card.onSelectChange ? (
        <View style={styles.selectRow}>
          {card.selectOptions.map((opt) => {
            const active = (card.selectValue ?? 'All') === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => card.onSelectChange?.(opt.value)}
                style={[styles.selChip, active && styles.selChipActive]}
              >
                <Text
                  style={[
                    styles.selChipText,
                    active && styles.selChipTextActive,
                  ]}
                >
                  {toDisplayText(opt.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {card.activeCustomerCount != null ? (
        <TouchableOpacity
          disabled={!onActiveCustomersPress}
          onPress={() => onActiveCustomersPress?.()}
          style={styles.activeRow}
        >
          <Text style={styles.rowLabel}>{toDisplayText(activeLabel)}:</Text>
          <Text
            style={[
              styles.rowValue,
              onActiveCustomersPress ? styles.activeLink : null,
            ]}
          >
            {card.activeCustomerCount.toLocaleString('en-IN')}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.rows}>
        {card.rows.map((r, i) => {
          const ggr = isGgrLabel(r.label) && typeof r.value === 'number';
          const RowWrapper: React.ElementType = r.onPress ? TouchableOpacity : View;
          return (
            <RowWrapper
              key={`${r.label}-${i}`}
              style={[styles.row, i < card.rows.length - 1 && styles.rowBorder]}
              {...(r.onPress
                ? {
                    onPress: r.onPress,
                    activeOpacity: 0.7,
                    accessibilityRole: 'button' as const,
                  }
                : {})}
            >
              <Text style={styles.rowLabel}>{toDisplayText(r.label)}</Text>
              <Text
                style={[
                  styles.rowValue,
                  typeof r.value === 'number' && r.value < 0 && styles.negative,
                  ggr && (r.value as number) < 0 && styles.negative,
                  ggr && (r.value as number) >= 0 && styles.ggrPos,
                  ggr && styles.ggrUnderline,
                ]}
              >
                {formatValue(r.value)}
              </Text>
            </RowWrapper>
          );
        })}
      </View>

      {card.actions && card.actions.length > 0 && (
        <View style={styles.actionsRow}>
          {card.actions.map((action, ai) => (
            <TouchableOpacity key={`action-${ai}-${action.label}`} onPress={action.onClick}>
              <Text style={styles.actionLink}>
                {toDisplayText(action.label)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Wrapper>
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
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing(2),
  },
  title: { color: colors.primary, fontSize: 15, fontWeight: '700', flex: 1 },
  chevron: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: '700',
    marginRight: spacing(1),
  },
  ludoSelectWrap: { marginBottom: spacing(2) },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing(1.5),
    marginBottom: spacing(1),
    gap: spacing(2),
  },
  activeLink: { color: colors.primary, textDecorationLine: 'underline' },
  selectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
    paddingBottom: spacing(2),
  },
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
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  rowValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  negative: { color: colors.destructive },
  ggrPos: { color: colors.success },
  ggrUnderline: { textDecorationLine: 'underline' },
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
