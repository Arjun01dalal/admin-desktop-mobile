import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { fieldSx, orangeBtnSx } from '@/screens/panel/transactions/shared';

type Props = {
  open: boolean;
  userId: string;
  transactionId: string;
  existing: string[];
  availableBanks: string[];
  onClose: () => void;
  onDone: () => void;
  onBanksChanged?: () => void;
};

function normalize(name: string) {
  return name.trim().toLowerCase();
}

/** Row-level Add Bene — Select Bank Account Name (old popup, new dark UI). */
export function AddBeneDialog({
  open,
  userId,
  transactionId,
  existing,
  availableBanks,
  onClose,
  onDone,
  onBanksChanged,
}: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [localExisting, setLocalExisting] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected([]);
      setSearch('');
      setLocalExisting([]);
      return;
    }
    setLocalExisting(existing);
    setSelected([]);
    setSearch('');
  }, [open, existing]);

  const existingSet = useMemo(
    () => new Set(localExisting.map((b) => normalize(b))),
    [localExisting],
  );

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return availableBanks;
    return availableBanks.filter((b) => normalize(b).includes(q));
  }, [availableBanks, search]);

  const toggle = (bank: string) => {
    if (existingSet.has(normalize(bank))) return;
    setSelected((prev) =>
      prev.includes(bank) ? prev.filter((b) => b !== bank) : [...prev, bank],
    );
  };

  const removeFromMasterList = async (bank: string) => {
    if (deleting || saving) return;
    setDeleting(bank);
    try {
      const res = await secureApi('withdrawals.updateAvailableBanks', {
        action: 'remove',
        names: [bank],
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to remove bank');
        return;
      }
      setLocalExisting((prev) => prev.filter((b) => normalize(b) !== normalize(bank)));
      setSelected((prev) => prev.filter((b) => normalize(b) !== normalize(bank)));
      onBanksChanged?.();
      toast.success('Bank removed successfully');
    } finally {
      setDeleting(null);
    }
  };

  const submit = async () => {
    if (!selected.length) {
      toast.warn('Select at least one bank');
      return;
    }
    if (!userId || !transactionId) {
      toast.error('Missing user or transaction id');
      return;
    }
    setSaving(true);
    try {
      const addRes = await secureApi('withdrawals.addBeneficiary', {
        userId,
        bankAccountName: selected,
      });
      if (!addRes.ok) {
        toast.error(addRes.message || 'Failed to add beneficiary');
        return;
      }
      const syncRes = await secureApi('withdrawals.syncBeneficiary', {
        transactionId,
      });
      if (!syncRes.ok) {
        toast.error(syncRes.message || 'Added but sync failed');
        return;
      }
      toast.success('Beneficiary updated');
      onDone();
      onClose();
      setSelected([]);
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
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>Select Bank Account Name</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#2a2a32' }}>
        <Box
          sx={{
            mb: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: 'rgba(102, 187, 106, 0.12)',
            border: '1px solid rgba(102, 187, 106, 0.35)',
          }}
        >
          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            <Box component="span" sx={{ color: '#66bb6a', fontWeight: 700 }}>
              Green
            </Box>{' '}
            indicates that the user has been added to the beneficiary list in the bank account.
            Choose one or more banks from the list below.
          </Typography>
        </Box>

        {selected.length > 0 ? (
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'center', mb: 1, color: '#ff9f0a' }}
          >
            {selected.length} bank(s) selected
          </Typography>
        ) : null}

        <TextField
          fullWidth
          size="small"
          placeholder="Search bank name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            mb: 1.5,
            ...fieldSx,
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />

        {availableBanks.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={2}>
            No available banks — use Add Bene List to create the master list
          </Typography>
        ) : (
          <Grid container spacing={1}>
            {filtered.map((bank) => {
              const already = existingSet.has(normalize(bank));
              const isSelected = selected.includes(bank);
              const isDeleting = deleting === bank;
              return (
                <Grid item xs={12} sm={6} key={bank}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={0.5}
                    onClick={() => toggle(bank)}
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      cursor: already ? 'default' : 'pointer',
                      border: '1px solid',
                      borderColor: already
                        ? 'rgba(102, 187, 106, 0.5)'
                        : isSelected
                          ? 'rgba(255, 159, 10, 0.55)'
                          : 'divider',
                      bgcolor: already
                        ? 'rgba(102, 187, 106, 0.08)'
                        : isSelected
                          ? 'rgba(255, 159, 10, 0.08)'
                          : 'background.default',
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={already || isSelected}
                      disabled={already || saving || Boolean(deleting)}
                      sx={{
                        p: 0.5,
                        color: already ? '#66bb6a' : undefined,
                        '&.Mui-checked': { color: already ? '#66bb6a' : '#ff9f0a' },
                      }}
                    />
                    <Typography
                      variant="body2"
                      title={bank}
                      sx={{
                        flex: 1,
                        fontSize: 12,
                        color: already ? '#66bb6a' : 'inherit',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {bank}
                    </Typography>
                    {already ? (
                      <IconButton
                        size="small"
                        disabled={saving || Boolean(deleting)}
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeFromMasterList(bank);
                        }}
                        sx={{ color: '#ef5350' }}
                      >
                        {isDeleting ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <DeleteOutlineIcon fontSize="small" />
                        )}
                      </IconButton>
                    ) : null}
                  </Stack>
                </Grid>
              );
            })}
          </Grid>
        )}

        {availableBanks.length > 0 && filtered.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" mt={2}>
            No banks found
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving || selected.length === 0}
          onClick={() => void submit()}
          sx={orangeBtnSx}
        >
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
