import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser } from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';

type Props = { userId: string };

const REASON_OPTIONS = [
  { value: 'manualBonusUserFirstDeposit', label: 'User First Deposit Bonus' },
  { value: 'manualBonusUserOtherDeposit', label: 'User Other Deposit Bonus' },
  { value: 'manualBonusReferralFirstDeposit', label: 'Referral First Deposit Bonus' },
  { value: 'manualBonusReferralOtherDeposit', label: 'Referral Other Deposit Bonus' },
  { value: 'other', label: 'Enter Manually' },
] as const;

/** Add Bonus Coins — port of Laxmi BonusWalletCoins (role-gated tab). */
export function AddBonusCoinsTab({ userId }: Props) {
  const admin = getStoredUser<{ _id?: string; name?: string }>();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!amount.trim() || Number(amount) <= 0) {
      toast.error('Please enter amount');
      return;
    }
    if (!reason) {
      toast.error('Please select reason');
      return;
    }
    setBusy(true);
    try {
      const res = await secureApi('userReport.addBonus', {
        bonusBy: {
          name: admin?.name || '',
          _id: admin?._id || '',
          type: reason,
          transaction: 'credit',
        },
        userId,
        amount,
        type: reason,
        remark: reason === 'other' ? remark : '',
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add bonus coins');
        return;
      }
      toast.success('Bonus coins added successfully');
      setAmount('');
      setReason('');
      setRemark('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <Box
        sx={{
          display: 'inline-block',
          textAlign: 'left',
          width: '100%',
          maxWidth: 400,
          p: 3,
          bgcolor: '#fff',
          borderRadius: 2,
          boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        }}
      >
        <Typography fontWeight={700} mb={2} color="#111" textAlign="center">
          Add Bonus Coins
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Amount"
            type="number"
            size="small"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TextField
            select
            label="Reason"
            size="small"
            fullWidth
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REASON_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          {reason === 'other' ? (
            <TextField
              label="Enter Reason Remark"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          ) : null}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <Button
              variant="contained"
              color="inherit"
              disableElevation
              disabled={busy}
              sx={laxmiActionBtnSx('white')}
              onClick={() => void submit()}
              startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
            >
              Add Bonus Coins
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
