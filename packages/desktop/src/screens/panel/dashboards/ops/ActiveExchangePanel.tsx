import { useState } from 'react';
import { Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  ACTIVE_EXCHANGE_MAP,
  PANEL_LABELS,
  activeExchangeJyotishLabel,
  toDisplayText,
} from './jyotishMapping';
import { useRevealCodes } from '@/context/useRevealCodes';

type Props = {
  activeExchangeName?: string;
  onUpdated?: () => void;
};

/** Active Exaltation panel — Dashboard / VIP / Combined. */
export function ActiveExchangePanel({ activeExchangeName, onUpdated }: Props) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  useRevealCodes();

  const update = async () => {
    const exchangeName = selected || activeExchangeName || '';
    if (!exchangeName) {
      toast.error('Choose an Exaltation type');
      return;
    }
    setSaving(true);
    try {
      const res = await secureApi('dashboard.activeExchangeUpdate', {
        exchangeName,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update Exaltation');
        return;
      }
      toast.success(res.message || 'Exaltation updated');
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper
      sx={{
        p: 2.5,
        mb: 2,
        bgcolor: 'background.paper',
        width: '100%',
        maxWidth: '100%',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="h6" fontWeight={800} mb={1}>
        {toDisplayText(PANEL_LABELS.title)}
      </Typography>
      <Typography variant="body2" fontWeight={700} mb={2}>
        {toDisplayText(PANEL_LABELS.activeName)}:
        <Typography component="span" fontWeight={800} ml={1}>
          {activeExchangeJyotishLabel(activeExchangeName)}
        </Typography>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
      >
        <TextField
          select
          label={toDisplayText(PANEL_LABELS.list)}
          size="small"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
        >
          <MenuItem value="">
            <em>{toDisplayText(PANEL_LABELS.chooseType)}</em>
          </MenuItem>
          {ACTIVE_EXCHANGE_MAP.map(({ jyotish, original }) => (
            <MenuItem key={original} value={original}>
              {toDisplayText(jyotish)}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          color="warning"
          onClick={() => void update()}
          disabled={saving}
          sx={{ fontWeight: 800, flexShrink: 0 }}
        >
          Update
        </Button>
      </Stack>
    </Paper>
  );
}
