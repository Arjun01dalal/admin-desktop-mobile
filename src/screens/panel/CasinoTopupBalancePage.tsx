import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { canAccessNavItem, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { display } from '@/screens/panel/shared';
import {
  CURRENCY_OPTIONS,
  PROVIDER_CONFIG,
  displayToppedUpAt,
  emptyForm,
  parseBothProviders,
  toApiDateTime,
  type FormState,
  type ProviderKey,
  type ProviderState,
  type TopupRecord,
} from '@/screens/panel/casinoTopup/helpers';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 36,
  px: 2,
  '&:hover': { bgcolor: '#e08c00' },
};

const emptyProviders = (): Record<ProviderKey, ProviderState> => ({
  qtech: { records: [], balance: null, currency: 'USD', loading: false },
  betconstruct: { records: [], balance: null, currency: 'USD', loading: false },
});

export function CasinoTopupBalancePage() {
  // Match sidebar gating (full-access / QA see all nav even if Responsibility row is missing).
  const canView = canAccessNavItem({
    id: 'casinoTopup',
    permission: Permissions.view_casino_balance,
  });
  const [providers, setProviders] =
    useState<Record<ProviderKey, ProviderState>>(emptyProviders);
  const [pageLoading, setPageLoading] = useState(false);
  const [addProvider, setAddProvider] = useState<ProviderKey | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(''));
  const [formErrors, setFormErrors] = useState({
    amount: false,
    toppedUpAtIst: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setPageLoading(true);
    setProviders((prev) => ({
      qtech: { ...prev.qtech, loading: true },
      betconstruct: { ...prev.betconstruct, loading: true },
    }));
    try {
      const res = await secureApi('casinoTopup.get', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load casino top-up balance');
        setProviders((prev) => ({
          qtech: { ...prev.qtech, loading: false },
          betconstruct: { ...prev.betconstruct, loading: false },
        }));
        return;
      }
      const parsed = parseBothProviders(res.data);
      setProviders({
        qtech: { ...parsed.qtech, loading: false },
        betconstruct: { ...parsed.betconstruct, loading: false },
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to load casino top-up balance',
      );
      setProviders((prev) => ({
        qtech: { ...prev.qtech, loading: false },
        betconstruct: { ...prev.betconstruct, loading: false },
      }));
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const openAddPopup = (key: ProviderKey) => {
    setAddProvider(key);
    setForm(emptyForm(PROVIDER_CONFIG[key].defaultNote));
    setFormErrors({ amount: false, toppedUpAtIst: false });
  };

  const closeAddPopup = () => {
    setAddProvider(null);
    setForm(emptyForm(''));
    setFormErrors({ amount: false, toppedUpAtIst: false });
  };

  const handleAdd = async () => {
    if (!addProvider) return;
    const amountError = !form.amount || Number(form.amount) <= 0;
    const dateError = !form.toppedUpAtIst;
    if (amountError || dateError) {
      setFormErrors({ amount: amountError, toppedUpAtIst: dateError });
      toast.error('Please fill required fields');
      return;
    }

    setSubmitting(true);
    try {
      const config = PROVIDER_CONFIG[addProvider];
      const action =
        addProvider === 'qtech'
          ? 'casinoTopup.addQtech'
          : 'casinoTopup.addBetconstruct';
      const res = await secureApi(action, {
        amount: Number(form.amount),
        currency: form.currency,
        toppedUpAtIst: toApiDateTime(form.toppedUpAtIst),
        note: form.note.trim() || config.defaultNote,
      });
      if (!res.ok) {
        toast.error(res.message || `Failed to add ${config.title} top-up`);
        return;
      }
      toast.success(`${config.title} top-up added successfully`);
      closeAddPopup();
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<CommonTableColumn<TopupRecord>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 64,
        cellSx: { overflow: 'visible', textOverflow: 'clip' },
        render: (_row, index) => index + 1,
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row) =>
          row.amount != null ? Number(row.amount).toLocaleString() : '—',
      },
      {
        id: 'currency',
        label: 'Currency',
        render: (row) => display(row.currency),
      },
      {
        id: 'toppedUpAtIst',
        label: 'Topped Up At (IST)',
        render: (row) => displayToppedUpAt(row),
      },
      {
        id: 'note',
        label: 'Note',
        render: (row) => display(row.note),
      },
    ],
    [],
  );

  if (!canView) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          Casino Top-up Balance
        </Typography>
        <Paper sx={{ p: 2, bgcolor: '#1a1a1f' }}>
          <Typography color="text.secondary">
            You do not have permission to view this page.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const renderSection = (key: ProviderKey) => {
    const config = PROVIDER_CONFIG[key];
    const state = providers[key];

    return (
      <Paper
        key={key}
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a1f',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          mb={2}
          gap={1}
          flexWrap="wrap"
        >
          <Box>
            <Typography fontWeight={700} fontSize={18}>
              {config.title}
            </Typography>
            <Typography color="text.secondary" fontSize={13}>
              Topped-up balance
            </Typography>
          </Box>
          <Button
            startIcon={<AddIcon />}
            onClick={() => openAddPopup(key)}
            sx={orangeBtnSx}
          >
            Add
          </Button>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            bgcolor: '#121218',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Typography color="text.secondary" fontSize={13}>
            Current Balance
          </Typography>
          <Typography fontWeight={700} fontSize={24}>
            {state.loading && state.balance == null ? (
              '...'
            ) : state.balance != null ? (
              <>
                {Number(state.balance).toLocaleString()}{' '}
                <Box
                  component="span"
                  sx={{ fontSize: 14, fontWeight: 500, color: 'text.secondary' }}
                >
                  {state.currency}
                </Box>
              </>
            ) : (
              '—'
            )}
          </Typography>
        </Paper>

        <CommonTable
          columns={columns}
          rows={state.records}
          getRowKey={(row, i) => String(row._id || i)}
          loading={state.loading && state.records.length === 0}
          emptyMessage="No top-up records found"
          minWidth={640}
        />
      </Paper>
    );
  };

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        flexWrap="wrap"
        gap={1}
      >
        <Typography variant="h5" fontWeight={700}>
          Casino Top-up Balance
        </Typography>
        <Button
          startIcon={
            pageLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshIcon />
            )
          }
          onClick={() => void load()}
          disabled={pageLoading || submitting}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gap: 2,
        }}
      >
        {renderSection('qtech')}
        {renderSection('betconstruct')}
      </Box>

      <Dialog open={!!addProvider} onClose={closeAddPopup} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add {addProvider ? PROVIDER_CONFIG[addProvider].title : ''} Top-up
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Amount *"
              placeholder="e.g. 1000"
              value={form.amount}
              error={formErrors.amount}
              helperText={formErrors.amount ? 'Amount is required' : ''}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, amount: e.target.value }));
                setFormErrors((prev) => ({ ...prev, amount: false }));
              }}
            />
            <TextField
              fullWidth={false}
              select
              size="small"
              label="Currency *"
              value={form.currency}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currency: e.target.value }))
              }
              sx={{ width: '100%' }}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="datetime-local"
              label="Topped Up At (IST) *"
              value={form.toppedUpAtIst}
              error={formErrors.toppedUpAtIst}
              helperText={
                formErrors.toppedUpAtIst
                  ? 'Top-up date/time is required'
                  : 'Format: 2026-07-21 01:17:00 (IST)'
              }
              inputProps={{ step: 1 }}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  toppedUpAtIst: e.target.value,
                }));
                setFormErrors((prev) => ({
                  ...prev,
                  toppedUpAtIst: false,
                }));
              }}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Note"
              placeholder="Optional note"
              value={form.note}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, note: e.target.value }))
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddPopup} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleAdd()}
            disabled={submitting}
            sx={orangeBtnSx}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
