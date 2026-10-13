/**
 * Lazy screen getters — modules load on first navigation (not at app boot).
 */
import React from 'react';

type AnyScreen = React.ComponentType<Record<string, unknown>>;

function named(mod: Record<string, unknown>, exportName: string): AnyScreen {
  const Comp = mod[exportName];
  if (typeof Comp !== 'function') {
    throw new Error(`lazyScreens: missing export ${exportName}`);
  }
  return Comp as AnyScreen;
}

/** Drawer / root path → lazy component factory. */
export const LAZY_IMPLEMENTED: Record<string, () => AnyScreen> = {
  '/welcome': () => named(require('../screens/WelcomeScreen'), 'WelcomeScreen'),
  '/dashboard': () => {
    const { OpsDashboardScreen } = require('../screens/dashboards/OpsDashboardScreen');
    return function OpsMain() {
      return <OpsDashboardScreen mode="main" />;
    } as AnyScreen;
  },
  '/vip-dashboard': () => {
    const { OpsDashboardScreen } = require('../screens/dashboards/OpsDashboardScreen');
    return function OpsVip() {
      return <OpsDashboardScreen mode="vip" />;
    } as AnyScreen;
  },
  '/combined-dashboard': () => {
    const { OpsDashboardScreen } = require('../screens/dashboards/OpsDashboardScreen');
    return function OpsCombined() {
      return <OpsDashboardScreen mode="combined" />;
    } as AnyScreen;
  },
  '/risk-dashboard': () =>
    named(require('../screens/dashboards/RiskAnalysisScreen'), 'RiskAnalysisScreen'),
  '/analytics': () => named(require('../screens/dashboards/AnalysisScreen'), 'AnalysisScreen'),
  '/master-flow': () =>
    named(require('../screens/dashboards/details/MasterFlowScreen'), 'MasterFlowScreen'),
  '/house-games': () =>
    named(require('../screens/dashboards/details/HouseGamesScreen'), 'HouseGamesScreen'),
  '/leaderboard': () =>
    named(require('../screens/dashboards/details/LeaderboardScreen'), 'LeaderboardScreen'),
  '/profit-loss': () =>
    named(require('../screens/dashboards/details/ProfitLossScreen'), 'ProfitLossScreen'),
  '/caller-responsibility': () =>
    named(
      require('../screens/dashboards/details/CallerResponsibilityScreen'),
      'CallerResponsibilityScreen',
    ),
  '/player-activity': () =>
    named(require('../screens/dashboards/details/PlayerActivityScreen'), 'PlayerActivityScreen'),
  '/game-activity': () =>
    named(require('../screens/dashboards/details/GameActivityScreen'), 'GameActivityScreen'),
  '/call-logs': () =>
    named(require('../screens/dashboards/details/CallLogsScreen'), 'CallLogsScreen'),
  '/gtel-calls': () =>
    named(require('../screens/dashboards/details/GtelCallsScreen'), 'GtelCallsScreen'),
  '/dialer-push-data': () =>
    named(require('../screens/dashboards/details/DialerPushDataScreen'), 'DialerPushDataScreen'),
  '/new-registers': () =>
    named(require('../screens/dashboards/details/NewRegistersScreen'), 'NewRegistersScreen'),
  '/register-user-report': () =>
    named(
      require('../screens/dashboards/details/StateWiseRegistrationScreen'),
      'StateWiseRegistrationScreen',
    ),
  '/login-report': () =>
    named(require('../screens/dashboards/details/LoginReportScreen'), 'LoginReportScreen'),
  '/all-user-login-report': () =>
    named(
      require('../screens/dashboards/details/AllUserLoginReportScreen'),
      'AllUserLoginReportScreen',
    ),
  '/sos-blocked-users': () =>
    named(require('../screens/dashboards/details/SosBlockedUsersScreen'), 'SosBlockedUsersScreen'),
  '/checkers-report': () =>
    named(require('../screens/dashboards/details/CheckersReportScreen'), 'CheckersReportScreen'),
  '/download-report': () =>
    named(
      require('../screens/dashboards/details/SheetDownloadReportScreen'),
      'SheetDownloadReportScreen',
    ),
  '/downlaodReport': () =>
    named(
      require('../screens/dashboards/details/SheetDownloadReportScreen'),
      'SheetDownloadReportScreen',
    ),
  '/coins-report': () =>
    named(require('../screens/dashboards/details/PointsReportScreen'), 'PointsReportScreen'),
  '/coins-removal': () =>
    named(require('../screens/dashboards/details/CoinRemovalListScreen'), 'CoinRemovalListScreen'),
  '/show_my_coin_history': () =>
    named(
      require('../screens/dashboards/details/ShowMyCoinHistoryScreen'),
      'ShowMyCoinHistoryScreen',
    ),
  '/customer-allotment': () =>
    named(
      require('../screens/dashboards/details/CustomerAllotmentScreen'),
      'CustomerAllotmentScreen',
    ),
  '/callerAllotment': () =>
    named(require('../screens/dashboards/details/CallerAllotmentScreen'), 'CallerAllotmentScreen'),
  '/non_performing_user': () =>
    named(
      require('../screens/dashboards/details/NonPerformingUserScreen'),
      'NonPerformingUserScreen',
    ),
  '/todays-active': () =>
    named(require('../screens/dashboards/details/TodaysActiveScreen'), 'TodaysActiveScreen'),
  '/feedback': () =>
    named(require('../screens/dashboards/details/FeedbackScreen'), 'FeedbackScreen'),
  '/betConstruct-lists': () =>
    named(
      require('../screens/dashboards/details/BetConstructGamesScreen'),
      'BetConstructGamesScreen',
    ),
  '/casino-lists': () =>
    named(require('../screens/dashboards/details/CasinoGamesScreen'), 'CasinoGamesScreen'),
  '/dynamic-casino-switching': () =>
    named(require('../screens/dashboards/details/CasinoSwitchScreen'), 'CasinoSwitchScreen'),
  '/top-games': () =>
    named(require('../screens/dashboards/details/TopGamesScreen'), 'TopGamesScreen'),
  '/casino-topup-balance': () =>
    named(
      require('../screens/dashboards/details/CasinoTopupBalanceScreen'),
      'CasinoTopupBalanceScreen',
    ),
  '/banners': () => named(require('../screens/dashboards/details/BannersScreen'), 'BannersScreen'),
  '/push-notifications': () =>
    named(
      require('../screens/dashboards/details/PushNotificationsScreen'),
      'PushNotificationsScreen',
    ),
  '/block-withdrawal': () =>
    named(require('../screens/dashboards/details/BlockWithdrawalScreen'), 'BlockWithdrawalScreen'),
  '/ggr-alert': () =>
    named(require('../screens/dashboards/details/GgrAlertScreen'), 'GgrAlertScreen'),
  '/all-upi-payments': () =>
    named(require('../screens/dashboards/details/UpiPaymentsScreen'), 'UpiPaymentsScreen'),
  '/upi-lists': () =>
    named(require('../screens/dashboards/details/UpiListsScreen'), 'UpiListsScreen'),
  '/utr-provider': () =>
    named(require('../screens/dashboards/details/UtrProviderScreen'), 'UtrProviderScreen'),
  '/instant-provider': () =>
    named(
      require('../screens/dashboards/details/InstantDepositProvidersScreen'),
      'InstantDepositProvidersScreen',
    ),
  '/pay-g-mid': () =>
    named(
      require('../screens/dashboards/details/DepositProvidersScreen'),
      'DepositProvidersScreen',
    ),
  '/deposit-config': () =>
    named(require('../screens/dashboards/details/DepositConfigScreen'), 'DepositConfigScreen'),
  '/mid-limits': () =>
    named(require('../screens/dashboards/details/MidLimitsScreen'), 'MidLimitsScreen'),
  '/deposit': () => named(require('../screens/dashboards/details/DepositScreen'), 'DepositScreen'),
  '/users-kyc': () =>
    named(require('../screens/dashboards/details/UsersKycScreen'), 'UsersKycScreen'),
  '/fund-request': () =>
    named(require('../screens/dashboards/details/FundRequestScreen'), 'FundRequestScreen'),
  '/funds': () => named(require('../screens/dashboards/details/FundsScreen'), 'FundsScreen'),
  '/payout-accounts': () =>
    named(
      require('../screens/dashboards/details/WithdrawalProvidersScreen'),
      'WithdrawalProvidersScreen',
    ),
  '/botData': () => named(require('../screens/dashboards/details/BotDataScreen'), 'BotDataScreen'),
  '/playerRtp': () =>
    named(require('../screens/dashboards/details/PlayerRtpScreen'), 'PlayerRtpScreen'),
  '/dumpUsers': () =>
    named(require('../screens/dashboards/details/DumpUsersScreen'), 'DumpUsersScreen'),
  '/percentage': () =>
    named(require('../screens/dashboards/details/PercentageScreen'), 'PercentageScreen'),
  '/newdeposits': () =>
    named(require('../screens/dashboards/details/NewDepositsScreen'), 'NewDepositsScreen'),
  '/botPerformance': () =>
    named(require('../screens/dashboards/details/BotPerformanceScreen'), 'BotPerformanceScreen'),
  '/depositList': () =>
    named(require('../screens/dashboards/details/DepositListScreen'), 'DepositListScreen'),
  '/withdrawal-fund': () =>
    named(require('../screens/dashboards/details/WithdrawalFundScreen'), 'WithdrawalFundScreen'),
  '/social-media': () =>
    named(require('../screens/dashboards/details/SocialMediaScreen'), 'SocialMediaScreen'),
  '/whatsappView': () =>
    named(require('../screens/dashboards/details/WhatsappScreen'), 'WhatsappScreen'),
  '/whatsapp-mid': () =>
    named(require('../screens/dashboards/details/WhatsappMidScreen'), 'WhatsappMidScreen'),
  '/aaa-fraud-bet-report': () =>
    named(
      require('../screens/dashboards/details/AAAFraudBetReportScreen'),
      'AAAFraudBetReportScreen',
    ),
  '/aaa-blacklisted-users': () =>
    named(
      require('../screens/dashboards/details/AAABlacklistedUsersScreen'),
      'AAABlacklistedUsersScreen',
    ),
  '/mobile-app': () =>
    named(require('../screens/dashboards/details/MobileAppScreen'), 'MobileAppScreen'),
  '/incoming-bot-call': () =>
    named(require('../screens/dashboards/details/IncomingBotCallScreen'), 'IncomingBotCallScreen'),
  '/sky-talk': () => named(require('../screens/dashboards/details/SkyTalkScreen'), 'SkyTalkScreen'),
  '/roles-responsibilities': () =>
    named(
      require('../screens/dashboards/details/RolesResponsibilitiesScreen'),
      'RolesResponsibilitiesScreen',
    ),
  '/fund-request-bonus-wallet': () =>
    named(
      require('../screens/dashboards/details/BonusWalletFundRequestScreen'),
      'BonusWalletFundRequestScreen',
    ),
  '/bonus-wallet': () =>
    named(
      require('../screens/dashboards/details/BonusWalletRequestsScreen'),
      'BonusWalletRequestsScreen',
    ),
  '/DepositApprovedReport': () =>
    named(
      require('../screens/dashboards/details/DepositApprovedReportScreen'),
      'DepositApprovedReportScreen',
    ),
  '/unique_deposit_pending': () =>
    named(
      require('../screens/dashboards/details/UniqueDepositPendingScreen'),
      'UniqueDepositPendingScreen',
    ),
  '/create-user': () => named(require('../screens/CreateUserScreen'), 'CreateUserScreen'),
  '/users': () => named(require('../screens/UsersScreen'), 'UsersScreen'),
  '/withdrawal': () => named(require('../screens/WithdrawalScreen'), 'WithdrawalScreen'),
  '/active-user-withdrawal': () =>
    named(
      require('../screens/dashboards/details/ActiveUserWithdrawalScreen'),
      'ActiveUserWithdrawalScreen',
    ),
};

const cache = new Map<string, AnyScreen>();

/** Resolve (and cache) a lazily loaded screen for a desktop path. */
export function resolveLazyScreen(path: string): AnyScreen | null {
  const hit = cache.get(path);
  if (hit) return hit;
  const factory = LAZY_IMPLEMENTED[path];
  if (!factory) return null;
  const Comp = factory();
  cache.set(path, Comp);
  return Comp;
}
