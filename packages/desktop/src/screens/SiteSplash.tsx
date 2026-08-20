import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AstroLogo } from '@/components/AstroLogo';

type Props = {
  onDone: () => void;
  durationMs?: number;
};

/** Native splash — replaces marketing website first paint. */
export function SiteSplash({ onDone, durationMs = 1200 }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    // Overlap Google FCM register with splash (~1.2s); joins main-process warm if already running.
    void window.gcalc?.getFcmToken?.({});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(t);
  }, [onDone, durationMs]);

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        px: 3,
        background: isDark
          ? 'radial-gradient(ellipse at 30% 20%, #3a2a10 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #1a1520 0%, #0f0f12 60%)'
          : 'radial-gradient(circle at 50% 0%, #ffffff 0%, #f0f1f5 45%, #e8e9ee 100%)',
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <AstroLogo size={96} />
        </Box>
        <Typography
          sx={{
            letterSpacing: 3,
            color: isDark ? '#c9a0ff' : '#7b4fd4',
            fontWeight: 700,
            fontSize: 12,
            mb: 2,
          }}
        >
          ASTRO ADMIN
        </Typography>
        <Typography
          sx={{
            color: isDark ? '#fff' : '#111',
            fontSize: { xs: '2rem', md: '3rem' },
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          WELCOME to
        </Typography>
        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: '2rem', md: '3.2rem' },
            fontWeight: 900,
            color: 'transparent',
            WebkitTextStroke: isDark ? '3px #f1a144' : '3px #c47f00',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          astro admin
        </Typography>
        <Box
          sx={{
            mt: 2,
            mx: 'auto',
            width: 'fit-content',
            px: 3,
            py: 1,
            bgcolor: '#000',
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          CS PANEL
        </Box>
      </Box>
    </Box>
  );
}
