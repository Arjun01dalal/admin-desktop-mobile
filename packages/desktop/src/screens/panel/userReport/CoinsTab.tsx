import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
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
import { hasPermission } from '@/auth/permissions';
import { useLocationController } from '@/controllers/LocationProvider';
import { getStoredUser, todayIST } from '@/utils/dates';
import { requireWithdrawalGeo } from '@/screens/panel/withdrawal/geo';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import { canAddCoinsAction, canRemoveCoinsAction } from './coinAccess';

type Props = { userId: string };

type MidOption = { mid?: string; _id?: string; name?: string };

const REASON_OPTIONS = [
  'Scanner Deposit',
  'Testing',
  'Coin Removed',
  'transfer',
  'Casino',
  'Exchange',
  'Satta Matka',
] as const;

const NO_DATE_REASONS = new Set(['Exchange', 'Casino', 'Satta Matka', 'transfer']);
const TXN_ID_REASONS = new Set(['Exchange', 'Casino', 'Satta Matka']);
const UTR_MID_REASONS = new Set(['Scanner Deposit', 'Testing', 'Coin Removed']);

function threeDaysAgoISO(): string {
  return new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** Coins tab — port of Laxmi Components/Coins/Coin.tsx (role-gated actions). */
export function CoinsTab({ userId }: Props) {
  const loc = useLocationController();
  const admin = getStoredUser<{ _id?: string; name?: string }>();
  const canAdd = canAddCoinsAction();
  const canRemove = canRemoveCoinsAction();
  const canBackDate = hasPermission('show_back_date');

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [remark, setRemark] = useState('');
  const [utr, setUtr] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [mids, setMids] = useState<MidOption[]>([]);
  const [selectedMid, setSelectedMid] = useState<MidOption | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await secureApi<{ payload?: MidOption[] } | MidOption[]>(
        'reports.getAllMidOld',
        {},
      );
      if (cancelled || !res.ok) return;
      const raw = res.data as { payload?: MidOption[] } | MidOption[] | null;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.payload)
          ? raw.payload
          : [];
      setMids(list.filter((m) => m?.mid));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const minDate = useMemo(
    () => (canBackDate ? undefined : threeDaysAgoISO()),
    [canBackDate],
  );
  const maxDate = todayIST();

  const submit = async (mode: 'add' | 'remove') => {
    if (!amount.trim() || Number(amount) <= 0) {
      toast.error('Please enter amount');
      return;
    }
    if (!reason) {
      toast.error('Reason is Required');
      return;
    }
    if (!remark.trim()) {
      toast.error('Remark Is Required');
      return;
    }
    if (UTR_MID_REASONS.has(reason) && !selectedMid?.mid) {
      toast.error('Mid Is Required');
      return;
    }

    const geo = await requireWithdrawalGeo(loc);
    if (!geo) return;

    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        userId,
        balance: Number(amount),
        updatedBy: {
          name: admin?.name || '',
          _id: admin?._id || '',
          city: geo.city,
          state: geo.state,
          lat: geo.lat,
          long: geo.long,
        },
        reason,
        remark: remark.trim(),
        tag: mode === 'add' ? 'credit' : 'debit',
      };
      if (utr.trim()) payload.utr = utr.trim();
      if (transactionId.trim()) payload.transactionId = transactionId.trim();
      if (UTR_MID_REASONS.has(reason) && selectedMid?.mid) {
        payload.mid = selectedMid.mid;
      }
      if (!NO_DATE_REASONS.has(reason) && paymentDate) {
        payload.paymentDate = paymentDate;
      }

      const res = await secureApi('userReport.addCoin', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update coins');
        return;
      }
      toast.success(
        mode === 'add' ? 'Coins Added Successfully' : 'Coins removed Successfully',
      );
      setAmount('');
      setReason('');
      setRemark('');
      setUtr('');
      setTransactionId('');
      setPaymentDate('');
      setSelectedMid(null);
    } finally {
      setBusy(false);
    }
  };

  if (!canAdd && !canRemove) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          You do not have permission to add or remove coins.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <Box
        sx={{
          display: 'inline-block',
          textAlign: 'left',
          width: '100%',
          maxWidth: 420,
          p: 3,
          bgcolor: '#fff',
          borderRadius: 2,
          boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
        }}
      >
        <Typography fontWeight={700} mb={2} color="#111" textAlign="center">
          Coins
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Amount *"
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
            onChange={(e) => {
              setReason(e.target.value);
              setSelectedMid(null);
            }}
          >
            {REASON_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>

          {reason && !NO_DATE_REASONS.has(reason) ? (
            <TextField
              label="Date"
              type="date"
              size="small"
              fullWidth
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: minDate, max: maxDate }}
            />
          ) : null}

          {TXN_ID_REASONS.has(reason) ? (
            <TextField
              label="TransactionId"
              size="small"
              fullWidth
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          ) : null}

          {UTR_MID_REASONS.has(reason) ? (
            <>
              <TextField
                label="UTR"
                size="small"
                fullWidth
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
              />
              <TextField
                label="TransactionId"
                size="small"
                fullWidth
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
              <Autocomplete
                size="small"
                options={mids}
                getOptionLabel={(o) => String(o.mid || '')}
                value={selectedMid}
                onChange={(_e, next) => setSelectedMid(next)}
                isOptionEqualToValue={(a, b) => a.mid === b.mid}
                renderInput={(params) => (
                  <TextField {...params} label="Search & Select MID" />
                )}
              />
            </>
          ) : null}

          <TextField
            label="Remark *"
            size="small"
            fullWidth
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            multiline
            minRows={2}
          />

          <Stack direction="row" spacing={1.5} justifyContent="center" pt={1}>
            {busy ? <CircularProgress size={22} /> : null}
            {canAdd ? (
              <Button
                variant="contained"
                color="inherit"
                disableElevation
                disabled={busy}
                sx={laxmiActionBtnSx('white')}
                onClick={() => void submit('add')}
              >
                Add Coins
              </Button>
            ) : null}
            {canRemove ? (
              <Button
                variant="contained"
                color="inherit"
                disableElevation
                disabled={busy}
                sx={laxmiActionBtnSx('white')}
                onClick={() => void submit('remove')}
              >
                Remove Coins
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
