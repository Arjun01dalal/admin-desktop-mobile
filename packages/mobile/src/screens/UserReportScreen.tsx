/**
 * User Report / History — opened by tapping a user's name on the Users page.
 * Desktop parity: userReport/* (wallet summary + ledger, game history,
 * fund request deposit/withdrawal/coins). Route params: { userId, userName }.
 */
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { floorNum } from '../dashboards/mergeMetrics';


import { TabSelect } from './userReport/TabSelect';
import { TopCasinoGamesSection } from './userReport/TopCasinoGamesSection';
import { useWalletSummary } from './userReport/useWalletSummary';
import {
  ExchangeTab,
  FundTab,
  GameTab,
  MatkaTab,
  PlayerRtpLink,
  ProviderTab,
  QtechBetDetailsTab,
  QtechTab,
  RemoveBonusTab,
  SettleTab,
  WalletTab,
} from './userReport/tabs';
import {
  TABS,
  restrictCallerAmountTiles,
  type BonusKind,
  type Tab,
} from './userReport/helpers';
import { styles } from './UserReportScreen.styles';

/* --------------------------------- screen --------------------------------- */

export function UserReportScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: object) => void;
  }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const userId = String(params.userId ?? '');
  const userName = String(params.userName ?? '');
  const played = String(params.played ?? '').trim();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [tab, setTab] = useState<Tab>('Wallet History');
  const [amountsOpen, setAmountsOpen] = useState(true);
  const summary = useWalletSummary(userId);
  const isCaller = restrictCallerAmountTiles();

  const openBonus = useCallback(
    (kind: BonusKind) => {
      navigation.navigate('/bonus-wallet-referral-earning', {
        userId,
        userName,
        Type: kind,
        items: kind === 'availedBonus' ? (summary?.approvedBonusItems ?? []) : undefined,
      });
    },
    [navigation, summary?.approvedBonusItems, userId, userName],
  );

  const openExposure = useCallback(() => {
    navigation.navigate('/user_exposure', { userId, userName });
  }, [navigation, userId, userName]);

  const profit = summary ? summary.totalDeposit - summary.totalWithdrawal : 0;
  const profitAfter = summary
    ? summary.totalDeposit - summary.totalWithdrawal - summary.balance - summary.pendingWithdrawal
    : 0;

  const summaryCards: Array<{
    label: string;
    value: number;
    tone?: 'success' | 'error';
    onPress?: () => void;
  }> = summary
    ? isCaller
      ? [
          {
            label: 'User Exposure',
            value: summary.exposure,
            onPress: summary.exposure > 0 ? openExposure : undefined,
          },
          {
            label: `Bonus Earning (${summary.ownEarningCount})`,
            value: summary.ownEarning,
            onPress: summary.ownEarning > 0 ? () => openBonus('bonus') : undefined,
          },
        ]
      : [
          { label: 'Balance', value: summary.balance },
          { label: 'Total Deposit', value: summary.totalDeposit },
          { label: 'Total Refund', value: summary.totalWithdrawal },
          {
            label: profit < 0 ? 'Loss' : 'Profit',
            value: Math.abs(profit),
            tone: profit < 0 ? 'error' : 'success',
          },
          {
            label: profitAfter < 0 ? 'Loss After Withdrawal' : 'Profit After Withdrawal',
            value: Math.abs(profitAfter),
            tone: profitAfter < 0 ? 'error' : 'success',
          },
          {
            label: 'Bonus Wallet',
            value: summary.bonusWalletBalance,
            onPress: () => openBonus('bonus'),
          },
          { label: 'Pending Refund', value: summary.pendingWithdrawal },
          {
            label: 'User Exposure',
            value: summary.exposure,
            onPress: summary.exposure > 0 ? openExposure : undefined,
          },
          {
            label: `Bonus Referral Earning (${summary.referralCount})`,
            value: summary.referralEarning,
            onPress: summary.referralEarning > 0 ? () => openBonus('referral') : undefined,
          },
          {
            label: `Bonus Earning (${summary.ownEarningCount})`,
            value: summary.ownEarning,
            onPress: summary.ownEarning > 0 ? () => openBonus('bonus') : undefined,
          },
          {
            label: `Availed Bonus (${summary.approvedBonusCount})`,
            value: summary.approvedBonus,
            onPress: summary.approvedBonus > 0 ? () => openBonus('availedBonus') : undefined,
          },
        ]
    : [];

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerName}>
          <Text style={styles.title} numberOfLines={1}>
            {userName || 'User Report'}
          </Text>
          <Text style={styles.sub} numberOfLines={2}>
            ID: {userId}
            {played && played !== '—' ? ` · In: ${played}` : ''}
          </Text>
        </View>
        <TabSelect value={tab} options={TABS} onChange={setTab} />
      </View>

      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={() => setAmountsOpen((o) => !o)}
        activeOpacity={0.8}
      >
        <Text style={styles.collapseTitle}>{isCaller ? 'Exposure & Bonus' : 'Amounts'}</Text>
        <Text style={styles.collapseChevron}>{amountsOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {amountsOpen ? (
        <View style={styles.summaryGrid}>
          {summaryCards.map(({ label, value, tone, onPress }) => (
            <TouchableOpacity
              key={label}
              activeOpacity={onPress ? 0.85 : 1}
              disabled={!onPress}
              onPress={onPress}
              style={[
                styles.summaryCard,
                compact && styles.summaryCardCompact,
                onPress && styles.summaryCardClickable,
                tone === 'success' && styles.summaryCardSuccess,
                tone === 'error' && styles.summaryCardError,
              ]}
            >
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  tone === 'success' && styles.summaryValueSuccess,
                  tone === 'error' && styles.summaryValueError,
                  onPress && styles.summaryValueClickable,
                ]}
              >
                ₹{floorNum(value).toLocaleString('en-IN')}
              </Text>
              {onPress ? <Text style={styles.summaryHint}>Tap to view</Text> : null}
            </TouchableOpacity>
          ))}
          {!summary ? <Text style={styles.muted}>Loading summary…</Text> : null}
        </View>
      ) : null}

      <TopCasinoGamesSection userId={userId} />

      <TabBody tab={tab} userId={userId} />
    </ScrollView>
  );
}

function TabBody({ tab, userId }: { tab: Tab; userId: string }) {
  switch (tab) {
    case 'Wallet History':
      return <WalletTab userId={userId} />;
    case 'Game History':
      return <GameTab userId={userId} />;
    case 'Fund Request':
      return <FundTab userId={userId} />;
    case 'Starline History':
      return <MatkaTab userId={userId} variant="starline" />;
    case 'King Bazar History':
      return <MatkaTab userId={userId} variant="king" />;
    case 'Instant Worli History':
      return <MatkaTab userId={userId} variant="worli" />;
    case 'Crazzy Wheel':
      return <MatkaTab userId={userId} variant="crazy" />;
    case 'Qtech History':
      return <QtechTab userId={userId} />;
    case 'JetFair History':
      return <ExchangeTab userId={userId} variant="jetfair" />;
    case 'Falcon History':
      return <ExchangeTab userId={userId} variant="falcon" />;
    case 'Remove Bonus Coins':
      return <RemoveBonusTab userId={userId} />;
    case 'Qtech Provider History':
      return <ProviderTab userId={userId} kind="qtech" />;
    case 'Qtech Missing Bets':
      return <ProviderTab userId={userId} kind="missing" />;
    case 'Jetfair Provider History':
      return <ProviderTab userId={userId} kind="jetfair" />;
    case 'SM Provider History':
      return <ProviderTab userId={userId} kind="sm" />;
    case 'Qtech Bet Details':
      return <QtechBetDetailsTab userId={userId} />;
    case 'Settle SM Bets':
      return <SettleTab userId={userId} kind="sm" />;
    case 'Settle Jetfair Bets':
      return <SettleTab userId={userId} kind="jetfair" />;
    case 'Player RTP':
      return <PlayerRtpLink userId={userId} />;
    default:
      return null;
  }
}

/* --------------------------------- styles --------------------------------- */
