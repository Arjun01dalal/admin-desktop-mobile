/** Path → dynamic import (same chunks as lazy routes). Hover/idle warm. */
const prefetched = new Set<string>();

type Loader = () => Promise<unknown>;

const LOADERS: Record<string, Loader> = {
  '/welcome': () => import('@/screens/panel/WelcomePage'),
  '/dashboard': () => import('@/screens/panel/dashboards/pages'),
  '/vip-dashboard': () => import('@/screens/panel/dashboards/pages'),
  '/combined-dashboard': () => import('@/screens/panel/dashboards/pages'),
  '/risk-dashboard': () => import('@/screens/panel/dashboards/pages'),
  '/analytics': () => import('@/screens/panel/dashboards/pages'),
  '/master-flow': () => import('@/screens/panel/dashboards/pages'),
  '/profit-loss': () => import('@/screens/panel/dashboards/pages'),
  '/falconRateManagement': () => import('@/screens/panel/dashboards/FalconRateManagementPage'),
  '/exchangeRateManagement': () => import('@/screens/panel/dashboards/ExchangeRateManagementPage'),
  '/activeUserData': () => import('@/screens/panel/dashboards/ActiveUserDataPage'),
  '/betConstructGamesList': () => import('@/screens/panel/dashboards/BetConstructGamesListPage'),
  '/liveMatchTotal': () => import('@/screens/panel/dashboards/LiveMatchTotalPage'),
  '/masterLiveMatchTotal': () => import('@/screens/panel/dashboards/LiveMatchTotalPage'),
  '/bothLiveMatchTotal': () => import('@/screens/panel/dashboards/LiveMatchTotalPage'),
  '/bothMasterAddPage': () => import('@/screens/panel/dashboards/BothMasterAddPage'),
  '/masterDashboard': () => import('@/screens/panel/dashboards/MasterDashboardPage'),
  '/balance-f': () => import('@/screens/panel/dashboards/DashboardUsersListPage'),
  '/total-bonus-users-p': () => import('@/screens/panel/dashboards/DashboardUsersListPage'),
  '/registered-users': () => import('@/screens/panel/dashboards/DashboardUsersListPage'),
  '/house-games': () => import('@/screens/panel/HouseGamesPage'),
  '/leaderboard': () => import('@/screens/panel/LeaderboardPage'),
  '/customer-count': () => import('@/screens/panel/LeaderboardCustomerCountPage'),
  '/caller-responsibility': () => import('@/screens/panel/CallerResponsibilityPage'),
  '/caller-responsibility/deposit-list': () => import('@/screens/panel/callerResponsibility/CallerDepositListPage'),
  '/caller-responsibility/bot-users': () => import('@/screens/panel/callerResponsibility/ActiveBotUsersPage'),
  '/caller-responsibility/details': () => import('@/screens/panel/callerResponsibility/CallerDetailsPage'),
  '/player-activity': () => import('@/screens/panel/PlayerActivityPage'),
  '/player-activity/details': () => import('@/screens/panel/PlayerActivityDetailsPage'),
  '/game-activity': () => import('@/screens/panel/GameActivityPage'),
  '/game-activity/details': () => import('@/screens/panel/GameActivityDetailsPage'),
  '/game-activity/user-stats': () => import('@/screens/panel/GameUserStatsPage'),
  '/call-logs': () => import('@/screens/panel/CallLogsPage'),
  '/dialer-push-data': () => import('@/screens/panel/DialerPushDataPage'),
  '/new-registers': () => import('@/screens/panel/NewRegistersPage'),
  '/register-user-report': () => import('@/screens/panel/StateWiseRegistrationPage'),
  '/login-report': () => import('@/screens/panel/LoginReportPage'),
  '/all-user-login-report': () => import('@/screens/panel/AllUserLoginReportPage'),
  '/sos-blocked-users': () => import('@/screens/panel/SosBlockedUsersPage'),
  '/checkers-report': () => import('@/screens/panel/CheckersReportPage'),
  '/downlaodReport': () => import('@/screens/panel/SheetDownloadReportPage'),
  '/coins-report': () => import('@/screens/panel/PointsReportPage'),
  '/coin-reports/report': () => import('@/screens/panel/pointsReport/PointsReportDetailsPage'),
  '/coins-removal': () => import('@/screens/panel/CoinRemovalPage'),
  '/coins-removal/details': () => import('@/screens/panel/coinRemoval/CoinRemovalDetailsPage'),
  '/customer-allotment': () => import('@/screens/panel/CustomerAllotmentPage'),
  '/customer-allotted': () => import('@/screens/panel/customerAllotment/AllottedCustomersPage'),
  '/non_performing_user': () => import('@/screens/panel/NonPerformingUserPage'),
  '/todays-active': () => import('@/screens/panel/TodaysActivePage'),
  '/feedback': () => import('@/screens/panel/FeedbackPage'),
  '/betConstruct-lists': () => import('@/screens/panel/BetConstructGamesPage'),
  '/casino-lists': () => import('@/screens/panel/CasinoGamesPage'),
  '/users-kyc': () => import('@/screens/panel/UsersKycPage'),
  '/kycList': () => import('@/screens/panel/KycListPage'),
  '/banners': () => import('@/screens/panel/BannersPage'),
  '/upi-lists': () => import('@/screens/panel/UpiListsPage'),
  '/all-upi-payments': () => import('@/screens/panel/UpiPaymentsPage'),
  '/utr-provider': () => import('@/screens/panel/UtrProviderPage'),
  '/instant-provider': () => import('@/screens/panel/InstantDepositProvidersPage'),
  '/pay-g-mid': () => import('@/screens/panel/DepositProvidersPage'),
  '/mid-limits': () => import('@/screens/panel/MidLimitsPage'),
  '/deposit-config': () => import('@/screens/panel/DepositConfigPage'),
  '/payout-accounts': () => import('@/screens/panel/WithdrawalProvidersPage'),
  '/botData': () => import('@/screens/panel/BotDataPage'),
  '/botPerformance': () => import('@/screens/panel/BotPerformancePage'),
  '/incoming-bot-call': () => import('@/screens/panel/IncomingBotCallPage'),
  '/sky-talk': () => import('@/screens/panel/SkyTalkPage'),
  '/roles-responsibilities': () => import('@/screens/panel/RolesResponsibilitiesPage'),
  '/dynamic-casino-switching': () => import('@/screens/panel/CasinoSwitchPage'),
  '/top-games': () => import('@/screens/panel/TopGamesPage'),
  '/casino-topup-balance': () => import('@/screens/panel/CasinoTopupBalancePage'),
  '/depositList': () => import('@/screens/panel/DepositListPage'),
  '/depositList/user-wise': () => import('@/screens/panel/DepositListUserWisePage'),
  '/funds': () => import('@/screens/panel/FundsPage'),
  '/funds/mid-groups': () => import('@/screens/panel/MidGroupsPage'),
  '/funds/mid': () => import('@/screens/panel/FundsMidPage'),
  '/funds/payin': () => import('@/screens/panel/FundsPayinPage'),
  '/funds/mid/payingAccount': () => import('@/screens/panel/FundsPayinPage'),
  '/whatsappView': () => import('@/screens/panel/WhatsappPage'),
  '/fund-request-bonus-wallet': () => import('@/screens/panel/BonusWalletFundRequestPage'),
  '/fund-request-bonus-wallet-table': () => import('@/screens/panel/BonusWalletFundRequestTablePage'),
  '/bonus-wallet': () => import('@/screens/panel/BonusWalletRequestsPage'),
  '/DepositApprovedReport': () => import('@/screens/panel/DepositApprovedReportPage'),
  '/unique_deposit_pending': () => import('@/screens/panel/UniqueDepositPendingPage'),
  '/deposit': () => import('@/screens/panel/DepositPage'),
  '/state-wise-deposit': () => import('@/screens/panel/StateWiseDepositPage'),
  '/withdrawal': () => import('@/screens/panel/WithdrawalPage'),
  '/withdrawal-fund': () => import('@/screens/panel/withdrawalFund'),
  '/withdraw-user-data': () => import('@/screens/panel/withdrawalFund'),
  '/fund-request': () => import('@/screens/panel/FundRequestPage'),
  '/playerRtp': () => import('@/screens/panel/PlayerRtpPage'),
  '/playerRtp/details': () => import('@/screens/panel/playerRtp/PlayerRtpDetailsPage'),
  '/users': () => import('@/screens/panel/UsersPage'),
  '/users/report/:userId/:userName': () => import('@/screens/panel/userReport/UserReportPage'),
  '/bonus-wallet-referral-earning': () => import('@/screens/panel/userReport/BonusEarningPage'),
  '/user_exposure': () => import('@/screens/panel/userReport/UserExposurePage'),
  '/dumpUsers': () => import('@/screens/panel/DumpUsersPage'),
  '/callerAllotment': () => import('@/screens/panel/CallerAllotmentPage'),
  '/percentage': () => import('@/screens/panel/PercentagePage'),
  '/newdeposits': () => import('@/screens/panel/NewDepositsPage'),
  '/social-media': () => import('@/screens/panel/SocialMediaPage'),
  '/whatsapp-mid': () => import('@/screens/panel/WhatsappMidPage'),
  '/aaa-fraud-bet-report': () => import('@/screens/panel/AAAFraudBetReportPage'),
  '/aaa-blacklisted-users': () => import('@/screens/panel/AAABlacklistedUsersPage'),
  '/mobile-app': () => import('@/screens/panel/MobileAppPage'),
};

export function prefetchPanelRoute(path: string): void {
  const base = String(path || '').split('?')[0];
  const loader = LOADERS[base];
  if (!loader || prefetched.has(base)) return;
  prefetched.add(base);
  void loader().catch(() => {
    prefetched.delete(base);
  });
}

/** Warm a few sidebar routes when the panel is idle. */
export function prefetchPanelRoutesIdle(paths: string[]): void {
  const run = () => {
    for (const p of paths.slice(0, 8)) prefetchPanelRoute(p);
  };
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => run(), { timeout: 2500 });
  } else {
    globalThis.setTimeout(run, 600);
  }
}
