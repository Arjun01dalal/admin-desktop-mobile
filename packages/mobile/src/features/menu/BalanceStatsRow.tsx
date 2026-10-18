/**
 * Welcome Balance KPI tiles — extracted from WelcomeScreen for feature cohesion.
 */
import React, { useCallback } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { toDisplayText } from '../../dashboards/jyotish/jyotishMapping';
import { canOpenPanelPath, openPanelTarget } from '../../navigation/panelDetail';
import type { ThemeColors } from '../../themeTokens/palettes';
import { useStyles } from '../theme';
import { balanceNavTarget, type BalanceStatKey } from './balanceNav';
import type { MenuStats } from './useMenuStats';

function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

const createBalanceStyles = (c: ThemeColors) => ({
  statsAsOf: {
    color: c.muted,
    fontSize: 9,
    fontWeight: '700' as const,
    marginTop: 4,
    letterSpacing: 0.2,
    textAlign: 'center' as const,
  },
  statsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    marginTop: 6,
    width: '100%' as const,
  },
  statTile: {
    width: '48%' as const,
    flexGrow: 1,
    minWidth: '46%' as const,
    maxWidth: '49%' as const,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'flex-start' as const,
  },
  statLabel: {
    color: c.muted,
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    marginBottom: 2,
  },
  statValue: {
    color: c.foreground,
    fontSize: 14,
    fontWeight: '800' as const,
    width: '100%' as const,
  },
  primary: { color: c.primary },
});

type Props = {
  stats: MenuStats | null;
  loading: boolean;
  canSeeDashboard: boolean;
  canOpenWithdrawal: boolean;
  asOfDate?: string;
};

export function BalanceStatsRow({
  stats,
  loading,
  canSeeDashboard,
  canOpenWithdrawal,
  asOfDate,
}: Props) {
  const navigation = useNavigation();
  const styles = useStyles(createBalanceStyles);

  const canOpenUsersBalance = canOpenPanelPath('/balance-f');

  const onPress = useCallback(
    (key: BalanceStatKey) => {
      const target = balanceNavTarget(key, {
        asOfDate,
        canOpenUsersBalance,
        canSeeDashboard,
        canOpenWithdrawal,
      });
      if (target.type === 'none') return;
      const nav = navigation as {
        navigate: (name: string, params?: Record<string, unknown>) => void;
      };
      if (target.type === 'panel') {
        openPanelTarget(navigation, { href: target.href });
        return;
      }
      if (target.name === 'withdrawal') {
        nav.navigate('withdrawal', target.params);
        return;
      }
      nav.navigate('dashboard');
    },
    [asOfDate, canOpenUsersBalance, canOpenWithdrawal, canSeeDashboard, navigation],
  );

  const tiles = [
    {
      key: 'balance' as const,
      label: 'Total Users Balance',
      value: stats?.balance,
      tappable: canOpenUsersBalance,
    },
    {
      key: 'deposit' as const,
      label: 'Total Deposits',
      value: stats?.totalDeposit,
      tappable: canSeeDashboard,
    },
    {
      key: 'pending' as const,
      label: 'Pending Withdrawal',
      value: stats?.pendingWithdrawal,
      tappable: canOpenWithdrawal,
    },
    {
      key: 'total' as const,
      label: 'Total Withdrawal',
      value: stats?.totalWithdrawal,
      tappable: canOpenWithdrawal,
    },
  ];

  return (
    <>
      {asOfDate ? <Text style={styles.statsAsOf}>Today · {asOfDate}</Text> : null}
      <View style={styles.statsRow}>
        {tiles.map((tile) => {
          const body = (
            <>
              <Text style={styles.statLabel} numberOfLines={2}>
                {toDisplayText(tile.label)}
              </Text>
              {loading && stats == null ? (
                <ActivityIndicator size="small" color={styles.primary.color} />
              ) : (
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {tile.value == null ? '—' : formatInr(tile.value)}
                </Text>
              )}
            </>
          );
          if (!tile.tappable) {
            return (
              <View key={tile.key} style={styles.statTile}>
                {body}
              </View>
            );
          }
          return (
            <TouchableOpacity
              key={tile.key}
              style={styles.statTile}
              onPress={() => onPress(tile.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={toDisplayText(tile.label)}
            >
              {body}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}
