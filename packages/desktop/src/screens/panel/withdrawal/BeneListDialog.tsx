import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { fieldSx, orangeBtnSx } from '@/screens/panel/transactions/shared';

type Props = {
  open: boolean;
  initialBanks: string[];
  onClose: () => void;
  onSuccess: () => void;
};

function normalize(name: string) {
  return name.trim().toLowerCase();
}

/** Manage global available-bank list (old Add Bene List / BeneModal). */
export function BeneListDialog({ open, initialBanks, onClose, onSuccess }: Props) {
  const [banks, setBanks] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBanks(initialBanks);
    setInput('');
    setMode(initialBanks.length ? 'update' : 'create');
  }, [open, initialBanks]);

  const addBank = () => {
    const value = input.trim();
    if (!value) return;
    if (banks.some((b) => normalize(b) === normalize(value))) {
      setInput('');
      return;
    }
    setBanks((prev) => [...prev, value]);
    setInput('');
  };

  const removeBank = (name: string) => {
    setBanks((prev) => prev.filter((b) => normalize(b) !== normalize(name)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'create') {
        const res = await secureApi('withdrawals.createAvailableBanks', {
          availableBanks: banks,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to create banks');
          return;
        }
      } else {
        const added = banks.filter(
          (bank) => !initialBanks.some((b) => normalize(b) === normalize(bank)),
        );
        const removed = initialBanks.filter(
          (bank) => !banks.some((b) => normalize(b) === normalize(bank)),
        );
        if (!added.length && !removed.length) {
          toast.info('No changes to save');
          onClose();
          return;
        }
        if (added.length) {
          const res = await secureApi('withdrawals.updateAvailableBanks', {
            action: 'add',
            names: added,
          });
          if (!res.ok) {
            toast.error(res.message || 'Failed to add banks');
            return;
          }
        }
        if (removed.length) {
          const res = await secureApi('withdrawals.updateAvailableBanks', {
            action: 'remove',
            names: removed,
          });
          if (!res.ok) {
            toast.error(res.message || 'Failed to remove banks');
            return;
          }
        }
      }
      toast.success('Available banks updated successfully');
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { bgcolor: 'background.paper', borderRadius: 2 } }}
    >
      <DialogTitle>Available Banks</DialogTitle>
      <DialogContent>
        <Box mb={2} mt={1}>
          <ToggleButtonGroup
            fullWidth
            exclusive
            size="small"
            value={mode}
            onChange={(_e, value) => {
              if (value) setMode(value);
            }}
            sx={{
              '& .MuiToggleButton-root': {
                color: '#c8c8d0',
                borderColor: '#2a2a32',
                textTransform: 'none',
                '&.Mui-selected': {
                  bgcolor: 'rgba(255, 159, 10, 0.2)',
                  color: '#ff9f0a',
                  borderColor: '#ff9f0a',
                  '&:hover': { bgcolor: 'rgba(255, 159, 10, 0.28)' },
                },
              },
            }}
          >
            <ToggleButton value="create">Create</ToggleButton>
            <ToggleButton value="update">Update</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Stack direction="row" spacing={1}>
          <TextField
            fullWidth
            size="small"
            label="Bank Name"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addBank();
            }}
            sx={fieldSx}
          />
          <Button variant="contained" onClick={addBank} sx={orangeBtnSx}>
            Add
          </Button>
        </Stack>

        <Box mt={2}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Selected Banks ({banks.length})
          </Typography>
          <Box
            sx={{
              minHeight: 120,
              maxHeight: 280,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: 'background.default',
            }}
          >
            {banks.length ? (
              banks.map((bank) => (
                <Chip
                  key={bank}
                  label={bank}
                  onDelete={() => removeBank(bank)}
                  sx={{
                    bgcolor: 'rgba(255, 159, 10, 0.18)',
                    color: '#ffd699',
                    '& .MuiChip-deleteIcon': { color: '#ff9f0a' },
                  }}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No banks yet
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving || (mode === 'create' && !banks.length)}
          onClick={() => void handleSave()}
          sx={orangeBtnSx}
        >
          {saving ? '…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
