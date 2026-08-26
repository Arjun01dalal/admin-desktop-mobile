import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useColorMode } from '@/context/ColorModeContext';
import { LocationProvider } from '@/controllers/LocationProvider';
import { AstroSite } from '@/screens/AstroSite';
import { AstroSiteLogin } from '@/screens/AstroSiteLogin';
import { ForgotPassword } from '@/screens/ForgotPassword';
import { Login } from '@/screens/Login';
import { SiteSplash } from '@/screens/SiteSplash';
import { TermsAndConditions } from '@/screens/TermsAndConditions';
import { UpdateToast } from '@/components/UpdateToast';
import {
  clearAuthStorage,
  resetSessionExpiredGuard,
  setSessionExpiredHandler,
} from '@/utils/session';
import { initAuthToken } from '@/utils/authToken';
import { showPushToast } from '@/utils/showPushToast';
import { useAstroDeepLinkLogout } from '@/hooks/useAstroDeepLinkLogout';
import { readStoredSession } from '@/app/readStoredSession';
import { PanelRoutes } from '@/app/PanelRoutes';
import type { AppScreen, AuthUser } from '@/types/gcalc';

export function AppInner() {
  const { theme, resolved } = useColorMode();
  const [user, setUser] = useState<AuthUser | null>(null);
  // First window: native splash → Astro login. Extra windows (#entry=panel): panel OTP.
  const skipSiteLaunch = useMemo(() => {
    try {
      return /(?:^|[&#])entry=panel(?:&|$)/.test(String(window.location.hash || ''));
    } catch {
      return false;
    }
  }, []);
  const [screen, setScreen] = useState<AppScreen>(skipSiteLaunch ? 'login' : 'splash');
  const [returnTo, setReturnTo] = useState<AppScreen>('astro-login');
  const sessionToastShown = useRef(false);
  const goLoginRef = useRef<(prefill?: { email?: string; mobile?: string }) => void>(
    () => {},
  );
  const sosBlocksLoginRef = useRef(false);
  const [sosBlocksLogin, setSosBlocksLogin] = useState(false);
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

  // Keep SOS gate in sync on native Astro login + customer site (panel gate).
  useEffect(() => {
    const onAstroGate =
      screen === 'astro-login' || screen === 'splash' || screen === 'site';
    if (!onAstroGate) {
      sosBlocksLoginRef.current = false;
      setSosBlocksLogin(false);
      return;
    }
    let cancelled = false;

    const apply = (active: boolean) => {
      if (cancelled) return;
      sosBlocksLoginRef.current = active;
      setSosBlocksLogin(active);
      // Observing SOS via API must not trigger local siren / re-broadcast.
      if (!active) window.gcalc?.sosCleared?.();
    };

    // Main process keeps SOS after logout (token cleared in renderer).
    // No API poll here — sosMonitor is the sole get-sos-flag poller.
    void window.gcalc?.getSosState?.().then((state) => {
      if (!cancelled && state?.active) apply(true);
    });

    const unsubscribe = window.gcalc?.onSosState?.((d) => {
      if (!cancelled) apply(Boolean(d?.active));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [screen]);

  /** Native Astro login shell — no marketing BrowserView. */
  const goAstroLogin = useCallback(() => {
    setScreen('astro-login');
    if (typeof window.gcalc?.showNativeAuth === 'function') {
      window.gcalc.showNativeAuth();
    } else {
      window.gcalc?.hideSite?.();
    }
  }, []);

  /**
   * Customer password login success only.
   * Opens site with #external_login=1&access_token=… (not used for gate password 123456789).
   */
  const goCustomerSite = useCallback((accessToken?: string) => {
    const token = String(accessToken || '').trim();
    if (!token) {
      toast.error('Missing access token — cannot open Astro home.');
      return;
    }
    setScreen('site');
    window.gcalc?.showSite?.({ accessToken: token });
  }, []);

  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    goAstroLogin();
  }, [goAstroLogin]);

  useAstroDeepLinkLogout(goAstroLogin, setUser);

  const inPanel = screen === 'welcome';

  // Register before child useEffects so API 401 (and auth-message 403) can leave the panel immediately.
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

  // FCM toasts on splash / Astro login / OTP login (panel uses AppShell hook).
  useEffect(() => {
    if (inPanel) return;
    const unsub = window.gcalc?.onPushNotification?.((payload) => {
      if (payload?.clicked) return;
      // OS/main already plays notify.mp3 — toast is visual only.
      showPushToast(payload, { playSound: false });
    });
    return () => {
      unsub?.();
    };
  }, [inPanel]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocationProvider>
        {screen === 'splash' && (
          <SiteSplash
            onDone={() => {
              setScreen('astro-login');
              if (typeof window.gcalc?.showNativeAuth === 'function') {
                window.gcalc.showNativeAuth();
              } else {
                window.gcalc?.hideSite?.();
              }
              void window.gcalc?.getFcmToken?.({});
            }}
          />
        )}
        {screen === 'astro-login' && (
          <AstroSiteLogin
            sosBlocksLogin={sosBlocksLogin}
            onOpenPanelLogin={(prefill) => goLogin(prefill)}
            onOpenAstroSite={goCustomerSite}
            onForgotPassword={() => {
              setReturnTo('astro-login');
              setScreen('forgot');
            }}
            onTerms={() => {
              setReturnTo('astro-login');
              setScreen('terms');
              if (typeof window.gcalc?.showNativeAuth === 'function') {
                window.gcalc.showNativeAuth();
              } else {
                window.gcalc?.hideSite?.();
              }
            }}
          />
        )}
        {screen === 'site' && (
          <AstroSite onBackToNativeLogin={goAstroLogin} />
        )}
        {screen === 'forgot' && (
          <ForgotPassword onBack={() => setScreen(returnTo)} />
        )}
        {screen === 'terms' && (
          <TermsAndConditions onBack={() => setScreen(returnTo)} />
        )}
        {screen === 'login' && (
          <Login
            onSuccess={(u) => goPanel(u)}
            onBack={goAstroLogin}
            initialMobile={loginPrefill.mobile}
            initialEmail={loginPrefill.email}
          />
        )}

        {inPanel && (
          <PanelRoutes user={user} logout={logout} goPanel={goPanel} />
        )}

        <UpdateToast />
      </LocationProvider>
      <ToastContainer position="top-center" theme={resolved} autoClose={3000} />
    </ThemeProvider>
  );
}
