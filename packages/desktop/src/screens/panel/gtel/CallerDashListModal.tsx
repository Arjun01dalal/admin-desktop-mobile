/** Shared list / breakdown modal for Caller Dashboard (campaigns, CX allotment). */

import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import { useDashPalette } from './tones';

export type CallerDashListItem = {
  label: string;
  value?: number | string;
};

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  items: CallerDashListItem[];
  emptyMessage: string;
  /** When true, render label+count pills (allotment). Else campaign name chips. */
  withCounts?: boolean;
  onClose: () => void;
};

export function CallerDashListModal({
  open,
  title,
  subtitle,
  items,
  emptyMessage,
  withCounts = false,
  onClose,
}: Props) {
  const palette = useDashPalette();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
        {title}
        {subtitle ? (
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            — {subtitle}
          </Typography>
        ) : null}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {items.length ? (
          withCounts ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1,
              }}
            >
              {items.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    px: 1.25,
                    py: 0.85,
                    borderRadius: 999,
                    border: '1px solid',
                    borderColor: palette.dispBorder,
                    bgcolor: palette.dispBg,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    noWrap
                    title={item.label}
                    sx={{ flex: 1, minWidth: 0, color: 'text.primary' }}
                  >
                    {item.label}
                  </Typography>
                  <Box
                    sx={{
                      minWidth: 22,
                      height: 22,
                      px: 0.75,
                      borderRadius: 999,
                      bgcolor: palette.dispBadge,
                      color: palette.dispBadgeFg,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {item.value ?? 0}
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {items.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    px: 1.25,
                    py: 0.65,
                    borderRadius: 999,
                    border: '1px solid',
                    borderColor: palette.dispBorder,
                    bgcolor: palette.dispBg,
                    color: 'text.primary',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {item.label}
                </Box>
              ))}
            </Box>
          )
        ) : (
          <Typography color="text.secondary">{emptyMessage}</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
