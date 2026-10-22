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
} from '@mui/material';
import type { C2cCallerOption } from '@astro/shared';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';

export type C2cCampaignFormMode = 'create' | 'edit';

type Props = {
  open: boolean;
  mode: C2cCampaignFormMode;
  name: string;
  active: boolean;
  isLead: boolean;
  callerIds: string[];
  callers: C2cCallerOption[];
  saving: boolean;
  onClose: () => void;
  onName: (v: string) => void;
  onActive: (v: boolean) => void;
  onIsLead: (v: boolean) => void;
  onCallerIds: (ids: string[]) => void;
  onSave: () => void;
};

export function C2cCampaignFormDialog({
  open,
  mode,
  name,
  active,
  isLead,
  callerIds,
  callers,
  saving,
  onClose,
  onName,
  onActive,
  onIsLead,
  onCallerIds,
  onSave,
}: Props) {
  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{mode === 'edit' ? 'Edit campaign' : 'Create campaign'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => onName(e.target.value)} fullWidth />
          {mode === 'create' ? (
            <FormControlLabel
              control={<Switch checked={isLead} onChange={(_, v) => onIsLead(v)} />}
              label="Is lead"
            />
          ) : null}
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
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button sx={orangeBtnSx} onClick={onSave} disabled={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
