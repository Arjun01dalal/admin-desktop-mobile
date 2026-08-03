import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser } from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';

type Props = { userId: string };

/** Remove Bonus Coins — centered popup form + confirm dialog. */
export function RemoveBonusTab({ userId }: Props) {
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const admin = getStoredUser<{ _id?: string; name?: string }>();

  const openConfirm = () => {
    if (!amount.trim()) {
      toast.error('Please enter amount');
      return;
    }
    if (!remark.trim()) {
      toast.error('Please enter remark');
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const res = await secureApi('userReport.removeBonus', {
        bonusBy: {
          name: admin?.name || '',
          _id: admin?._id || '',
          type: 'remove bonus',
          transaction: 'credit',
        },
        userId,
        amount,
        type: 'remove bonus',
        remark,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to remove bonus');
        return;
      }
      toast.success('Bonus coins removed successfully');
      setAmount('');
      setRemark('');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Box
          sx={{
            display: 'inline-block',
            textAlign: 'left',
            width: '100%',
            maxWidth: 360,
            p: 3,
            bgcolor: '#fff',
            borderRadius: 2,
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
          }}
        >
          <Typography fontWeight={700} mb={2} color="#111" textAlign="center">
            Remove Bonus Coins
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontSize: 13, mb: 0.5, color: '#333' }}>
                Amount
              </Typography>
              <TextField
                label="Enter Amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                fullWidth
                size="small"
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, mb: 0.5, color: '#333' }}>
                Remark
              </Typography>
              <TextField
                label="Enter Remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
              />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
              <Button
                variant="contained"
                color="inherit"
                disableElevation
                disableRipple
                sx={laxmiActionBtnSx('white')}
                onClick={openConfirm}
              >
                Remove Bonus Coins
              </Button>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)}>
        <DialogTitle>Remove Bonus Coins</DialogTitle>
        <DialogContent>
          <Typography>
            Remove <b>{amount}</b> bonus coins from this user?
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Remark: {remark}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? 'Processing…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
