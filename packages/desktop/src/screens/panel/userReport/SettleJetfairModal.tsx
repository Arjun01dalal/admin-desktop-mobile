import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';

type Props = {
  open: boolean;
  onClose: () => void;
};

const PLACEHOLDER =
  '{"agentUsername":"","secretKey":"","siteCode":"","transactionCode":"SettledMarket","marketId":"","data":[]}';

/** Settle JetFair Bets — JSON payload modal (Laxmi). */
export function SettleJetfairModal({ open, onClose }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setError('');
    }
  }, [open]);

  const submit = async () => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      setError('Invalid JSON. Please check the payload format.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await secureApi('userReport.settleJetfair', payload);
      if (!res.ok) {
        setError(res.message || 'Failed to settle JetFair bets');
        return;
      }
      toast.success('JetFair bets settled successfully');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Settle JetFair Bets</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
          Enter the complete API payload below and submit.
        </Typography>
        <TextField
          multiline
          minRows={16}
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          sx={{
            '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontFamily: 'monospace' },
          }}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          disabled={busy || !text.trim()}
          onClick={() => void submit()}
        >
          {busy ? 'Submitting…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
