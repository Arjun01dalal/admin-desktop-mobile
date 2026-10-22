import type { GtelCallerDashRow } from '@astro/shared';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';

import { useDashPalette } from './tones';

type Props = {
  row: GtelCallerDashRow | null;
  onClose: () => void;
};

export function CallerDashDispositionModal({ row, onClose }: Props) {
  const palette = useDashPalette();
  const items = Object.entries(row?.byDisposition || {})
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  return (
    <Dialog open={Boolean(row)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
        byDisposition — {row?.name || '—'}
        {row?.empCode ? ` (${row.empCode})` : ''}
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
                  {item.value}
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">No disposition data.</Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
