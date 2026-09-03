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

/**
 * Mandatory update UI — once an update is available / ready, the dialog cannot
 * be dismissed without installing (except transient check errors).
 */
export function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('A new update is available.');
  const [canInstall, setCanInstall] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const onAvailable = (d: UpdatePayload) => {
      setText(`Downloading required update ${d.version || ''}…`);
      setCanInstall(false);
      setIsError(false);
      setProgress(0);
      setVisible(true);
    };
    const onProgress = (d: UpdatePayload) => {
      const percent = Math.max(0, Math.min(100, Number(d.percent) || 0));
      setText(`Downloading required update… ${percent}%`);
      setProgress(percent);
      setIsError(false);
      setVisible(true);
    };
    const onReady = (d: UpdatePayload) => {
      setText(
        `Update ${d.version || ''} is ready. You must restart to continue — the current version can no longer be used.`,
      );
      setCanInstall(true);
      setIsError(false);
      setProgress(100);
      setVisible(true);
    };
    const onError = (d: UpdatePayload) => {
      console.warn('[update]', d.message || 'Update failed');
      setText(d.message || 'Update failed. Please try again later.');
      setCanInstall(false);
      setIsError(true);
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
    ? 'Update Required'
    : progress !== null
      ? 'Updating App'
      : isError
        ? 'Update Notice'
        : 'Update Required';

  if (!visible) return null;

  return (
    <Dialog
      open={visible}
      // Mandatory while downloading / ready — only errors may be dismissed.
      disableEscapeKeyDown={!isError}
      onClose={(_event, reason) => {
        if (isError) {
          setVisible(false);
          return;
        }
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
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
        {isError ? (
          <Button onClick={() => setVisible(false)} color="inherit">
            Close
          </Button>
        ) : null}
        {canInstall ? (
          <Button variant="contained" onClick={() => window.gcalc?.installUpdate?.()} autoFocus>
            Restart &amp; Update
          </Button>
        ) : !isError ? (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
            Please wait — update is required to continue
          </Typography>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
