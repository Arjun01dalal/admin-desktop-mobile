import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { useRevealCodes } from '@/context/useRevealCodes';
import type { HouseGameTransaction } from './types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  selectedItem: HouseGameTransaction | null;
  onSuccess: () => void;
};

export default function UpdateBetStatusModal({
  isOpen,
  onClose,
  selectedItem,
  onSuccess,
}: Props) {
  useRevealCodes();
  const [status, setStatus] = useState('');
  const [winningAmount, setWinningAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && selectedItem) {
      setStatus(String(selectedItem?.status ?? ''));
      setWinningAmount(
        String(selectedItem?.winningAmount ?? selectedItem?.amount ?? ''),
      );
    }
  }, [isOpen, selectedItem]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedItem?._id) {
      toast.error('Invalid transaction selected');
      return;
    }
    if (!status) {
      toast.error('Please select status');
      return;
    }
    if (status === 'W' && !winningAmount) {
      toast.error('Please enter winning amount');
      return;
    }

    const payload: Record<string, unknown> = {
      _id: selectedItem._id,
      status,
    };
    if (status === 'W') {
      payload.winningAmount = Number(winningAmount);
    }

    setLoading(true);
    try {
      const res = await secureApi('houseGames.updateBetStatus', payload);
      if (res.ok && res.success !== false) {
        toast.success(res.message || 'Bet status updated successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || 'Failed to update bet status');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update bet status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { maxWidth: 380, bgcolor: '#1a1a1f' } }}
    >
      <DialogTitle>{toDisplayText('Update Bet Status')}</DialogTitle>
      <DialogContent>
        <TextField
          margin="dense"
          label="Document ID"
          fullWidth
          value={String(selectedItem?._id ?? '')}
          disabled
        />
        <TextField
          margin="dense"
          label="Status"
          select
          fullWidth
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <MenuItem value="L">{toDisplayText('Loss')} (L)</MenuItem>
          <MenuItem value="R">{toDisplayText('Refund')} (R)</MenuItem>
          <MenuItem value="W">{toDisplayText('Win')} (W)</MenuItem>
        </TextField>
        {status === 'W' && (
          <TextField
            margin="dense"
            label={toDisplayText('Winning Amount')}
            type="number"
            fullWidth
            value={winningAmount}
            onChange={(e) => setWinningAmount(e.target.value)}
            placeholder="Enter winning amount"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Updating...' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
