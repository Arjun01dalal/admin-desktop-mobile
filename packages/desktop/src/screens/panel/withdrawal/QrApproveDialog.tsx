import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { MidOption } from '@/screens/panel/transactions/shared';
import { MANUAL_GATEWAYS } from './types';
import type { WithdrawalRow } from './types';
import { midLabel, sendToBankName } from './logic';
import { UpiQr } from './UpiQr';

type Props = {
  open: boolean;
  saving: boolean;
  row: WithdrawalRow | null;
  gateway: string;
  mid: string;
  mids: MidOption[];
  payoutGateways: string[];
  onGateway: (v: string) => void;
  onMid: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const fieldBg = { '& .MuiInputBase-root': { bgcolor: '#121218' } };

/** QR approve dialog — show UPI QR, pick gateway/mid, approve with reason "By UPI ID". */
export function QrApproveDialog({
  open,
  saving,
  row,
  gateway,
  mid,
  mids,
  payoutGateways,
  onGateway,
  onMid,
  onClose,
  onSubmit,
}: Props) {
  const gateways = Array.from(new Set([...MANUAL_GATEWAYS, ...payoutGateways]));
  const note = row
    ? `Note:${sendToBankName(row)}`
    : '';

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { bgcolor: 'background.paper' } }}
    >
      <DialogTitle>QR Code Approve</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ mt: 1 }}>
          {row?.upiId ? (
            <Box
              sx={{
                p: 1.5,
                bgcolor: '#fff',
                borderRadius: 1,
                display: 'inline-flex',
              }}
            >
              <UpiQr
                pa={row.upiId}
                am={row.amount}
                tn={note}
                tr={`ORD-${Date.now()}`}
              />
            </Box>
          ) : (
            <Typography color="warning.main" variant="body2">
              No UPI ID on this withdrawal
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {row?.accountHolderName || row?.userName || '—'} ·{' '}
            {row?.amount != null ? row.amount : '—'}
            {row?.upiId ? (
              <>
                <br />
                {row.upiId}
              </>
            ) : null}
          </Typography>
          <TextField
            select
            fullWidth
            label="Gateway"
            value={gateway}
            onChange={(e) => onGateway(e.target.value)}
            sx={fieldBg}
          >
            <MenuItem value="">— Choose —</MenuItem>
            {gateways.map((g) => (
              <MenuItem key={g} value={g}>
                {g}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            fullWidth
            label="Mid"
            value={mid}
            onChange={(e) => onMid(e.target.value)}
            sx={fieldBg}
          >
            <MenuItem value="">— Choose —</MenuItem>
            {mids.map((m, i) => (
              <MenuItem key={`${m.mid ?? ''}-${i}`} value={String(m.mid ?? '')}>
                {midLabel(m)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving || !row?.upiId}
          onClick={onSubmit}
          sx={orangeBtnSx}
        >
          {saving ? '…' : 'Submit to Approve'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
