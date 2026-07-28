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

export function LocationEnableDialog({
  open,
  loading,
  error,
  onEnable,
  onOpenSettings,
}: Props) {
  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      onClose={() => undefined}
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
        Enable Location
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          We could not get your device location. On Electron/macOS, GPS often times out.
          Turn <strong>Location</strong> ON in Settings (allow Electron), or ensure you are
          online — we will use network location automatically.
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
