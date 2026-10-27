/**
 * Same-page User Report dialog — used by Active Call dock (DP ID click).
 * Stays under the Active Call widget (lower z-index); call dock stays clickable.
 */
import { useMemo } from 'react';

import { Dialog, DialogContent, ThemeProvider } from '@mui/material';
import { GTEL_Z } from '@/screens/panel/gtel/gtelOverlayZIndex';
import { createAppTheme } from '@/theme';

import { UserReportPage } from './UserReportPage';

type Props = {
  open: boolean;
  userId: string;
  userName?: string;
  onClose: () => void;
};

export function UserReportModal({ open, userId, userName, onClose }: Props) {
  const id = String(userId || '').trim();
  const lightTheme = useMemo(() => createAppTheme('light'), []);

  if (!open || !id) return null;

  return (
    <ThemeProvider theme={lightTheme}>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth={false}
        scroll="paper"
        // Keep Active Call dock usable while this is open.
        disableEnforceFocus
        disableAutoFocus
        sx={{ zIndex: GTEL_Z.report }}
        slotProps={{
          backdrop: {
            sx: { zIndex: GTEL_Z.report },
          },
        }}
        PaperProps={{
          sx: {
            zIndex: GTEL_Z.report + 1,
            width: 'min(1120px, calc(100vw - 40px))',
            maxWidth: 'calc(100vw - 40px)',
            height: 'min(860px, calc(100vh - 48px))',
            maxHeight: 'calc(100vh - 48px)',
            m: 2,
            borderRadius: 2.5,
            overflow: 'hidden',
            boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
            border: '1px solid rgba(0,0,0,0.08)',
          },
        }}
      >
        <DialogContent
          sx={{
            p: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f4f6f8',
            // Leave room so pagination isn't fully under the call dock.
            pb: '88px',
          }}
        >
          <UserReportPage
            userId={id}
            userName={userName || id}
            embedded
            onClose={onClose}
          />
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}
