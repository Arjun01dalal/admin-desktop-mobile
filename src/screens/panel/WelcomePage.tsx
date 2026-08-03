import { Box, Typography } from '@mui/material';
import { AstroLogo } from '@/components/AstroLogo';
import type { AuthUser } from '@/types/gcalc';

type Props = {
  user?: AuthUser | null;
};

export function WelcomePage({ user }: Props) {
  const name = user?.name || user?.mobile || 'Admin';

  return (
    <Box
      sx={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        background:
          'radial-gradient(ellipse at 30% 20%, #3a2a10 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, #1a1520 0%, #0f0f12 60%)',
        borderRadius: 3,
        px: 3,
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <AstroLogo size={64} />
        </Box>
        <Typography
          sx={{
            color: '#fff',
            fontSize: { xs: '2rem', md: '3.2rem' },
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          WELCOME to
        </Typography>
        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: '2rem', md: '3.6rem' },
            fontWeight: 900,
            color: 'transparent',
            WebkitTextStroke: '3px #f1a144',
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
        <Typography sx={{ mt: 3, color: 'text.secondary' }}>Signed in as {name}</Typography>
      </Box>
    </Box>
  );
}
