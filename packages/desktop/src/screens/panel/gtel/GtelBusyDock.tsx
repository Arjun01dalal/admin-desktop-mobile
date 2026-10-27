/**
 * Shown when Call Start / Manual Call is opened while an Active Call is live.
 */
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { GTEL_Z } from './gtelOverlayZIndex';

type Props = {
  title?: string;
  phoneMasked?: string | null;
  onClose: () => void;
};

export function GtelBusyDock({ title = 'Call in progress', phoneMasked, onClose }: Props) {
  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: GTEL_Z.dock,
        width: 300,
        maxWidth: 'calc(100vw - 32px)',
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.25, py: 1.25 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'rgba(34,197,94,0.15)',
            color: '#22c55e',
            flexShrink: 0,
          }}
        >
          <PhoneInTalkOutlinedIcon sx={{ fontSize: 16 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={800} fontSize={12} noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {phoneMasked
              ? `${phoneMasked} · Hang up Active Call first`
              : 'Hang up the Active Call dock first'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Paper>
  );
}
