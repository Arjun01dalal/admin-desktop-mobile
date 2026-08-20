import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { clearAuthStorage } from '@/utils/session';

const SITE_ACCESS_TOKEN_KEY = 'astro_site_access_token_v1';

type DeepLinkPayload = {
  screen?: string;
  loggedOut?: boolean;
  raw?: string;
} | null;

/**
 * myastroapp://login?logged_out=1 → clear session and open native Astro login.
 * Behavior matches the previous inline App.tsx effect.
 */
export function useAstroDeepLinkLogout(goAstroLogin: () => void, setUser: (u: null) => void) {
  const goAstroLoginRef = useRef(goAstroLogin);
  const setUserRef = useRef(setUser);
  goAstroLoginRef.current = goAstroLogin;
  setUserRef.current = setUser;

  useEffect(() => {
    const appliedRaw = { current: '' };

    const applyDeepLink = (payload?: DeepLinkPayload) => {
      if (!payload || payload.screen !== 'login') return;
      const raw = String(payload.raw || '');
      if (raw && appliedRaw.current === raw) return;
      if (raw) appliedRaw.current = raw;

      try {
        localStorage.removeItem(SITE_ACCESS_TOKEN_KEY);
      } catch {
        // ignore
      }
      clearAuthStorage();
      setUserRef.current(null);
      goAstroLoginRef.current();
      if (payload.loggedOut) {
        toast.info('Logged out. Please sign in again.');
      }
    };

    void window.gcalc?.getPendingDeepLink?.().then((pending) => {
      applyDeepLink(pending);
    });

    const unsub = window.gcalc?.onDeepLink?.(applyDeepLink);
    return () => {
      unsub?.();
    };
  }, []);
}
