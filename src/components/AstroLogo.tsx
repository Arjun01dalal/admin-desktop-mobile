import { Box } from '@mui/material';
import thirdEyeLogo from '@/assets/third-eye-logo.png';

type Props = {
  size?: number;
  showGlow?: boolean;
};

/** Third Eye mark extracted from the brand logo. */
export function AstroLogo({ size = 72, showGlow = true }: Props) {
  return (
    <Box
      component="img"
      src={thirdEyeLogo}
      alt="Third Eye Astro"
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
