import { Box, CircularProgress } from '@mui/material';

export function PanelRouteFallback() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 240,
        width: '100%',
      }}
    >
      <CircularProgress size={28} />
    </Box>
  );
}
