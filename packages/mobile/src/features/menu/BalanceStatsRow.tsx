/**
 * Welcome Balance KPI tiles — extracted from WelcomeScreen for feature cohesion.
 */
import React, { useCallback } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { toDisplayText } from '../../dashboards/jyotish/jyotishMapping';
import { canOpenPanelPath, openPanelTarget } from '../../navigation/panelDetail';
import { useStyles } from '../theme';
import { balanceNavTarget, type BalanceStatKey } from './balanceNav';
import { createMenuStatStyles, formatMenuInr } from './menuStatUi';
import type { MenuStats } from './useMenuStats';

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
  const { user } = useAuth();
  const styles = useStyles(createMenuStatStyles);

  const canOpenUsersBalance = canOpenPanelPath('/balance-f', user);

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
      label: 'Total Deposit',
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
                  {tile.value == null ? '—' : formatMenuInr(tile.value)}
                </Text>
              )}
            </>
          );
          if (!tile.tappable) {
            return (
              <View key={tile.key} style={styles.tileHalf}>
                {body}
              </View>
            );
          }
          return (
            <TouchableOpacity
              key={tile.key}
              style={styles.tileHalf}
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
