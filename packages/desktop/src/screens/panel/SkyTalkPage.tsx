import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

const SKYTALK_URL = 'https://skytalk.site';

/**
 * Embeds Sky Talk. Remounts (fresh iframe key) whenever this route mounts,
 * so each visit to the side-nav item reloads skytalk.site.
 */
export function SkyTalkPage() {
  const [frameKey, setFrameKey] = useState(() => Date.now());

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: 'calc(100vh - 120px)',
        minHeight: 480,
        gap: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={700}>
          Sky Talk
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => setFrameKey(Date.now())}
        >
          Refresh
        </Button>
      </Stack>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <iframe
          key={frameKey}
          src={SKYTALK_URL}
          title="Sky Talk"
          width="100%"
          height="100%"
          allow="microphone; camera; clipboard-read; clipboard-write; autoplay"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          style={{ border: 'none', display: 'block' }}
        />
      </Box>
    </Box>
  );
}
