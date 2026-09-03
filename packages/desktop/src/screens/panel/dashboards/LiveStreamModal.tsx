import { Box, Grid, IconButton, Modal, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { toDisplayText } from './ops/jyotishMapping';

type Props = {
  open: boolean;
  onClose: () => void;
  streamId: string;
};

/** Live TV / score iframes — ported from laxminarayan LiveStreamModal. */
export function LiveStreamModal({ open, onClose, streamId }: Props) {
  const id = String(streamId || '').trim();
  const streamUrl = `https://aaa.aaryapaar.exchange/sports/exchange/live-stream/${id}`;
  const scoreUrl = `https://aaa.aaryapaar.exchange/sports/exchange/live-score/${id}`;

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: 900,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 24,
          p: 2,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography fontWeight="bold">{toDisplayText('Live Match')}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box
              sx={{
                width: '100%',
                height: 80,
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: '#000',
              }}
            >
              {id ? (
                <iframe
                  src={scoreUrl}
                  width="100%"
                  height="100%"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ border: 'none' }}
                  title="Live Score"
                />
              ) : null}
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Box
              sx={{
                width: '100%',
                height: { xs: 200, md: 350 },
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: '#000',
              }}
            >
              {id ? (
                <iframe
                  src={streamUrl}
                  width="100%"
                  height="100%"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ border: 'none' }}
                  title="Live Stream"
                />
              ) : null}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
}
