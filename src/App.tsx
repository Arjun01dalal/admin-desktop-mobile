import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { theme } from '@/theme';
import { LocationProvider } from '@/controllers/LocationProvider';
import { Calculator } from '@/screens/Calculator';
import { Login } from '@/screens/Login';
import { AppShell } from '@/layout/AppShell';
import { WelcomePage } from '@/screens/panel/WelcomePage';
import { HouseGamesPage } from '@/screens/panel/HouseGamesPage';
import { CallerResponsibilityPage } from '@/screens/panel/CallerResponsibilityPage';
import { CallerDepositListPage } from '@/screens/panel/callerResponsibility/CallerDepositListPage';
import { ActiveBotUsersPage } from '@/screens/panel/callerResponsibility/ActiveBotUsersPage';
import { CallerDetailsPage } from '@/screens/panel/callerResponsibility/CallerDetailsPage';
import { PlayerActivityPage } from '@/screens/panel/PlayerActivityPage';
import { PlayerActivityDetailsPage } from '@/screens/panel/PlayerActivityDetailsPage';
import { GameActivityPage } from '@/screens/panel/GameActivityPage';
import { GameActivityDetailsPage } from '@/screens/panel/GameActivityDetailsPage';
import { CallLogsPage } from '@/screens/panel/CallLogsPage';
import { NewRegistersPage } from '@/screens/panel/NewRegistersPage';
import { CoinRemovalPage } from '@/screens/panel/CoinRemovalPage';
import { CoinRemovalDetailsPage } from '@/screens/panel/coinRemoval/CoinRemovalDetailsPage';
import { MobileAppPage } from '@/screens/panel/MobileAppPage';
import { UpdateToast } from '@/components/UpdateToast';
import { PANEL_PATHS } from '@/layout/navItems';
import { useSessionGuard } from '@/hooks/useSessionGuard';
import {
  clearAuthStorage,
  isJwtExpired,
  resetSessionExpiredGuard,
  setSessionExpiredHandler,
} from '@/utils/session';
import type { AppScreen, AuthUser } from '@/types/gcalc';

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
  const [screen, setScreen] = useState<AppScreen>(() =>
    readStoredSession() ? 'welcome' : 'calculator',
  );
  const [panelEntry] = useState(() => readLastPanelPath());
  const sessionToastShown = useRef(false);

  useEffect(() => {
    if (user) {
      window.gcalc?.showWelcome?.();
    } else {
      window.gcalc?.showCalculator?.();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goCalculator = useCallback(() => {
    setScreen('calculator');
    window.gcalc?.showCalculator?.();
  }, []);

  const goLogin = useCallback(() => {
    setScreen('login');
    window.gcalc?.showLogin?.();
  }, []);

  const goPanel = useCallback((nextUser: AuthUser) => {
    resetSessionExpiredGuard();
    sessionToastShown.current = false;
    setUser(nextUser);
    setScreen('welcome');
    window.gcalc?.showWelcome?.();
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    goCalculator();
  }, [goCalculator]);

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
        {screen === 'calculator' && <Calculator onUnlock={goLogin} />}
        {screen === 'login' && (
          <Login onSuccess={(u) => goPanel(u)} onBack={goCalculator} />
        )}

        {inPanel && (
          <MemoryRouter initialEntries={[panelEntry]}>
            <Routes>
              <Route element={<AppShell onLogout={logout} />}>
                <Route path="/welcome" element={<WelcomePage user={user} />} />
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
                <Route path="/coin-removal" element={<CoinRemovalPage />} />
                <Route
                  path="/coin-removal/details"
                  element={<CoinRemovalDetailsPage />}
                />
                <Route path="/mobile-app" element={<MobileAppPage />} />
                <Route path="*" element={<Navigate to="/welcome" replace />} />
              </Route>
            </Routes>
            <PanelPathTracker />
          </MemoryRouter>
        )}

        <UpdateToast />
      </LocationProvider>
      <ToastContainer position="top-center" theme="dark" autoClose={3000} />
    </ThemeProvider>
  );
}
