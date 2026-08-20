import { Suspense } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { TokenValidator } from '@/components/TokenValidator';
import { BlockedUserCheck } from '@/components/BlockedUserCheck';
import { ActivityTracker } from '@/components/ActivityTracker';
import type { AuthUser } from '@/types/gcalc';
import { PanelRouteFallback } from '@/app/PanelRouteFallback';
import {
  WelcomePage, HouseGamesPage, LeaderboardPage, LeaderboardCustomerCountPage, CallerResponsibilityPage, CallerDepositListPage, ActiveBotUsersPage, CallerDetailsPage, PlayerActivityPage, PlayerActivityDetailsPage, GameActivityPage, GameActivityDetailsPage, CallLogsPage, NewRegistersPage, StateWiseRegistrationPage, CoinRemovalPage, CoinRemovalDetailsPage, CustomerAllotmentPage, PointsReportPage, PointsReportDetailsPage, SheetDownloadReportPage, CheckersReportPage, AllUserLoginReportPage, SosBlockedUsersPage, LoginReportPage, SocialMediaPage, WhatsappMidPage, AAAFraudBetReportPage, AAABlacklistedUsersPage, UpiListsPage, UpiPaymentsPage, UtrProviderPage, InstantDepositProvidersPage, DepositProvidersPage, DepositConfigPage, WithdrawalProvidersPage, BotDataPage, BotPerformancePage, IncomingBotCallPage, SkyTalkPage, RolesResponsibilitiesPage, CasinoSwitchPage, TopGamesPage, DepositListPage, DepositListUserWisePage, FundsPage, FundsMidPage, MidGroupsPage, FundsPayinPage, WhatsappPage, CasinoTopupBalancePage, BonusWalletFundRequestPage, BonusWalletFundRequestTablePage, BonusWalletRequestsPage, DepositApprovedReportPage, UniqueDepositPendingPage, DepositPage, StateWiseDepositPage, WithdrawalPage, WithdrawalFundPage, WithdrawUserDataPage, FundRequestPage, PercentagePage, FeedbackPage, BannersPage, DumpUsersPage, UsersPage, UserReportPage, BonusEarningPage, UserExposurePage, BetConstructGamesPage, NonPerformingUserPage, TodaysActivePage, NewDepositsPage, PlayerRtpPage, PlayerRtpDetailsPage, CallerAllotmentPage, AllottedCustomersPage, CasinoGamesPage, UsersKycPage, KycListPage, MobileAppPage, DashboardPage, VipDashboardPage, CombinedDashboardPage, RiskDashboardPage, AnalyticsPage, MasterFlowPage, ProfitLossPage, FalconRateManagementPage, ExchangeRateManagementPage, ActiveUserDataPage, BetConstructGamesListPage, LiveMatchTotalLaxmiPage, LiveMatchTotalMasterPage, LiveMatchTotalBothPage, BothMasterAddPage, MasterDashboardPage, BalanceUsersPage, BonusBalanceUsersPage, RegisteredUsersAppPage
} from '@/app/panelLazyPages';

type Props = {
  user: AuthUser | null;
  logout: () => void;
  goPanel: (user: AuthUser) => void;
};

export function PanelRoutes({ user, logout, goPanel }: Props) {
  return (
    <MemoryRouter initialEntries={['/welcome']}>
      <TokenValidator />
      <BlockedUserCheck />
      <ActivityTracker userId={user?._id} />
      <Suspense fallback={<PanelRouteFallback />}>
              <Routes>
                <Route
                  element={<AppShell onLogout={logout} onUserChanged={goPanel} />}
                >
                  <Route path="/welcome" element={<WelcomePage user={user} />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/vip-dashboard" element={<VipDashboardPage />} />
                  <Route path="/combined-dashboard" element={<CombinedDashboardPage />} />
                  <Route path="/risk-dashboard" element={<RiskDashboardPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/master-flow" element={<MasterFlowPage />} />
                  <Route path="/profit-loss" element={<ProfitLossPage />} />
                  <Route
                    path="/falconRateManagement"
                    element={<FalconRateManagementPage />}
                  />
                  <Route
                    path="/exchangeRateManagement"
                    element={<ExchangeRateManagementPage />}
                  />
                  <Route
                    path="/activeUserData"
                    element={<ActiveUserDataPage />}
                  />
                  <Route
                    path="/betConstructGamesList"
                    element={<BetConstructGamesListPage />}
                  />
                  <Route
                    path="/liveMatchTotal"
                    element={<LiveMatchTotalLaxmiPage />}
                  />
                  <Route
                    path="/masterLiveMatchTotal"
                    element={<LiveMatchTotalMasterPage />}
                  />
                  <Route
                    path="/bothLiveMatchTotal"
                    element={<LiveMatchTotalBothPage />}
                  />
                  <Route
                    path="/bothMasterAddPage"
                    element={<BothMasterAddPage />}
                  />
                  <Route
                    path="/masterDashboard"
                    element={<MasterDashboardPage />}
                  />
                  {/* Aliases for older kebab paths */}
                  <Route
                    path="/falcon-rate-management"
                    element={<Navigate to="/falconRateManagement" replace />}
                  />
                  <Route
                    path="/exchange-rate-management"
                    element={<Navigate to="/exchangeRateManagement" replace />}
                  />
                  <Route path="/balance-f" element={<BalanceUsersPage />} />
                  <Route
                    path="/total-bonus-users-p"
                    element={<BonusBalanceUsersPage />}
                  />
                  <Route
                    path="/registered-users"
                    element={<RegisteredUsersAppPage />}
                  />
                  <Route path="/house-games" element={<HouseGamesPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route
                    path="/customer-count"
                    element={<LeaderboardCustomerCountPage />}
                  />
                  <Route
                    path="/caller-responsibility"
                    element={<CallerResponsibilityPage />}
                  />
                  <Route
                    path="/caller-responsibility/deposit-list"
                    element={<CallerDepositListPage />}
                  />
                  <Route
                    path="/caller-responsibility/bot-users"
                    element={<ActiveBotUsersPage />}
                  />
                  <Route
                    path="/caller-responsibility/details"
                    element={<CallerDetailsPage />}
                  />
                  <Route path="/player-activity" element={<PlayerActivityPage />} />
                  <Route
                    path="/player-activity/details"
                    element={<PlayerActivityDetailsPage />}
                  />
                  <Route path="/game-activity" element={<GameActivityPage />} />
                  <Route
                    path="/game-activity/details"
                    element={<GameActivityDetailsPage />}
                  />
                  <Route path="/call-logs" element={<CallLogsPage />} />
                  <Route path="/new-registers" element={<NewRegistersPage />} />
                  <Route
                    path="/register-user-report"
                    element={<StateWiseRegistrationPage />}
                  />
                  <Route path="/login-report" element={<LoginReportPage />} />
                  <Route
                    path="/all-user-login-report"
                    element={<AllUserLoginReportPage />}
                  />
                  <Route
                    path="/sos-blocked-users"
                    element={<SosBlockedUsersPage />}
                  />
                  <Route path="/checkers-report" element={<CheckersReportPage />} />
                  <Route
                    path="/downlaodReport"
                    element={<SheetDownloadReportPage />}
                  />
                  <Route path="/coins-report" element={<PointsReportPage />} />
                  <Route
                    path="/coin-reports/report"
                    element={<PointsReportDetailsPage />}
                  />
                  <Route path="/coins-removal" element={<CoinRemovalPage />} />
                  <Route
                    path="/coins-removal/details"
                    element={<CoinRemovalDetailsPage />}
                  />
                  <Route
                    path="/customer-allotment"
                    element={<CustomerAllotmentPage />}
                  />
                  <Route
                    path="/customer-allotted"
                    element={<AllottedCustomersPage />}
                  />
                  <Route
                    path="/non_performing_user"
                    element={<NonPerformingUserPage />}
                  />
                  <Route path="/todays-active" element={<TodaysActivePage />} />
                  <Route path="/feedback" element={<FeedbackPage />} />
                  <Route
                    path="/betConstruct-lists"
                    element={<BetConstructGamesPage />}
                  />
                  <Route path="/casino-lists" element={<CasinoGamesPage />} />
                  <Route path="/users-kyc" element={<UsersKycPage />} />
                  <Route path="/kycList" element={<KycListPage />} />
                  <Route path="/banners" element={<BannersPage />} />
                  <Route path="/upi-lists" element={<UpiListsPage />} />
                  <Route path="/all-upi-payments" element={<UpiPaymentsPage />} />
                  <Route path="/utr-provider" element={<UtrProviderPage />} />
                  <Route
                    path="/instant-provider"
                    element={<InstantDepositProvidersPage />}
                  />
                  <Route path="/pay-g-mid" element={<DepositProvidersPage />} />
                  <Route path="/deposit-config" element={<DepositConfigPage />} />
                  <Route
                    path="/payout-accounts"
                    element={<WithdrawalProvidersPage />}
                  />
                  <Route path="/botData" element={<BotDataPage />} />
                  <Route path="/botPerformance" element={<BotPerformancePage />} />
                  <Route path="/incoming-bot-call" element={<IncomingBotCallPage />} />
                  <Route path="/sky-talk" element={<SkyTalkPage />} />
                  <Route
                    path="/roles-responsibilities"
                    element={<RolesResponsibilitiesPage />}
                  />
                  <Route
                    path="/dynamic-casino-switching"
                    element={<CasinoSwitchPage />}
                  />
                  <Route path="/top-games" element={<TopGamesPage />} />
                  <Route
                    path="/casino-topup-balance"
                    element={<CasinoTopupBalancePage />}
                  />
                  <Route path="/depositList" element={<DepositListPage />} />
                  <Route
                    path="/depositList/user-wise"
                    element={<DepositListUserWisePage />}
                  />
                  <Route path="/funds" element={<FundsPage />} />
                  <Route path="/funds/mid-groups" element={<MidGroupsPage />} />
                  <Route path="/funds/mid" element={<FundsMidPage />} />
                  <Route path="/funds/payin" element={<FundsPayinPage />} />
                  <Route
                    path="/funds/mid/payingAccount"
                    element={<FundsPayinPage />}
                  />
                  <Route path="/whatsappView" element={<WhatsappPage />} />
                  <Route
                    path="/fund-request-bonus-wallet"
                    element={<BonusWalletFundRequestPage />}
                  />
                  <Route
                    path="/fund-request-bonus-wallet-table"
                    element={<BonusWalletFundRequestTablePage />}
                  />
                  <Route path="/bonus-wallet" element={<BonusWalletRequestsPage />} />
                  <Route
                    path="/DepositApprovedReport"
                    element={<DepositApprovedReportPage />}
                  />
                  <Route
                    path="/unique_deposit_pending"
                    element={<UniqueDepositPendingPage />}
                  />
                  <Route path="/deposit" element={<DepositPage />} />
                  <Route
                    path="/state-wise-deposit"
                    element={<StateWiseDepositPage />}
                  />
                  <Route path="/withdrawal" element={<WithdrawalPage />} />
                  <Route path="/withdrawal-fund" element={<WithdrawalFundPage />} />
                  <Route path="/withdraw-user-data" element={<WithdrawUserDataPage />} />
                  <Route path="/fund-request" element={<FundRequestPage />} />
                  <Route path="/playerRtp" element={<PlayerRtpPage />} />
                  <Route
                    path="/playerRtp/details"
                    element={<PlayerRtpDetailsPage />}
                  />
                  <Route path="/users" element={<UsersPage />} />
                  <Route
                    path="/users/report/:userId/:userName"
                    element={<UserReportPage />}
                  />
                  <Route
                    path="/bonus-wallet-referral-earning"
                    element={<BonusEarningPage />}
                  />
                  <Route path="/user_exposure" element={<UserExposurePage />} />
                  <Route path="/dumpUsers" element={<DumpUsersPage />} />
                  <Route
                    path="/callerAllotment"
                    element={<CallerAllotmentPage />}
                  />
                  <Route path="/percentage" element={<PercentagePage />} />
                  <Route path="/newdeposits" element={<NewDepositsPage />} />
                  <Route path="/social-media" element={<SocialMediaPage />} />
                  <Route path="/whatsapp-mid" element={<WhatsappMidPage />} />
                  <Route
                    path="/aaa-fraud-bet-report"
                    element={<AAAFraudBetReportPage />}
                  />
                  <Route
                    path="/aaa-blacklisted-users"
                    element={<AAABlacklistedUsersPage />}
                  />
                  <Route path="/mobile-app" element={<MobileAppPage />} />
                  <Route path="*" element={<Navigate to="/welcome" replace />} />
                </Route>
              </Routes>

      </Suspense>
    </MemoryRouter>
  );
}
