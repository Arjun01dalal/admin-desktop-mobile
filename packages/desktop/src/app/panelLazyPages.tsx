import { lazyNamed } from '@/utils/lazyNamed';

const WelcomePage = lazyNamed(() => import('@/screens/panel/WelcomePage'), 'WelcomePage');
const HouseGamesPage = lazyNamed(() => import('@/screens/panel/HouseGamesPage'), 'HouseGamesPage');
const LeaderboardPage = lazyNamed(
  () => import('@/screens/panel/LeaderboardPage'),
  'LeaderboardPage',
);
const LeaderboardCustomerCountPage = lazyNamed(
  () => import('@/screens/panel/LeaderboardCustomerCountPage'),
  'LeaderboardCustomerCountPage',
);
const CallerResponsibilityPage = lazyNamed(
  () => import('@/screens/panel/CallerResponsibilityPage'),
  'CallerResponsibilityPage',
);
const CallerDepositListPage = lazyNamed(
  () => import('@/screens/panel/callerResponsibility/CallerDepositListPage'),
  'CallerDepositListPage',
);
const ActiveBotUsersPage = lazyNamed(
  () => import('@/screens/panel/callerResponsibility/ActiveBotUsersPage'),
  'ActiveBotUsersPage',
);
const CallerDetailsPage = lazyNamed(
  () => import('@/screens/panel/callerResponsibility/CallerDetailsPage'),
  'CallerDetailsPage',
);
const PlayerActivityPage = lazyNamed(
  () => import('@/screens/panel/PlayerActivityPage'),
  'PlayerActivityPage',
);
const PlayerActivityDetailsPage = lazyNamed(
  () => import('@/screens/panel/PlayerActivityDetailsPage'),
  'PlayerActivityDetailsPage',
);
const GameActivityPage = lazyNamed(
  () => import('@/screens/panel/GameActivityPage'),
  'GameActivityPage',
);
const GameActivityDetailsPage = lazyNamed(
  () => import('@/screens/panel/GameActivityDetailsPage'),
  'GameActivityDetailsPage',
);
const GameUserStatsPage = lazyNamed(
  () => import('@/screens/panel/GameUserStatsPage'),
  'GameUserStatsPage',
);
const CallLogsPage = lazyNamed(() => import('@/screens/panel/CallLogsPage'), 'CallLogsPage');
const DialerPushDataPage = lazyNamed(
  () => import('@/screens/panel/DialerPushDataPage'),
  'DialerPushDataPage',
);
const NewRegistersPage = lazyNamed(
  () => import('@/screens/panel/NewRegistersPage'),
  'NewRegistersPage',
);
const StateWiseRegistrationPage = lazyNamed(
  () => import('@/screens/panel/StateWiseRegistrationPage'),
  'StateWiseRegistrationPage',
);
const CoinRemovalPage = lazyNamed(
  () => import('@/screens/panel/CoinRemovalPage'),
  'CoinRemovalPage',
);
const CoinRemovalDetailsPage = lazyNamed(
  () => import('@/screens/panel/coinRemoval/CoinRemovalDetailsPage'),
  'CoinRemovalDetailsPage',
);
const CustomerAllotmentPage = lazyNamed(
  () => import('@/screens/panel/CustomerAllotmentPage'),
  'CustomerAllotmentPage',
);
const PointsReportPage = lazyNamed(
  () => import('@/screens/panel/PointsReportPage'),
  'PointsReportPage',
);
const PointsReportDetailsPage = lazyNamed(
  () => import('@/screens/panel/pointsReport/PointsReportDetailsPage'),
  'PointsReportDetailsPage',
);
const SheetDownloadReportPage = lazyNamed(
  () => import('@/screens/panel/SheetDownloadReportPage'),
  'SheetDownloadReportPage',
);
const CheckersReportPage = lazyNamed(
  () => import('@/screens/panel/CheckersReportPage'),
  'CheckersReportPage',
);
const AllUserLoginReportPage = lazyNamed(
  () => import('@/screens/panel/AllUserLoginReportPage'),
  'AllUserLoginReportPage',
);
const SosBlockedUsersPage = lazyNamed(
  () => import('@/screens/panel/SosBlockedUsersPage'),
  'SosBlockedUsersPage',
);
const LoginReportPage = lazyNamed(
  () => import('@/screens/panel/LoginReportPage'),
  'LoginReportPage',
);
const SocialMediaPage = lazyNamed(
  () => import('@/screens/panel/SocialMediaPage'),
  'SocialMediaPage',
);
const WhatsappMidPage = lazyNamed(
  () => import('@/screens/panel/WhatsappMidPage'),
  'WhatsappMidPage',
);
const AAAFraudBetReportPage = lazyNamed(
  () => import('@/screens/panel/AAAFraudBetReportPage'),
  'AAAFraudBetReportPage',
);
const AAABlacklistedUsersPage = lazyNamed(
  () => import('@/screens/panel/AAABlacklistedUsersPage'),
  'AAABlacklistedUsersPage',
);
const UpiListsPage = lazyNamed(() => import('@/screens/panel/UpiListsPage'), 'UpiListsPage');
const UpiPaymentsPage = lazyNamed(
  () => import('@/screens/panel/UpiPaymentsPage'),
  'UpiPaymentsPage',
);
const UtrProviderPage = lazyNamed(
  () => import('@/screens/panel/UtrProviderPage'),
  'UtrProviderPage',
);
const InstantDepositProvidersPage = lazyNamed(
  () => import('@/screens/panel/InstantDepositProvidersPage'),
  'InstantDepositProvidersPage',
);
const DepositProvidersPage = lazyNamed(
  () => import('@/screens/panel/DepositProvidersPage'),
  'DepositProvidersPage',
);
const DepositConfigPage = lazyNamed(
  () => import('@/screens/panel/DepositConfigPage'),
  'DepositConfigPage',
);
const WithdrawalProvidersPage = lazyNamed(
  () => import('@/screens/panel/WithdrawalProvidersPage'),
  'WithdrawalProvidersPage',
);
const BotDataPage = lazyNamed(() => import('@/screens/panel/BotDataPage'), 'BotDataPage');
const BotPerformancePage = lazyNamed(
  () => import('@/screens/panel/BotPerformancePage'),
  'BotPerformancePage',
);
const IncomingBotCallPage = lazyNamed(
  () => import('@/screens/panel/IncomingBotCallPage'),
  'IncomingBotCallPage',
);
const SkyTalkPage = lazyNamed(() => import('@/screens/panel/SkyTalkPage'), 'SkyTalkPage');
const RolesResponsibilitiesPage = lazyNamed(
  () => import('@/screens/panel/RolesResponsibilitiesPage'),
  'RolesResponsibilitiesPage',
);
const CasinoSwitchPage = lazyNamed(
  () => import('@/screens/panel/CasinoSwitchPage'),
  'CasinoSwitchPage',
);
const TopGamesPage = lazyNamed(() => import('@/screens/panel/TopGamesPage'), 'TopGamesPage');
const DepositListPage = lazyNamed(
  () => import('@/screens/panel/DepositListPage'),
  'DepositListPage',
);
const DepositListUserWisePage = lazyNamed(
  () => import('@/screens/panel/DepositListUserWisePage'),
  'DepositListUserWisePage',
);
const FundsPage = lazyNamed(() => import('@/screens/panel/FundsPage'), 'FundsPage');
const FundsMidPage = lazyNamed(() => import('@/screens/panel/FundsMidPage'), 'FundsMidPage');
const MidGroupsPage = lazyNamed(() => import('@/screens/panel/MidGroupsPage'), 'MidGroupsPage');
const MidLimitsPage = lazyNamed(() => import('@/screens/panel/MidLimitsPage'), 'MidLimitsPage');
const FundsPayinPage = lazyNamed(() => import('@/screens/panel/FundsPayinPage'), 'FundsPayinPage');
const WhatsappPage = lazyNamed(() => import('@/screens/panel/WhatsappPage'), 'WhatsappPage');
const CasinoTopupBalancePage = lazyNamed(
  () => import('@/screens/panel/CasinoTopupBalancePage'),
  'CasinoTopupBalancePage',
);
const BonusWalletFundRequestPage = lazyNamed(
  () => import('@/screens/panel/BonusWalletFundRequestPage'),
  'BonusWalletFundRequestPage',
);
const BonusWalletFundRequestTablePage = lazyNamed(
  () => import('@/screens/panel/BonusWalletFundRequestTablePage'),
  'BonusWalletFundRequestTablePage',
);
const BonusWalletRequestsPage = lazyNamed(
  () => import('@/screens/panel/BonusWalletRequestsPage'),
  'BonusWalletRequestsPage',
);
const DepositApprovedReportPage = lazyNamed(
  () => import('@/screens/panel/DepositApprovedReportPage'),
  'DepositApprovedReportPage',
);
const UniqueDepositPendingPage = lazyNamed(
  () => import('@/screens/panel/UniqueDepositPendingPage'),
  'UniqueDepositPendingPage',
);
const DepositPage = lazyNamed(() => import('@/screens/panel/DepositPage'), 'DepositPage');
const StateWiseDepositPage = lazyNamed(
  () => import('@/screens/panel/StateWiseDepositPage'),
  'StateWiseDepositPage',
);
const WithdrawalPage = lazyNamed(() => import('@/screens/panel/WithdrawalPage'), 'WithdrawalPage');
const WithdrawalFundPage = lazyNamed(
  () => import('@/screens/panel/withdrawalFund'),
  'WithdrawalFundPage',
);
const WithdrawUserDataPage = lazyNamed(
  () => import('@/screens/panel/withdrawalFund'),
  'WithdrawUserDataPage',
);
const FundRequestPage = lazyNamed(
  () => import('@/screens/panel/FundRequestPage'),
  'FundRequestPage',
);
const FundRequestCoinTablePage = lazyNamed(
  () => import('@/screens/panel/FundRequestCoinTablePage'),
  'FundRequestCoinTablePage',
);
const PercentagePage = lazyNamed(() => import('@/screens/panel/PercentagePage'), 'PercentagePage');
const FeedbackPage = lazyNamed(() => import('@/screens/panel/FeedbackPage'), 'FeedbackPage');
const BannersPage = lazyNamed(() => import('@/screens/panel/BannersPage'), 'BannersPage');
const DumpUsersPage = lazyNamed(() => import('@/screens/panel/DumpUsersPage'), 'DumpUsersPage');
const UsersPage = lazyNamed(() => import('@/screens/panel/UsersPage'), 'UsersPage');
const UserReportPage = lazyNamed(
  () => import('@/screens/panel/userReport/UserReportPage'),
  'UserReportPage',
);
const BonusEarningPage = lazyNamed(
  () => import('@/screens/panel/userReport/BonusEarningPage'),
  'BonusEarningPage',
);
const UserExposurePage = lazyNamed(
  () => import('@/screens/panel/userReport/UserExposurePage'),
  'UserExposurePage',
);
const BetConstructGamesPage = lazyNamed(
  () => import('@/screens/panel/BetConstructGamesPage'),
  'BetConstructGamesPage',
);
const NonPerformingUserPage = lazyNamed(
  () => import('@/screens/panel/NonPerformingUserPage'),
  'NonPerformingUserPage',
);
const TodaysActivePage = lazyNamed(
  () => import('@/screens/panel/TodaysActivePage'),
  'TodaysActivePage',
);
const NewDepositsPage = lazyNamed(
  () => import('@/screens/panel/NewDepositsPage'),
  'NewDepositsPage',
);
const PlayerRtpPage = lazyNamed(() => import('@/screens/panel/PlayerRtpPage'), 'PlayerRtpPage');
const PlayerRtpDetailsPage = lazyNamed(
  () => import('@/screens/panel/playerRtp/PlayerRtpDetailsPage'),
  'PlayerRtpDetailsPage',
);
const CallerAllotmentPage = lazyNamed(
  () => import('@/screens/panel/CallerAllotmentPage'),
  'CallerAllotmentPage',
);
const AllottedCustomersPage = lazyNamed(
  () => import('@/screens/panel/customerAllotment/AllottedCustomersPage'),
  'AllottedCustomersPage',
);
const CasinoGamesPage = lazyNamed(
  () => import('@/screens/panel/CasinoGamesPage'),
  'CasinoGamesPage',
);
const UsersKycPage = lazyNamed(() => import('@/screens/panel/UsersKycPage'), 'UsersKycPage');
const KycListPage = lazyNamed(() => import('@/screens/panel/KycListPage'), 'KycListPage');
const MobileAppPage = lazyNamed(() => import('@/screens/panel/MobileAppPage'), 'MobileAppPage');

const DashboardPage = lazyNamed(() => import('@/screens/panel/dashboards/pages'), 'DashboardPage');
const VipDashboardPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'VipDashboardPage',
);
const CombinedDashboardPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'CombinedDashboardPage',
);
const RiskDashboardPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'RiskDashboardPage',
);
const AnalyticsPage = lazyNamed(() => import('@/screens/panel/dashboards/pages'), 'AnalyticsPage');
const MasterFlowPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'MasterFlowPage',
);
const ProfitLossPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'ProfitLossPage',
);
const FalconRateManagementPage = lazyNamed(
  () => import('@/screens/panel/dashboards/FalconRateManagementPage'),
  'FalconRateManagementPage',
);
const ExchangeRateManagementPage = lazyNamed(
  () => import('@/screens/panel/dashboards/ExchangeRateManagementPage'),
  'ExchangeRateManagementPage',
);
const ActiveUserDataPage = lazyNamed(
  () => import('@/screens/panel/dashboards/ActiveUserDataPage'),
  'ActiveUserDataPage',
);
const BetConstructGamesListPage = lazyNamed(
  () => import('@/screens/panel/dashboards/BetConstructGamesListPage'),
  'BetConstructGamesListPage',
);
const LiveMatchTotalLaxmiPage = lazyNamed(
  () => import('@/screens/panel/dashboards/LiveMatchTotalPage'),
  'LiveMatchTotalLaxmiPage',
);
const LiveMatchTotalMasterPage = lazyNamed(
  () => import('@/screens/panel/dashboards/LiveMatchTotalPage'),
  'LiveMatchTotalMasterPage',
);
const LiveMatchTotalBothPage = lazyNamed(
  () => import('@/screens/panel/dashboards/LiveMatchTotalPage'),
  'LiveMatchTotalBothPage',
);
const BothMasterAddPage = lazyNamed(
  () => import('@/screens/panel/dashboards/BothMasterAddPage'),
  'BothMasterAddPage',
);
const MasterDashboardPage = lazyNamed(
  () => import('@/screens/panel/dashboards/MasterDashboardPage'),
  'MasterDashboardPage',
);
const BalanceUsersPage = lazyNamed(
  () => import('@/screens/panel/dashboards/DashboardUsersListPage'),
  'BalanceUsersPage',
);
const BonusBalanceUsersPage = lazyNamed(
  () => import('@/screens/panel/dashboards/DashboardUsersListPage'),
  'BonusBalanceUsersPage',
);
const RegisteredUsersAppPage = lazyNamed(
  () => import('@/screens/panel/dashboards/DashboardUsersListPage'),
  'RegisteredUsersAppPage',
);

export {
  WelcomePage,
  HouseGamesPage,
  LeaderboardPage,
  LeaderboardCustomerCountPage,
  CallerResponsibilityPage,
  CallerDepositListPage,
  ActiveBotUsersPage,
  CallerDetailsPage,
  PlayerActivityPage,
  PlayerActivityDetailsPage,
  GameActivityPage,
  GameActivityDetailsPage,
  GameUserStatsPage,
  CallLogsPage,
  DialerPushDataPage,
  NewRegistersPage,
  StateWiseRegistrationPage,
  CoinRemovalPage,
  CoinRemovalDetailsPage,
  CustomerAllotmentPage,
  PointsReportPage,
  PointsReportDetailsPage,
  SheetDownloadReportPage,
  CheckersReportPage,
  AllUserLoginReportPage,
  SosBlockedUsersPage,
  LoginReportPage,
  SocialMediaPage,
  WhatsappMidPage,
  AAAFraudBetReportPage,
  AAABlacklistedUsersPage,
  UpiListsPage,
  UpiPaymentsPage,
  UtrProviderPage,
  InstantDepositProvidersPage,
  DepositProvidersPage,
  DepositConfigPage,
  WithdrawalProvidersPage,
  BotDataPage,
  BotPerformancePage,
  IncomingBotCallPage,
  SkyTalkPage,
  RolesResponsibilitiesPage,
  CasinoSwitchPage,
  TopGamesPage,
  DepositListPage,
  DepositListUserWisePage,
  FundsPage,
  FundsMidPage,
  MidGroupsPage,
  MidLimitsPage,
  FundsPayinPage,
  WhatsappPage,
  CasinoTopupBalancePage,
  BonusWalletFundRequestPage,
  BonusWalletFundRequestTablePage,
  BonusWalletRequestsPage,
  DepositApprovedReportPage,
  UniqueDepositPendingPage,
  DepositPage,
  StateWiseDepositPage,
  WithdrawalPage,
  WithdrawalFundPage,
  WithdrawUserDataPage,
  FundRequestPage,
  FundRequestCoinTablePage,
  PercentagePage,
  FeedbackPage,
  BannersPage,
  DumpUsersPage,
  UsersPage,
  UserReportPage,
  BonusEarningPage,
  UserExposurePage,
  BetConstructGamesPage,
  NonPerformingUserPage,
  TodaysActivePage,
  NewDepositsPage,
  PlayerRtpPage,
  PlayerRtpDetailsPage,
  CallerAllotmentPage,
  AllottedCustomersPage,
  CasinoGamesPage,
  UsersKycPage,
  KycListPage,
  MobileAppPage,
  DashboardPage,
  VipDashboardPage,
  CombinedDashboardPage,
  RiskDashboardPage,
  AnalyticsPage,
  MasterFlowPage,
  ProfitLossPage,
  FalconRateManagementPage,
  ExchangeRateManagementPage,
  ActiveUserDataPage,
  BetConstructGamesListPage,
  LiveMatchTotalLaxmiPage,
  LiveMatchTotalMasterPage,
  LiveMatchTotalBothPage,
  BothMasterAddPage,
  MasterDashboardPage,
  BalanceUsersPage,
  BonusBalanceUsersPage,
  RegisteredUsersAppPage,
};
