import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import type { GameImageUpdateTarget } from './updateGameImage';
import { replaceS3WithCloudfront } from '@/utils/cdnUrl';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

type Props = {
  open: boolean;
  loading: boolean;
  target: GameImageUpdateTarget | null;
  onClose: () => void;
  onSubmit: (imagePath: string) => void;
};

/** Re-upload game image URL — calls top-games/update-image on submit. */
export function UpdateGameImageDialog({
  open,
  loading,
  target,
  onClose,
  onSubmit,
}: Props) {
  const [imagePath, setImagePath] = useState('');
  const trimmed = imagePath.trim();

  useEffect(() => {
    if (open) {
      setImagePath(target?.currentImageUrl || '');
    }
  }, [open, target?.currentImageUrl]);

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Update Game Image</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Game
              </Typography>
              <Typography fontWeight={700}>{target?.name || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Game ID
              </Typography>
              <Typography fontWeight={700}>{target?.gameId || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Provider
              </Typography>
              <Typography fontWeight={700}>{target?.provider || '—'}</Typography>
            </Box>
          </Stack>

          <TextField
            fullWidth
            label="Image URL"
            placeholder="https://d1abp4kt5r84bg.cloudfront.net/snake&ladder"
            value={imagePath}
            onChange={(e) => setImagePath(e.target.value)}
            disabled={loading}
            InputProps={{
              startAdornment: <ImageIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />

          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box sx={{ flex: 1, minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Current
              </Typography>
              {target?.currentImageUrl ? (
                <Box
                  component="img"
                  src={replaceS3WithCloudfront(target.currentImageUrl)}
                  alt={target.name}
                  sx={{
                    width: '100%',
                    maxHeight: 120,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No image
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 140 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                New preview
              </Typography>
              {trimmed ? (
                <Box
                  component="img"
                  src={replaceS3WithCloudfront(trimmed)}
                  alt="New preview"
                  sx={{
                    width: '100%',
                    maxHeight: 120,
                    objectFit: 'contain',
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Enter URL
                </Typography>
              )}
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!trimmed || loading}
          onClick={() => onSubmit(trimmed)}
          sx={orangeBtnSx}
        >
          {loading ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
