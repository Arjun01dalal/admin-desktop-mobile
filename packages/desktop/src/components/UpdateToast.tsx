import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

type UpdatePayload = {
  version?: string;
  percent?: number;
  message?: string;
};

export function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('A new update is available.');
  const [canInstall, setCanInstall] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    const onAvailable = (d: UpdatePayload) => {
      setText(`Downloading update ${d.version || ''}…`);
      setCanInstall(false);
      setProgress(0);
      setVisible(true);
    };
    const onProgress = (d: UpdatePayload) => {
      const percent = Math.max(0, Math.min(100, Number(d.percent) || 0));
      setText(`Downloading update… ${percent}%`);
      setProgress(percent);
      setVisible(true);
    };
    const onReady = (d: UpdatePayload) => {
      setText(`Update ${d.version || ''} is ready to install.`);
      setCanInstall(true);
      setProgress(100);
      setVisible(true);
    };
    const onError = (d: UpdatePayload) => {
      console.warn('[update]', d.message || 'Update failed');
      setText(d.message || 'Update failed. Please try again later.');
      setCanInstall(false);
      setProgress(null);
      setVisible(true);
    };

    window.gcalc?.onUpdateAvailable?.(onAvailable);
    window.gcalc?.onUpdateProgress?.(onProgress);
    window.gcalc?.onUpdateReady?.(onReady);
    window.gcalc?.onUpdateError?.(onError);

    // Replay if main already found an update before React mounted.
    void window.gcalc?.getUpdateStatus?.().then((evt) => {
      if (!evt?.channel) return;
      if (evt.channel === 'update:available') onAvailable(evt.payload || {});
      else if (evt.channel === 'update:progress') onProgress(evt.payload || {});
      else if (evt.channel === 'update:ready') onReady(evt.payload || {});
      else if (evt.channel === 'update:error') onError(evt.payload || {});
    });
  }, []);

  const title = canInstall
    ? 'Update Ready'
    : progress !== null
      ? 'Updating App'
      : 'Update Notice';

  if (!visible) return null;

  return (
    <Dialog
      open={visible}
      onClose={() => {
        if (!canInstall) setVisible(false);
      }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {text}
          </Typography>
          {progress !== null && (
            <Stack spacing={0.75}>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption" color="text.secondary">
                {Math.round(progress)}% completed
              </Typography>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => setVisible(false)} color="inherit">
          {canInstall ? 'Later' : 'Hide'}
        </Button>
        {canInstall && (
          <Button
            variant="contained"
            onClick={() => window.gcalc?.installUpdate?.()}
          >
            Restart &amp; Update
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
