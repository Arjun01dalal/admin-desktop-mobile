import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

type Props = {
  onOpenLogin: () => void;
};

/**
 * Under the Electron BrowserView (astrotalk.vip).
 * Panel OTP login opens only via Astro Admin LOGIN + gate password (sitePreload).
 * No visible "Login to Panel" button.
 */
export function AstroSite({ onOpenLogin: _onOpenLogin }: Props) {
  const [sosEnabled, setSosEnabled] = useState(false);
  const [sosReady, setSosReady] = useState(false);

  useEffect(() => {
    window.gcalc?.showSite?.();
    // Intentionally no hideSite on cleanup: React StrictMode remounts this
    // effect and a hide→show cycle black-flashes the window. Login / welcome
    // transitions call hideSite themselves.
  }, []);

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

    const unsubSos = window.gcalc?.onSosState?.((d) => {
      setSosEnabled(Boolean(d?.active));
      setSosReady(true);
    });

    return () => {
      cancelled = true;
      unsubSos?.();
    };
  }, []);

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
            Loading Astro Admin…
          </Typography>
        </Stack>
      </Box>

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
        {sosReady && sosEnabled ? (
          <Typography variant="body2" color="error.light" fontWeight={700}>
            SOS active — login disabled
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
