import { useCallback, useEffect, useState } from 'react';

import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { RestrictedGatewaysModal } from './RestrictedGatewaysModal';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import { extractRestrictedGatewayNames } from '@astro/shared';
import { secureApi } from '@/api/secureClient';



export function RestrictedGatewaysPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowedNames, setAllowedNames] = useState<string[]>([]);

  const loadAllowed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('restrictedGateways.get', {});
      if (!res.ok) {
        setAllowedNames([]);
        return;
      }
      setAllowedNames(extractRestrictedGatewayNames(res.data));
    } catch {
      setAllowedNames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllowed();
  }, [loadAllowed]);

  return (
    <>
      <Paper
        sx={{
          p: 1.5,
          mb: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1.5}
          flexWrap="wrap"
          sx={{ mb: 1 }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>
              Restricted Gateway
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Allowed gateways from GET API
            </Typography>
          </Box>
          <Button size="small" variant="contained" sx={orangeBtnSx} onClick={() => setOpen(true)}>
            Edit Gateways
          </Button>
        </Stack>

        {loading ? (
          <CircularProgress size={18} />
        ) : allowedNames.length ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
            {allowedNames.map((name) => (
              <Chip key={name} size="small" color="primary" label={name} />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No restricted gateways configured yet. Click Edit Gateways to set.
          </Typography>
        )}
      </Paper>

      <RestrictedGatewaysModal
        open={open}
        onClose={() => setOpen(false)}
        onAllowedChange={setAllowedNames}
      />
    </>
  );
}
