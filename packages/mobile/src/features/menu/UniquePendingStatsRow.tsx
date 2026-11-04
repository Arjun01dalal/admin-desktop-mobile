/**
 * Menu Unique Pending Total / Pending / Approved count + amount tiles.
 * Any tile opens the Unique Deposit Pending screen.
 */
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { toDisplayText } from '../../dashboards/jyotish/jyotishMapping';
import { useStyles } from '../theme';
import type { MenuUniquePendingStats } from './fetchMenuUniquePending';
import {
  createMenuStatStyles,
  formatMenuCount,
  formatMenuInr,
} from './menuStatUi';

type Props = {
  stats: MenuUniquePendingStats | null;
  loading: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Opens Unique Deposit Pending screen — wired from Menu hub. */
  onOpen: () => void;
};

export function UniquePendingStatsRow({
  stats,
  loading,
  errorMessage,
  onRetry,
  onOpen,
}: Props) {
  const styles = useStyles(createMenuStatStyles);
  const showError = Boolean(errorMessage) && stats == null && !loading;

  const tiles = [
    {
      key: 'total',
      label: 'Total',
      count: stats?.total,
      amount: stats?.totalAmount,
      accent: styles.info.color,
    },
    {
      key: 'pending',
      label: 'Pending',
      count: stats?.pending,
      amount: stats?.pendingAmount,
      accent: styles.primary.color,
    },
    {
      key: 'approved',
      label: 'Approved',
      count: stats?.approved,
      amount: stats?.approvedAmount,
      accent: styles.success.color,
    },
  ] as const;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity onPress={onOpen} activeOpacity={0.75} accessibilityRole="button">
        <Text style={styles.sectionTitle}>{toDisplayText('Unique Pending')}</Text>
      </TouchableOpacity>

      {showError ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText} numberOfLines={2}>
            {errorMessage}
          </Text>
          {onRetry ? (
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Retry Unique Pending"
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={styles.statsRow}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={styles.tileThird}
              onPress={onOpen}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${toDisplayText('Unique Pending')} ${toDisplayText(tile.label)}`}
            >
              <Text style={[styles.statLabelCompact, { color: tile.accent }]} numberOfLines={1}>
                {toDisplayText(tile.label)}
              </Text>
              {loading && stats == null ? (
                <ActivityIndicator size="small" color={styles.primary.color} />
              ) : (
                <>
                  <Text
                    style={styles.statValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {tile.count == null ? '—' : formatMenuCount(tile.count)}
                  </Text>
                  <Text
                    style={styles.statAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {tile.amount == null ? '—' : formatMenuInr(tile.amount)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
