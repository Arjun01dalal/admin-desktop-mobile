import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser, todayIST } from '@/utils/dates';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { MidOption } from '@/screens/panel/transactions/shared';
import type { DepositRow } from './DepositCells';
import {
  defaultSettleReason,
  isUpiGateway,
  settleReasonOptions,
} from './logic';

type Props = {
  open: boolean;
  row: DepositRow | null;
  mids: MidOption[];
  onClose: () => void;
  onDone: () => void;
  onReject: (row: DepositRow) => void;
};

/** Simplified manual settle (lax openEditDialog + submitManualSettle). */
export function SettleDialog({ open, row, mids, onClose, onDone, onReject }: Props) {
  const admin = getStoredUser<{ _id?: string; name?: string }>();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [mid, setMid] = useState('');
  const [gateway, setGateway] = useState('');
  const [utr, setUtr] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIST());
  const [saving, setSaving] = useState(false);

  const reasons = useMemo(() => (row ? settleReasonOptions(row) : []), [row]);

  useEffect(() => {
    if (!open || !row) return;
    setAmount(String(row.amount ?? ''));
    setReason(defaultSettleReason(row));
    setMid(row.mid != null ? String(row.mid) : '');
    setGateway(row.paymentGatewayName || '');
    setUtr('');
    setPaymentDate(todayIST());
  }, [open, row]);

  const submit = async () => {
    if (!row?.orderId || !row.userId) {
      toast.error('Missing order / user');
      return;
    }
    const utrValue = utr.trim();
    if (!utrValue) {
      toast.error('Please enter UTR NO');
      return;
    }
    if (utrValue.length <= 10) {
      toast.error('UTR NO length should be more than 10 characters');
      return;
    }
    if (!reason.trim()) {
      toast.error('Select reason');
      return;
    }

    setSaving(true);
    try {
      if (gateway && gateway !== row.paymentGatewayName) {
        await secureApi('deposits.updateGatewayName', {
          _id: row._id,
          paymentGatewayName: gateway,
        });
      }

      const payload: Record<string, unknown> = {
        userId: row.userId,
        balance: Number(amount) || row.amount,
        updatedBy: {
          name: admin?.name || '',
          _id: admin?._id || '',
        },
        reason: reason.trim(),
        remark: `Deposit failure of ${row.userName || ''} through ${gateway || row.paymentGatewayName || ''} pay with order id ${row.orderId} and mobile no ${row.userMobile || row.mobile || ''}`,
        tag: 'credit',
        orderId: row.orderId,
        mid: mid || row.mid,
        paymentDate,
        utr: utrValue,
      };
      if (reason.startsWith('manual-deposit-')) {
        payload.type = 'paymentGatewayManualDeposit';
      }

      const action = isUpiGateway(row.paymentGatewayName)
        ? 'upiPayments.addCoin'
        : 'deposits.addCoin';
      const res = await secureApi(action, payload);
      if (!res.ok) {
        toast.error(res.message || 'Settle failed');
        return;
      }
      toast.success(res.message || 'Settled successfully');
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Manual Settle Transaction</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          {row?.userName || '—'} · {row?.orderId || '—'}
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            size="small"
            label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
          />
          <TextField
            select
            size="small"
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
          >
            {reasons.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Mid"
            value={mid}
            onChange={(e) => setMid(e.target.value)}
            fullWidth
          >
            <MenuItem value="">—</MenuItem>
            {mids.map((m) => (
              <MenuItem key={String(m.mid)} value={String(m.mid)}>
                {m.mid}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Payment Gateway"
            value={gateway}
            onChange={(e) => setGateway(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            type="date"
            label="Payment Date"
            InputLabelProps={{ shrink: true }}
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            fullWidth
          />
          <TextField
            size="small"
            label="UTR NO"
            value={utr}
            onChange={(e) => setUtr(e.target.value)}
            fullWidth
            required
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        {row ? (
          <Button
            color="error"
            variant="outlined"
            disabled={saving}
            onClick={() => onReject(row)}
          >
            Reject
          </Button>
        ) : null}
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => void submit()}
          sx={orangeBtnSx}
        >
          {saving ? <CircularProgress size={16} /> : 'Settle'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
