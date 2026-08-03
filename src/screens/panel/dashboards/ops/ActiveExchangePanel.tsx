import { useState } from 'react';
import {
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';

const EXCHANGES = ['AAA', 'FALCON', 'JETFAIR'] as const;

type Props = {
  activeExchangeName?: string;
  onUpdated?: () => void;
};

/** Active Exchange panel — main Dashboard only (laxminarayan). */
export function ActiveExchangePanel({ activeExchangeName, onUpdated }: Props) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);

  const update = async () => {
    const exchangeName = selected || activeExchangeName || '';
    if (!exchangeName) {
      toast.error('Choose an exchange type');
      return;
    }
    setSaving(true);
    try {
      const res = await secureApi('dashboard.activeExchangeUpdate', {
        exchangeName,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update exchange');
        return;
      }
      toast.success(res.message || 'Exchange updated');
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
        bgcolor: '#1a1a1f',
        width: '100%',
        maxWidth: '100%',
        border: '1px solid',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Typography variant="h6" fontWeight={800} mb={1}>
        Active Exchange
      </Typography>
      <Typography variant="body2" fontWeight={700} mb={2}>
        Active Exchange Name:
        <Typography component="span" fontWeight={800} ml={1}>
          {activeExchangeName || '—'}
        </Typography>
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
      >
        <TextField
          select
          label="Exchange List"
          size="small"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
        >
          <MenuItem value="">
            <em>Choose Exchange Type</em>
          </MenuItem>
          {EXCHANGES.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
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
