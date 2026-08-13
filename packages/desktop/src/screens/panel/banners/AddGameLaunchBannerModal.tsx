import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  GAME_LAUNCH_CATEGORY,
  GAME_LAUNCH_PROVIDERS,
} from '@/screens/panel/banners/constants';

type BannerMode = 'existing' | 'new';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const initialExisting = { gameId: '', gameName: '', providerName: '' };
const initialNew = {
  gameName: '',
  gameId: '',
  imagePath: '',
  imageKey: '',
  gameData: '',
  type: 'banner',
  deepLink: '',
  status: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function AddGameLaunchBannerModal({ open, onClose, onSuccess }: Props) {
  const [bannerMode, setBannerMode] = useState<BannerMode>('existing');
  const [existingForm, setExistingForm] = useState(initialExisting);
  const [newForm, setNewForm] = useState(initialNew);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setBannerMode('existing');
    setExistingForm(initialExisting);
    setNewForm(initialNew);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    resetForm();
    onClose();
  }, [onClose, resetForm, submitting]);

  const validateExisting = () => {
    if (!existingForm.gameId.trim()) {
      toast.error('Game ID is required');
      return false;
    }
    if (!existingForm.gameName.trim()) {
      toast.error('Game name is required');
      return false;
    }
    if (!existingForm.providerName) {
      toast.error('Please select a provider');
      return false;
    }
    return true;
  };

  const validateNew = () => {
    if (!newForm.gameName.trim()) {
      toast.error('Game name is required');
      return false;
    }
    if (!newForm.gameId.trim()) {
      toast.error('Game ID is required');
      return false;
    }
    if (!newForm.imagePath.trim()) {
      toast.error('Image path is required');
      return false;
    }
    if (!newForm.imageKey.trim()) {
      toast.error('Image key is required');
      return false;
    }
    if (!newForm.gameData.trim()) {
      toast.error('Game data is required');
      return false;
    }
    if (!newForm.type) {
      toast.error('Type is required');
      return false;
    }
    if (newForm.deepLink === '') {
      toast.error('Deep link is required');
      return false;
    }
    if (newForm.status === '') {
      toast.error('Status is required');
      return false;
    }
    try {
      JSON.parse(newForm.gameData);
    } catch {
      toast.error('Game data must be a valid JSON object');
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (bannerMode === 'existing') {
        if (!validateExisting()) return;
        const res = await secureApi('ops.bannersCreateGameLaunch', {
          gameId: existingForm.gameId.trim(),
          providerName: existingForm.providerName,
          gameName: existingForm.gameName.trim(),
          category: GAME_LAUNCH_CATEGORY,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add banner');
          return;
        }
      } else {
        if (!validateNew()) return;
        const res = await secureApi('ops.bannersCreateWithGameData', {
          gameName: newForm.gameName.trim(),
          category: GAME_LAUNCH_CATEGORY,
          imagePath: newForm.imagePath.trim(),
          imageKey: newForm.imageKey.trim(),
          gameId: newForm.gameId.trim(),
          gameData: JSON.parse(newForm.gameData),
          type: newForm.type,
          deepLink: newForm.deepLink === 'true',
          status: newForm.status === 'true',
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add banner');
          return;
        }
      }
      toast.success('Banner added successfully');
      resetForm();
      onClose();
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <form onSubmit={(e) => void handleSubmit(e)}>
        <DialogTitle sx={{ pb: 1 }}>Add Banner</DialogTitle>
        <DialogContent dividers>
          <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
            <FormLabel component="legend">Banner Type</FormLabel>
            <RadioGroup
              row
              value={bannerMode}
              onChange={(e) => {
                setBannerMode(e.target.value as BannerMode);
                setExistingForm(initialExisting);
                setNewForm(initialNew);
              }}
            >
              <FormControlLabel value="existing" control={<Radio />} label="Already Exists" />
              <FormControlLabel value="new" control={<Radio />} label="New" />
            </RadioGroup>
          </FormControl>

          {bannerMode === 'existing' ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Game ID"
                  size="small"
                  fullWidth
                  required
                  value={existingForm.gameId}
                  onChange={(e) =>
                    setExistingForm((prev) => ({ ...prev, gameId: e.target.value }))
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Game Name"
                  size="small"
                  fullWidth
                  required
                  value={existingForm.gameName}
                  onChange={(e) =>
                    setExistingForm((prev) => ({ ...prev, gameName: e.target.value }))
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel id="provider-name-label">Provider Name</InputLabel>
                  <Select
                    labelId="provider-name-label"
                    label="Provider Name"
                    value={existingForm.providerName}
                    onChange={(e) =>
                      setExistingForm((prev) => ({
                        ...prev,
                        providerName: e.target.value,
                      }))
                    }
                  >
                    {GAME_LAUNCH_PROVIDERS.map((provider) => (
                      <MenuItem key={provider} value={provider}>
                        {provider}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Category"
                  size="small"
                  fullWidth
                  value={GAME_LAUNCH_CATEGORY}
                  disabled
                />
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Game Name"
                  size="small"
                  fullWidth
                  required
                  value={newForm.gameName}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, gameName: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Game ID"
                  size="small"
                  fullWidth
                  required
                  value={newForm.gameId}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, gameId: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Image Path"
                  size="small"
                  fullWidth
                  required
                  value={newForm.imagePath}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, imagePath: e.target.value }))}
                  placeholder="https://..."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Image Key"
                  size="small"
                  fullWidth
                  required
                  value={newForm.imageKey}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, imageKey: e.target.value }))}
                  placeholder="filename.jpeg"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Game Data"
                  size="small"
                  fullWidth
                  required
                  multiline
                  minRows={4}
                  value={newForm.gameData}
                  onChange={(e) => setNewForm((prev) => ({ ...prev, gameData: e.target.value }))}
                  placeholder="Paste complete gameData JSON object"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Category"
                  size="small"
                  fullWidth
                  value={GAME_LAUNCH_CATEGORY}
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small" required>
                  <InputLabel id="banner-type-label">Type</InputLabel>
                  <Select
                    labelId="banner-type-label"
                    label="Type"
                    value={newForm.type}
                    onChange={(e) => setNewForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <MenuItem value="banner">banner</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset" required>
                  <FormLabel component="legend">Deep Link</FormLabel>
                  <RadioGroup
                    row
                    value={newForm.deepLink}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, deepLink: e.target.value }))
                    }
                  >
                    <FormControlLabel value="true" control={<Radio />} label="True" />
                    <FormControlLabel value="false" control={<Radio />} label="False" />
                  </RadioGroup>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset" required>
                  <FormLabel component="legend">Status</FormLabel>
                  <RadioGroup
                    row
                    value={newForm.status}
                    onChange={(e) =>
                      setNewForm((prev) => ({ ...prev, status: e.target.value }))
                    }
                  >
                    <FormControlLabel value="true" control={<Radio />} label="Active" />
                    <FormControlLabel value="false" control={<Radio />} label="Inactive" />
                  </RadioGroup>
                </FormControl>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
              sx={orangeBtnSx}
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </Button>
          </Stack>
        </DialogActions>
      </form>
    </Dialog>
  );
}
