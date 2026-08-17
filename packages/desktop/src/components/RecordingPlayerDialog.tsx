import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

type RecordingPlayerDialogProps = {
  url: string | null;
  onClose: () => void;
};

export function RecordingPlayerDialog({
  url,
  onClose,
}: RecordingPlayerDialogProps) {
  const streamUrl = useMemo(
    () => (url ? window.gcalc?.recordingUrl(url) || '' : ''),
    [url],
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(url && !streamUrl ? 'Unsupported recording URL.' : '');
    setLoading(Boolean(streamUrl));
  }, [url, streamUrl]);

  /** The media element only reports "error" — ask the proxy why it failed. */
  const explainFailure = useCallback(async () => {
    setLoading(false);
    if (!streamUrl) return;
    try {
      const res = await fetch(streamUrl);
      if (!res.ok) {
        const detail = (await res.text()).trim();
        setError(detail || `Recording could not be loaded (${res.status}).`);
        return;
      }
      setError('This recording is not in a playable audio format.');
    } catch {
      setError('Recording could not be reached.');
    }
  }, [streamUrl]);

  return (
    <Dialog open={Boolean(url)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Call Recording</DialogTitle>
      <DialogContent>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            {loading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Loading recording…
                </Typography>
              </Stack>
            )}
            <Box
              component="audio"
              key={streamUrl}
              src={streamUrl || undefined}
              controls
              autoPlay
              preload="auto"
              onLoadedMetadata={() => setLoading(false)}
              onCanPlay={() => setLoading(false)}
              onError={() => void explainFailure()}
              sx={{ display: 'block', width: '100%' }}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
