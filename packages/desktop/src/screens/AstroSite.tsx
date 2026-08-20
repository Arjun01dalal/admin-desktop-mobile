import { useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

type Props = {
  onOpenLogin?: () => void;
  onBackToNativeLogin?: () => void;
};

/**
 * Under the Electron BrowserView (astrotalk.vip) after customer password login.
 * Parent already called showSite({ accessToken }) for SSO — do not call showSite
 * again here (would risk loading the site without / with a stale hash).
 * Panel OTP still opens via Astro Admin LOGIN + gate password 123456789.
 */
export function AstroSite({ onBackToNativeLogin }: Props) {
  const [sosEnabled, setSosEnabled] = useState(false);
  const [sosReady, setSosReady] = useState(false);

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
          gap: 2,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          bgcolor: '#121218',
          px: 2,
        }}
      >
        {sosReady && sosEnabled ? (
          <Typography variant="body2" color="error.light" fontWeight={700}>
            SOS active — login disabled
          </Typography>
        ) : onBackToNativeLogin ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
            onClick={onBackToNativeLogin}
          >
            ← Back to Sign in
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
