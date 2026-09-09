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
import { canAddCoinsAction, canRemoveCoinsAction } from './coinAccess';

type Props = { userId: string };

/** White card on dark panel — borders must be explicit (theme outline is light/invisible). */
const lightFormFieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    color: '#111',
    fontSize: 13,
    borderRadius: '8px',
    '& fieldset': { borderColor: '#c4cad3', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#98a2b3' },
    '&.Mui-focused fieldset': { borderColor: '#1976d2', borderWidth: '1.5px' },
  },
  '& .MuiInputBase-input': {
    color: '#111 !important',
    WebkitTextFillColor: '#111 !important',
    py: '10px',
  },
  '& .MuiInputLabel-root': {
    color: '#667085',
    '&.Mui-focused': { color: '#1976d2' },
  },
  '& .MuiFormLabel-asterisk': { color: '#d32f2f' },
  '& .MuiSelect-icon': { color: '#5c6470' },
} as const;

const NO_GLOW = {
  boxShadow: 'none !important',
  backgroundImage: 'none !important',
  filter: 'none',
} as const;

const addBtnSx = {
  ...NO_GLOW,
  textTransform: 'none' as const,
  bgcolor: '#1976d2',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
  px: 2.5,
  py: 0.9,
  borderRadius: '8px',
  minHeight: 40,
  minWidth: 128,
  border: '1px solid #1565c0',
  '&:hover': { ...NO_GLOW, bgcolor: '#1565c0' },
  '&.Mui-disabled': {
    bgcolor: '#90caf9',
    color: '#fff',
    borderColor: '#90caf9',
  },
};

const removeBtnSx = {
  ...NO_GLOW,
  textTransform: 'none' as const,
  bgcolor: '#fff',
  color: '#c62828',
  fontWeight: 700,
  fontSize: 13,
  px: 2.5,
  py: 0.9,
  borderRadius: '8px',
  minHeight: 40,
  minWidth: 128,
  border: '1px solid #e57373',
  '&:hover': { ...NO_GLOW, bgcolor: '#fff5f5', borderColor: '#c62828' },
  '&.Mui-disabled': {
    bgcolor: '#f5f5f5',
    color: '#bdbdbd',
    borderColor: '#e0e0e0',
  },
};

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
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.payload) ? raw.payload : [];
      setMids(list.filter((m) => m?.mid));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const minDate = useMemo(() => (canBackDate ? undefined : threeDaysAgoISO()), [canBackDate]);
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
      toast.success(mode === 'add' ? 'Coins Added Successfully' : 'Coins removed Successfully');
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
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3, px: 1 }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 2.5, sm: 3 },
          bgcolor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e4e7ec',
          boxShadow: '0 10px 32px rgba(15,23,42,0.10)',
        }}
      >
        <Typography
          fontWeight={800}
          mb={0.5}
          color="#101828"
          textAlign="center"
          fontSize={18}
          letterSpacing={0.2}
        >
          Coins
        </Typography>
        <Typography
          mb={2.5}
          color="#667085"
          textAlign="center"
          fontSize={12}
          lineHeight={1.4}
        >
          Credit or debit coins for this user
        </Typography>

        <Stack spacing={2}>
          <TextField
            label="Amount"
            required
            type="number"
            size="small"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            inputProps={{ min: 0, step: 'any' }}
            sx={lightFormFieldSx}
          />
          <TextField
            select
            label="Reason"
            required
            size="small"
            fullWidth
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setSelectedMid(null);
            }}
            sx={lightFormFieldSx}
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
              sx={lightFormFieldSx}
            />
          ) : null}

          {TXN_ID_REASONS.has(reason) ? (
            <TextField
              label="Transaction ID"
              size="small"
              fullWidth
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Optional"
              sx={lightFormFieldSx}
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
                placeholder="Optional"
                sx={lightFormFieldSx}
              />
              <TextField
                label="Transaction ID"
                size="small"
                fullWidth
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="Optional"
                sx={lightFormFieldSx}
              />
              <Autocomplete
                size="small"
                options={mids}
                getOptionLabel={(o) => String(o.mid || '')}
                value={selectedMid}
                onChange={(_e, next) => setSelectedMid(next)}
                isOptionEqualToValue={(a, b) => a.mid === b.mid}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search & Select MID"
                    required
                    placeholder="Type to search"
                    sx={lightFormFieldSx}
                  />
                )}
              />
            </>
          ) : null}

          <TextField
            label="Remark"
            required
            size="small"
            fullWidth
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter remark"
            multiline
            minRows={2}
            sx={lightFormFieldSx}
          />

          <Stack
            direction="row"
            spacing={1.5}
            justifyContent="center"
            alignItems="center"
            pt={1.5}
            flexWrap="wrap"
            useFlexGap
          >
            {busy ? <CircularProgress size={22} sx={{ color: '#1976d2' }} /> : null}
            {canAdd ? (
              <Button
                variant="contained"
                disableElevation
                disabled={busy}
                sx={addBtnSx}
                onClick={() => void submit('add')}
              >
                Add Coins
              </Button>
            ) : null}
            {canRemove ? (
              <Button
                variant="outlined"
                disableElevation
                disabled={busy}
                sx={removeBtnSx}
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
