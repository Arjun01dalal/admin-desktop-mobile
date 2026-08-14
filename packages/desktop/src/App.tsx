import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  ColorModeProvider,
  useColorMode,
} from '@/context/ColorModeContext';
import { LocationProvider } from '@/controllers/LocationProvider';
import { AstroSite } from '@/screens/AstroSite';
import { Login } from '@/screens/Login';
import { AppShell } from '@/layout/AppShell';
import { UpdateToast } from '@/components/UpdateToast';
import { TokenValidator } from '@/components/TokenValidator';
import { BlockedUserCheck } from '@/components/BlockedUserCheck';
import {
  clearAuthStorage,
  isJwtExpired,
  resetSessionExpiredGuard,
  setSessionExpiredHandler,
} from '@/utils/session';
import { getAuthToken, initAuthToken } from '@/utils/authToken';
import type { AppScreen, AuthUser } from '@/types/gcalc';

/** Named-export pages → React.lazy default components. */
function lazyNamed<M extends Record<string, unknown>>(
  loader: () => Promise<M>,
  exportName: keyof M,
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] as ComponentType<Record<string, unknown>> };
  });
}

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
const CallLogsPage = lazyNamed(() => import('@/screens/panel/CallLogsPage'), 'CallLogsPage');
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
const RolesResponsibilitiesPage = lazyNamed(
  () => import('@/screens/panel/RolesResponsibilitiesPage'),
  'RolesResponsibilitiesPage',
);
const CasinoSwitchPage = lazyNamed(
  () => import('@/screens/panel/CasinoSwitchPage'),
  'CasinoSwitchPage',
);
const TopGamesPage = lazyNamed(
  () => import('@/screens/panel/TopGamesPage'),
  'TopGamesPage',
);
const DepositListPage = lazyNamed(
  () => import('@/screens/panel/DepositListPage'),
  'DepositListPage',
);
const DepositListUserWisePage = lazyNamed(
  () => import('@/screens/panel/DepositListUserWisePage'),
  'DepositListUserWisePage',
);
const FundsPage = lazyNamed(
  () => import('@/screens/panel/FundsPage'),
  'FundsPage',
);
const FundsMidPage = lazyNamed(
  () => import('@/screens/panel/FundsMidPage'),
  'FundsMidPage',
);
const MidGroupsPage = lazyNamed(
  () => import('@/screens/panel/MidGroupsPage'),
  'MidGroupsPage',
);
const FundsPayinPage = lazyNamed(
  () => import('@/screens/panel/FundsPayinPage'),
  'FundsPayinPage',
);
const WhatsappPage = lazyNamed(
  () => import('@/screens/panel/WhatsappPage'),
  'WhatsappPage',
);
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
const DepositPage = lazyNamed(
  () => import('@/screens/panel/DepositPage'),
  'DepositPage',
);
const StateWiseDepositPage = lazyNamed(
  () => import('@/screens/panel/StateWiseDepositPage'),
  'StateWiseDepositPage',
);
const WithdrawalPage = lazyNamed(
  () => import('@/screens/panel/WithdrawalPage'),
  'WithdrawalPage',
);
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
const PercentagePage = lazyNamed(
  () => import('@/screens/panel/PercentagePage'),
  'PercentagePage',
);
const FeedbackPage = lazyNamed(() => import('@/screens/panel/FeedbackPage'), 'FeedbackPage');
const BannersPage = lazyNamed(() => import('@/screens/panel/BannersPage'), 'BannersPage');
const DumpUsersPage = lazyNamed(() => import('@/screens/panel/DumpUsersPage'), 'DumpUsersPage');
const UsersPage = lazyNamed(() => import('@/screens/panel/UsersPage'), 'UsersPage');
const UserReportPage = lazyNamed(
  () => import('@/screens/panel/userReport/UserReportPage'),
  'UserReportPage',
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

const DashboardPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'DashboardPage',
);
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
const AnalyticsPage = lazyNamed(
  () => import('@/screens/panel/dashboards/pages'),
  'AnalyticsPage',
);
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

function PanelRouteFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
        width: '100%',
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}

function readStoredSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user');
    const token = getAuthToken();
    if (!raw || !token || isJwtExpired(token)) {
      if (raw || token) clearAuthStorage();
      return null;
    }
    return JSON.parse(raw) as AuthUser;
  } catch {
    clearAuthStorage();
    return null;
  }
}

export default function App() {
  return (
    <ColorModeProvider>
      <AppInner />
    </ColorModeProvider>
  );
}

function AppInner() {
  const { theme, resolved } = useColorMode();
  const [user, setUser] = useState<AuthUser | null>(null);
  // First window: Astro site. Extra windows (#entry=panel): skip site → panel/login.
  const skipSiteLaunch = useMemo(() => {
    try {
      return /(?:^|[&#])entry=panel(?:&|$)/.test(String(window.location.hash || ''));
    } catch {
      return false;
    }
  }, []);
  const [screen, setScreen] = useState<AppScreen>(skipSiteLaunch ? 'login' : 'site');
  const sessionToastShown = useRef(false);
  const goLoginRef = useRef<(prefill?: { email?: string; mobile?: string }) => void>(
    () => {},
  );
  const sosBlocksLoginRef = useRef(false);
  const [loginPrefill, setLoginPrefill] = useState<{ email?: string; mobile?: string }>(
    {},
  );

  // Load OS-encrypted token before session checks.
  useEffect(() => {
    let cancelled = false;
    void initAuthToken().then(() => {
      if (cancelled) return;
      const session = readStoredSession();
      setUser(session);
      if (skipSiteLaunch) {
        try {
          // Avoid re-triggering skip on reload of the same window.
          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}`,
          );
        } catch {
          // ignore
        }
        if (session) {
          resetSessionExpiredGuard();
          sessionToastShown.current = false;
          setScreen('welcome');
          window.gcalc?.hideSite?.();
          window.gcalc?.showWelcome?.();
        } else {
          setScreen('login');
          window.gcalc?.hideSite?.();
          window.gcalc?.showLogin?.();
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [skipSiteLaunch]);

  const goPanel = useCallback((nextUser: AuthUser) => {
    resetSessionExpiredGuard();
    sessionToastShown.current = false;
    setUser(nextUser);
    setScreen('welcome');
    window.gcalc?.hideSite?.();
    window.gcalc?.showWelcome?.();
  }, []);

  const goLogin = useCallback((prefill?: { email?: string; mobile?: string }) => {
    if (prefill?.email || prefill?.mobile) {
      setLoginPrefill({
        email: prefill.email || '',
        mobile: prefill.mobile || '',
      });
      try {
        if (prefill.email) localStorage.setItem('astro_site_email', prefill.email);
        const digits = String(prefill.mobile || prefill.email || '')
          .replace(/\D/g, '')
          .slice(-10);
        if (/^[6-9]\d{9}$/.test(digits)) {
          localStorage.setItem('mobile', digits);
        }
      } catch {
        // ignore
      }
    }
    // Valid existing session → skip login and open admin panel.
    const session = readStoredSession();
    if (session) {
      goPanel(session);
      return;
    }
    setScreen('login');
    window.gcalc?.hideSite?.();
    window.gcalc?.showLogin?.();
  }, [goPanel]);

  goLoginRef.current = goLogin;

  useEffect(() => {
    const unsubLogin = window.gcalc?.onRequestLogin?.((payload) => {
      // SOS on → password gate must not open the OTP login window.
      if (sosBlocksLoginRef.current) {
        toast.error('SOS is active — panel login is disabled.');
        return;
      }
      goLoginRef.current(payload);
    });

    const unsubBlocked = window.gcalc?.onLoginBlockedSos?.(() => {
      toast.error('SOS is active — panel login is disabled.');
    });

    return () => {
      unsubLogin?.();
      unsubBlocked?.();
    };
  }, []);

  // Keep SOS gate in sync while viewing the embedded admin site.
  useEffect(() => {
    if (screen !== 'site') {
      sosBlocksLoginRef.current = false;
      return;
    }
    let cancelled = false;

    const apply = (active: boolean) => {
      if (cancelled) return;
      sosBlocksLoginRef.current = active;
      // Observing SOS via API must not trigger local siren / re-broadcast.
      if (!active) window.gcalc?.sosCleared?.();
    };

    // Main process keeps SOS after logout (token cleared in renderer).
    // No API poll here — sosMonitor is the sole get-sos-flag poller.
    void window.gcalc?.getSosState?.().then((state) => {
      if (!cancelled && state?.active) {
        sosBlocksLoginRef.current = true;
      }
    });

    const unsubscribe = window.gcalc?.onSosState?.((d) => {
      if (!cancelled) apply(Boolean(d?.active));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [screen]);

  const goSite = useCallback(() => {
    setScreen('site');
    window.gcalc?.showSite?.();
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    goSite();
  }, [goSite]);

  const inPanel = screen === 'welcome';

  // Register before child useEffects so API 401/403 can leave the panel immediately.
  useLayoutEffect(() => {
    if (!(inPanel && user)) {
      setSessionExpiredHandler(null);
      return;
    }

    setSessionExpiredHandler((reason) => {
      if (!sessionToastShown.current) {
        sessionToastShown.current = true;
        toast.error(reason || 'Session expired. Please login again.');
      }
      logout();
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, [inPanel, user, logout]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocationProvider>
        {screen === 'site' && <AstroSite onOpenLogin={goLogin} />}
        {screen === 'login' && (
          <Login
            onSuccess={(u) => goPanel(u)}
            onBack={goSite}
            initialMobile={loginPrefill.mobile}
            initialEmail={loginPrefill.email}
          />
        )}

        {inPanel && (
          <MemoryRouter initialEntries={['/welcome']}>
            <TokenValidator />
            <BlockedUserCheck />
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
        )}

        <UpdateToast />
      </LocationProvider>
      <ToastContainer position="top-center" theme={resolved} autoClose={3000} />
    </ThemeProvider>
  );
}
