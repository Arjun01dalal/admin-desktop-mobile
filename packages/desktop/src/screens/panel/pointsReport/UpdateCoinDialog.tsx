import { FormEvent, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getSessionUser } from '@/auth/permissions';

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function UpdateCoinDialog({ open, userId, onClose, onSuccess }: Props) {
  const [coin, setCoin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    if (submitting) return;
    setCoin('');
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || !coin) return;

    const user = getSessionUser();
    setSubmitting(true);
    try {
      const res = await secureApi('reports.addCoin', {
        _id: userId,
        coin,
        updatedBy: {
          _id: user?._id,
          name: user?.name,
          coin,
        },
      });

      if (!res.ok) {
        toast.error(res.message || 'Failed to update coin limit');
        return;
      }

      toast.success('Coin Limits is Updated');
      setCoin('');
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <form onSubmit={handleSubmit}>
        <DialogTitle>Update Coin Limit</DialogTitle>
        <DialogContent>
          <TextField
            required
            type="number"
            label="Please enter Coin"
            fullWidth
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            margin="dense"
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Submit
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
