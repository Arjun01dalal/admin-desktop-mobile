
import { orangeBtnSx, type MidOption } from '@/screens/panel/transactions/shared';
import type { DepositRow } from '@/screens/panel/deposit/DepositCells';
import { formatAmount } from '@/utils/dates';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

export function DepositRejectDialog({
  open,
  saving,
  row,
  reason,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  row: DepositRow | null;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>Reject Deposit</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Order: {row?.orderId || '—'} · Amount: {formatAmount(row?.amount ?? 0)}
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Reject reason"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" color="error" disabled={saving} onClick={onSubmit}>
          {saving ? <CircularProgress size={16} /> : 'Reject'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DepositMidDialog({
  open,
  saving,
  selectedCount,
  mids,
  midValue,
  gatewayValue,
  gatewayNameOptions,
  onMidChange,
  onGatewayChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  selectedCount: number;
  mids: MidOption[];
  midValue: string;
  gatewayValue: string;
  gatewayNameOptions: string[];
  onMidChange: (value: string) => void;
  onGatewayChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Update Mid Name</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Selected deposits: <strong>{selectedCount}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
          Note: Select the value which you want to change.
        </Typography>
        <TextField
          select
          fullWidth
          size="small"
          label="Select Mid Name"
          value={midValue}
          onChange={(e) => onMidChange(e.target.value)}
          sx={{ mb: 2 }}
        >
          <MenuItem value="">—</MenuItem>
          {mids.map((m) => (
            <MenuItem key={String(m.mid)} value={String(m.mid)}>
              {m.mid}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          size="small"
          label="Select Payment Gateway Name"
          value={gatewayValue}
          onChange={(e) => onGatewayChange(e.target.value)}
        >
          <MenuItem value="">—</MenuItem>
          {gatewayNameOptions.map((g) => (
            <MenuItem key={g} value={g}>
              {g}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" disabled={saving} onClick={onSubmit} sx={orangeBtnSx}>
          {saving ? <CircularProgress size={16} /> : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
