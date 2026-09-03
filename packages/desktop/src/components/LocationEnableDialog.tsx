import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Stack,
  Box,
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';

type Props = {
  open: boolean;
  loading: boolean;
  error: string | null;
  onEnable: () => void;
  onOpenSettings: () => void;
};

export function LocationEnableDialog({ open, loading, error, onEnable, onOpenSettings }: Props) {
  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      hideBackdrop={false}
      onClose={() => undefined}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
            pointerEvents: 'auto',
          },
        },
      }}
      PaperProps={{
        sx: {
          bgcolor: '#2b2b30',
          color: '#fff',
          borderRadius: 3,
          minWidth: 320,
          maxWidth: 420,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #ffd60a, #ff9f0a)',
            color: '#000',
          }}
        >
          <MyLocationIcon fontSize="small" />
        </Box>
        Location Required
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', mb: 1.5 }}>
          We could not determine your location (GPS and network both failed). Turn on Location
          Services and check your internet — this alert will close automatically once location is
          available.
        </Typography>
        {error && (
          <Typography variant="caption" color="error" display="block">
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Stack direction="row" spacing={1} width="100%">
          <Button fullWidth variant="outlined" onClick={onOpenSettings} disabled={loading}>
            Open Settings
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={onEnable}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Checking…' : 'Try again'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
