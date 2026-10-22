import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { formatC2cCallerChipLabel, type C2cCampaign } from '@astro/shared';

type Props = {
  campaign: C2cCampaign | null;
  onClose: () => void;
};

export function C2cCallersModal({ campaign, onClose }: Props) {
  const callers = campaign?.callers || [];

  return (
    <Dialog open={Boolean(campaign)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GroupsOutlinedIcon sx={{ color: '#ff9f0a', fontSize: 22 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap>
              Callers
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {campaign?.campaignName || '—'}
              {callers.length ? ` · ${callers.length}` : ''}
            </Typography>
          </Box>
        </Stack>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {callers.length ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ gap: 0.75 }}>
            {callers.map((c) => (
              <Chip
                key={c._id || c.name}
                size="small"
                label={formatC2cCallerChipLabel(c)}
                sx={{
                  fontWeight: 700,
                  bgcolor: alpha('#ff9f0a', 0.1),
                  border: `1px solid ${alpha('#ff9f0a', 0.28)}`,
                  color: 'text.primary',
                }}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No callers assigned.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
