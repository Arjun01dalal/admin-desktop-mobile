import { useCallback, useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { secureApi } from '@/api/secureClient';
import { isSosFlagEnabled } from '@/hooks/useSosFlagGuard';

type Props = {
  onOpenLogin: () => void;
};

const SOS_POLL_MS = 10_000;

/**
 * Under the Electron BrowserView (admin.astrothirdeye.com).
 * Bottom bar: Login to main panel only when sosEnabled is false.
 *
 * Prefer main-process SOS state — after a SOS kick the renderer token is
 * cleared, so get-sos-flag alone cannot hide the Login button.
 */
export function AstroSite({ onOpenLogin }: Props) {
  const [sosEnabled, setSosEnabled] = useState(false);
  const [sosReady, setSosReady] = useState(false);

  const refreshSosFromApi = useCallback(async () => {
    // get-sos-flag needs a Bearer token — skip when logged out.
    if (!localStorage.getItem('token')) return;
    try {
      const res = await secureApi('auth.getSosFlag', {});
      if (res.ok) {
        const active = isSosFlagEnabled(res.data);
        setSosEnabled(active);
        // Observing only — never re-trigger originator-style sosActivated.
        if (!active) window.gcalc?.sosCleared?.();
      }
    } catch {
      // Keep last known value on blips.
    }
  }, []);

  useEffect(() => {
    window.gcalc?.showSite?.();
    return () => {
      window.gcalc?.hideSite?.();
    };
  }, []);

  // Main process knows SOS even after logout (persisted token + sosMonitor).
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const state = await window.gcalc?.getSosState?.();
        if (!cancelled && state?.active) {
          setSosEnabled(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSosReady(true);
      }
    })();

    const unsubscribe = window.gcalc?.onSosState?.((d) => {
      setSosEnabled(Boolean(d?.active));
      setSosReady(true);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    void refreshSosFromApi();
    const id = window.setInterval(() => {
      void refreshSosFromApi();
    }, SOS_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshSosFromApi]);

  const showLogin = sosReady && !sosEnabled;

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#0b0b0f',
        color: '#fff',
      }}
    >
      {/* BrowserView covers this area; shown while site loads / if view unavailable */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
        }}
      >
        <Stack spacing={1.5} alignItems="center" maxWidth={420} textAlign="center">
          <CircularProgress size={28} sx={{ color: '#ff9f0a' }} />
          <Typography variant="h6" fontWeight={700}>
            Loading ThirdEye Admin…
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Opening{' '}
            <Box component="span" sx={{ color: '#ff9f0a' }}>
              admin.astrothirdeye.com
            </Box>
          </Typography>
        </Stack>
      </Box>

      {/* Fixed bottom bar — always visible under BrowserView */}
      <Box
        sx={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#121218',
          px: 2,
        }}
      >
        {showLogin ? (
          <Button
            variant="contained"
            onClick={onOpenLogin}
            sx={{
              minWidth: 160,
              fontWeight: 700,
              textTransform: 'none',
              bgcolor: '#ff9f0a',
              color: '#111',
              '&:hover': { bgcolor: '#e8900a' },
            }}
          >
            Login to Panel
          </Button>
        ) : sosReady && sosEnabled ? (
          <Typography variant="body2" color="error.light" fontWeight={700}>
            SOS active — login disabled
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
