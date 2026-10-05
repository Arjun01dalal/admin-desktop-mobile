/** Provider metric card — mirrors desktop ProviderMetricCard. */
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { colors} from '../../theme';
import { toDisplayText } from '../jyotish/jyotishMapping';
import type { ProviderCardModel } from '../types';
import { LudoGameStatsPicker } from './LudoGameStatsPicker';
import { styles } from './ProviderCard.styles';

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
      {...(onPress ? { onPress, activeOpacity: 0.75, accessibilityRole: 'button' as const } : {})}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{toDisplayText(card.title)}</Text>
        {onPress ? <Text style={styles.chevron}>›</Text> : null}
        {card.loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
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
      ) : card.selectOptions && card.selectOptions.length > 0 && card.onSelectChange ? (
        <View style={styles.selectRow}>
          {card.selectOptions.map((opt) => {
            const active = (card.selectValue ?? 'All') === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => card.onSelectChange?.(opt.value)}
                style={[styles.selChip, active && styles.selChipActive]}
              >
                <Text style={[styles.selChipText, active && styles.selChipTextActive]}>
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
          <Text style={[styles.rowValue, onActiveCustomersPress ? styles.activeLink : null]}>
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
              <Text style={styles.actionLink}>{toDisplayText(action.label)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Wrapper>
  );
}

