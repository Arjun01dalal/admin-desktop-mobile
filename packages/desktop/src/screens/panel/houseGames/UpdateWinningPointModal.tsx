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

export default function UpdateWinningPointModal({
  isOpen,
  onClose,
  selectedItem,
  onSuccess,
}: Props) {
  useRevealCodes();
  const [status, setStatus] = useState('W');
  const [winingPoint, setWiningPoint] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const isWinType = String(selectedItem?.type ?? '').toLowerCase() === 'win';

  useEffect(() => {
    if (isOpen && selectedItem) {
      setStatus(String(selectedItem?.status ?? 'W'));
      setWiningPoint(String(selectedItem?.winingPoint ?? ''));
      setAmount(String(selectedItem?.amount ?? ''));
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

    let payload: Record<string, unknown>;

    if (isWinType) {
      if (amount === '' || Number.isNaN(Number(amount))) {
        toast.error('Please enter a valid amount');
        return;
      }
      payload = {
        _id: selectedItem._id,
        amount: Number(amount),
      };
    } else {
      if (!status) {
        toast.error('Please select status');
        return;
      }
      if (winingPoint === '' || Number.isNaN(Number(winingPoint))) {
        toast.error('Please enter a valid winning point');
        return;
      }
      payload = {
        _id: selectedItem._id,
        winingPoint: Number(winingPoint),
        status,
      };
    }

    setLoading(true);
    try {
      const res = await secureApi('houseGames.updateWiningPoint', payload);
      if (res.ok && res.success !== false) {
        toast.success(res.message || 'Winning point updated successfully');
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || 'Failed to update winning point');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update winning point');
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
      PaperProps={{ sx: { maxWidth: 380, bgcolor: 'background.paper' } }}
    >
      <DialogTitle>{toDisplayText('Update Winning Point')}</DialogTitle>
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
          label="Type"
          fullWidth
          value={String(selectedItem?.type ?? '')}
          disabled
        />
        {isWinType ? (
          <TextField
            margin="dense"
            label={toDisplayText('Amount')}
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
        ) : (
          <>
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
            <TextField
              margin="dense"
              label={toDisplayText('Winning Point')}
              type="number"
              fullWidth
              value={winingPoint}
              onChange={(e) => setWiningPoint(e.target.value)}
              placeholder="Enter winning point"
            />
          </>
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
