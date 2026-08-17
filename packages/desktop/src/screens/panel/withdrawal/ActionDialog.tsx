import {
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
import { fieldSx, orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { MidOption } from '@/screens/panel/transactions/shared';
import { ACTION_STATUSES, MANUAL_GATEWAYS } from './types';
import { midLabel } from './logic';

type Props = {
  open: boolean;
  saving: boolean;
  status: string;
  remark: string;
  gateway: string;
  mid: string;
  payoutGateways: string[];
  mids: MidOption[];
  onStatus: (v: string) => void;
  onRemark: (v: string) => void;
  onGateway: (v: string) => void;
  onMid: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};


/** Approve / Reject / Reverse / Manual / On Hold dialog. */
export function ActionDialog({
  open,
  saving,
  status,
  remark,
  gateway,
  mid,
  payoutGateways,
  mids,
  onStatus,
  onRemark,
  onGateway,
  onMid,
  onClose,
  onSubmit,
}: Props) {
  const needsGatewayMid = !['Approved', 'Reverse', 'on hold'].includes(status);
  const gatewayOptions =
    status === 'Manual Approved' || status === 'Rejected'
      ? Array.from(new Set([...MANUAL_GATEWAYS, ...payoutGateways]))
      : payoutGateways;

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: 'background.paper' } }}
    >
      <DialogTitle>Update Withdrawal Status</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            fullWidth
            label="Status"
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            sx={fieldSx}
          >
            {ACTION_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Remark"
            value={remark}
            onChange={(e) => onRemark(e.target.value)}
            sx={fieldSx}
            helperText={status === 'Approved' ? 'Defaults to "Approved"' : 'Required for non-approve actions'}
          />
          {needsGatewayMid ? (
            <>
              <TextField
                select
                fullWidth
                label="Gateway"
                value={gateway}
                onChange={(e) => onGateway(e.target.value)}
                sx={fieldSx}
              >
                <MenuItem value="">— Choose —</MenuItem>
                {gatewayOptions.map((g) => (
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
                sx={fieldSx}
              >
                <MenuItem value="">— Choose —</MenuItem>
                {mids.map((m, i) => (
                  <MenuItem key={`${m.mid ?? ''}-${i}`} value={String(m.mid ?? '')}>
                    {midLabel(m)}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Gateway / Mid optional for {status}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button variant="contained" disabled={saving} onClick={onSubmit} sx={orangeBtnSx}>
          {saving ? '…' : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
