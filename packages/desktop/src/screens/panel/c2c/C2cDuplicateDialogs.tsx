import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { C2cCallerOption, C2cCampaign } from '@astro/shared';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';

type Props = {
  choiceOpen: boolean;
  formOpen: boolean;
  source: C2cCampaign | null;
  name: string;
  active: boolean;
  callerIds: string[];
  callers: C2cCallerOption[];
  duplicating: boolean;
  onClose: () => void;
  onKeepSame: () => void;
  onOpenForm: () => void;
  onName: (v: string) => void;
  onActive: (v: boolean) => void;
  onCallerIds: (ids: string[]) => void;
  onSubmitForm: () => void;
};

export function C2cDuplicateDialogs({
  choiceOpen,
  formOpen,
  source,
  name,
  active,
  callerIds,
  callers,
  duplicating,
  onClose,
  onKeepSame,
  onOpenForm,
  onName,
  onActive,
  onCallerIds,
  onSubmitForm,
}: Props) {
  return (
    <>
      <Dialog open={choiceOpen} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>Duplicate campaign</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {source?.campaignName
              ? `Duplicate "${source.campaignName}" with the same details, or change name / callers / status first?`
              : 'Keep the same details, or change name / callers / status first?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={duplicating}>
            Cancel
          </Button>
          <Button onClick={onKeepSame} disabled={duplicating}>
            {duplicating ? 'Duplicating…' : 'Keep same'}
          </Button>
          <Button sx={orangeBtnSx} onClick={onOpenForm} disabled={duplicating}>
            Change details
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={formOpen} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Duplicate campaign — change details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Name" value={name} onChange={(e) => onName(e.target.value)} fullWidth />
            <FormControlLabel
              control={<Switch checked={active} onChange={(_, v) => onActive(v)} />}
              label="Active"
            />
            <TextField
              select
              SelectProps={{ multiple: true }}
              label="Callers"
              value={callerIds}
              onChange={(e) =>
                onCallerIds(
                  typeof e.target.value === 'string'
                    ? e.target.value.split(',')
                    : (e.target.value as string[]),
                )
              }
              fullWidth
            >
              {callers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={duplicating}>
            Cancel
          </Button>
          <Button sx={orangeBtnSx} onClick={onSubmitForm} disabled={duplicating}>
            {duplicating ? 'Duplicating…' : 'Duplicate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
