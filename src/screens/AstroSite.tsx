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
 */
export function AstroSite({ onOpenLogin }: Props) {
  const [sosEnabled, setSosEnabled] = useState(false);
  const [sosReady, setSosReady] = useState(false);

  const refreshSos = useCallback(async () => {
    try {
      const res = await secureApi('auth.getSosFlag', {});
      if (res.ok) {
        const active = isSosFlagEnabled(res.data);
        setSosEnabled(active);
        // Panel may be closed (site only) — still trigger main-process alert + siren.
        if (active) window.gcalc?.sosActivated?.();
        else window.gcalc?.sosCleared?.();
      }
    } catch {
      // Keep last known value on blips.
    } finally {
      setSosReady(true);
    }
  }, []);

  useEffect(() => {
    window.gcalc?.showSite?.();
    return () => {
      window.gcalc?.hideSite?.();
    };
  }, []);

  useEffect(() => {
    void refreshSos();
    const id = window.setInterval(() => {
      void refreshSos();
    }, SOS_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshSos]);

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
        ) : null}
      </Box>
    </Box>
  );
}
