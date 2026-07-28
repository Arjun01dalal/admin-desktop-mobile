import { Box } from '@mui/material';
import astroLogo from '@/assets/astro-logo.png';

type Props = {
  size?: number;
  showGlow?: boolean;
};

/** Astro Admin Panel brand mark. */
export function AstroLogo({ size = 72, showGlow = true }: Props) {
  return (
    <Box
      component="img"
      src={astroLogo}
      alt="Astro Admin Panel"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
        filter: showGlow
          ? 'drop-shadow(0 10px 28px rgba(168, 120, 255, 0.45))'
          : 'none',
      }}
    />
  );
}
