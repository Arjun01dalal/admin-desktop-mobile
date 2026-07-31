import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { theme } from '@/theme';
import { LocationProvider } from '@/controllers/LocationProvider';
import { AstroSite } from '@/screens/AstroSite';
import { Login } from '@/screens/Login';
import { AppShell } from '@/layout/AppShell';
import { UpdateToast } from '@/components/UpdateToast';
import { PANEL_PATHS } from '@/layout/navItems';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import { isSosFlagEnabled } from '@/hooks/useSosFlagGuard';
import { secureApi } from '@/api/secureClient';
import {
  clearAuthStorage,
  isJwtExpired,
  resetSessionExpiredGuard,
  setSessionExpiredHandler,
} from '@/utils/session';
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
const CoinRemovalPage = lazyNamed(
  () => import('@/screens/panel/CoinRemovalPage'),
  'CoinRemovalPage',
);
const CoinRemovalDetailsPage = lazyNamed(
  () => import('@/screens/panel/coinRemoval/CoinRemovalDetailsPage'),
  'CoinRemovalDetailsPage',
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
const LoginReportPage = lazyNamed(
  () => import('@/screens/panel/LoginReportPage'),
  'LoginReportPage',
);
const SocialMediaPage = lazyNamed(
  () => import('@/screens/panel/SocialMediaPage'),
  'SocialMediaPage',
);
const UpiListsPage = lazyNamed(() => import('@/screens/panel/UpiListsPage'), 'UpiListsPage');
const UtrProviderPage = lazyNamed(
  () => import('@/screens/panel/UtrProviderPage'),
  'UtrProviderPage',
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
const MyCustomersPage = lazyNamed(
  () => import('@/screens/panel/MyCustomersPage'),
  'MyCustomersPage',
);
const CustomerAllotmentPage = lazyNamed(
  () => import('@/screens/panel/CustomerAllotmentPage'),
  'CustomerAllotmentPage',
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

const LAST_PANEL_PATH_KEY = 'last_panel_path';

function readStoredSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user');
    const token = localStorage.getItem('token');
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

function readLastPanelPath(): string {
  try {
    const path = sessionStorage.getItem(LAST_PANEL_PATH_KEY) || '/welcome';
    return PANEL_PATHS.has(path) ? path : '/welcome';
  } catch {
    return '/welcome';
  }
}

/** Saves current panel route so refresh reopens the same page. */
function PanelPathTracker() {
  const location = useLocation();

  useEffect(() => {
    if (PANEL_PATHS.has(location.pathname)) {
      sessionStorage.setItem(LAST_PANEL_PATH_KEY, location.pathname);
    }
  }, [location.pathname]);

  return null;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession());
  // Always open on the ThirdEye site — never auto-enter the panel.
  const [screen, setScreen] = useState<AppScreen>('site');
  const panelEntry = useState(() => readLastPanelPath())[0];
  const sessionToastShown = useRef(false);
  const goLoginRef = useRef<() => void>(() => {});
  const sosBlocksLoginRef = useRef(false);

  useEffect(() => {
    window.gcalc?.showSite?.();
  }, []);

  const goPanel = useCallback((nextUser: AuthUser) => {
    resetSessionExpiredGuard();
    sessionToastShown.current = false;
    setUser(nextUser);
    setScreen('welcome');
    window.gcalc?.hideSite?.();
    window.gcalc?.showWelcome?.();
  }, []);

  const goLogin = useCallback(() => {
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
    window.gcalc?.onRequestLogin?.(() => {
      // When SOS is active, do not open panel login from the site shell.
      if (sosBlocksLoginRef.current) return;
      goLoginRef.current();
    });
  }, []);

  // Keep SOS gate in sync while viewing the embedded admin site.
  useEffect(() => {
    if (screen !== 'site') {
      sosBlocksLoginRef.current = false;
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await secureApi('auth.getSosFlag', {});
        if (cancelled || !res.ok) return;
        sosBlocksLoginRef.current = isSosFlagEnabled(res.data);
      } catch {
        // ignore
      }
    };
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
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

  useSessionGuard({
    enabled: inPanel && Boolean(user),
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocationProvider>
        {screen === 'site' && <AstroSite onOpenLogin={goLogin} />}
        {screen === 'login' && (
          <Login onSuccess={(u) => goPanel(u)} onBack={goSite} />
        )}

        {inPanel && (
          <MemoryRouter initialEntries={[panelEntry]}>
            <Suspense fallback={<PanelRouteFallback />}>
              <Routes>
                <Route element={<AppShell onLogout={logout} />}>
                  <Route path="/welcome" element={<WelcomePage user={user} />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/vip-dashboard" element={<VipDashboardPage />} />
                  <Route path="/combined-dashboard" element={<CombinedDashboardPage />} />
                  <Route path="/risk-dashboard" element={<RiskDashboardPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/master-flow" element={<MasterFlowPage />} />
                  <Route path="/profit-loss" element={<ProfitLossPage />} />
                  <Route path="/house-games" element={<HouseGamesPage />} />
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
                  <Route path="/login-report" element={<LoginReportPage />} />
                  <Route
                    path="/all-user-login-report"
                    element={<AllUserLoginReportPage />}
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
                  <Route path="/my-customer" element={<MyCustomersPage />} />
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
                  <Route path="/banners" element={<BannersPage />} />
                  <Route path="/upi-lists" element={<UpiListsPage />} />
                  <Route path="/utr-provider" element={<UtrProviderPage />} />
                  <Route path="/playerRtp" element={<PlayerRtpPage />} />
                  <Route
                    path="/playerRTPDetails"
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
                  <Route path="/mobile-app" element={<MobileAppPage />} />
                  <Route path="*" element={<Navigate to="/welcome" replace />} />
                </Route>
              </Routes>
            </Suspense>
            <PanelPathTracker />
          </MemoryRouter>
        )}

        <UpdateToast />
      </LocationProvider>
      <ToastContainer position="top-center" theme="dark" autoClose={3000} />
    </ThemeProvider>
  );
}
