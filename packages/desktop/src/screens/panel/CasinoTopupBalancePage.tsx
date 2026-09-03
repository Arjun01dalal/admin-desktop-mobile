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
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { canAccessNavItem, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';
import {
  CURRENCY_OPTIONS,
  PROVIDER_CONFIG,
  displayToppedUpAt,
  emptyForm,
  emptyRemainingForm,
  emptyRemainingFormErrors,
  emptyRemainingSummary,
  buildRemainingSubmitPayload,
  formatMoney,
  mergeRemainingAfterSubmit,
  parseBothProviders,
  parseQtechRemaining,
  remainingRowCode,
  remainingRowConsumed,
  remainingRowGgrInr,
  remainingRowGgrUsd,
  remainingRowLabel,
  toApiDateTime,
  type FormState,
  type ProviderKey,
  type ProviderState,
  type QtechRemainingSummary,
  type RemainingBreakdownRow,
  type RemainingFormErrors,
  type RemainingFormState,
  type TopupRecord,
} from '@/screens/panel/casinoTopup/helpers';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

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

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        height: '100%',
        bgcolor: '#121218',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 1.5,
      }}
    >
      <Typography color="text.secondary" fontSize={12}>
        {label}
      </Typography>
      <Typography fontWeight={700} fontSize={20} sx={{ mt: 0.5, color: accent || 'text.primary' }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function CasinoTopupBalancePage() {
  useRevealCodes();
  const canView = canAccessNavItem({
    id: 'casinoTopup',
    permission: Permissions.view_casino_balance,
  });
  const [providers, setProviders] = useState<Record<ProviderKey, ProviderState>>(emptyProviders);
  const [pageLoading, setPageLoading] = useState(false);
  const [qtechRemaining, setQtechRemaining] =
    useState<QtechRemainingSummary>(emptyRemainingSummary());
  const [qtechRemainingLoading, setQtechRemainingLoading] = useState(false);
  const [remainingTab, setRemainingTab] = useState<'provider' | 'game'>('provider');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(''));
  const [formErrors, setFormErrors] = useState({
    amount: false,
    toppedUpAtIst: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [remainingModalOpen, setRemainingModalOpen] = useState(false);
  const [remainingForm, setRemainingForm] = useState<RemainingFormState>(emptyRemainingForm);
  const [remainingFormErrors, setRemainingFormErrors] =
    useState<RemainingFormErrors>(emptyRemainingFormErrors);
  const [remainingSubmitting, setRemainingSubmitting] = useState(false);

  const loadBalances = useCallback(async () => {
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
      toast.error(err instanceof Error ? err.message : 'Failed to load casino top-up balance');
      setProviders((prev) => ({
        qtech: { ...prev.qtech, loading: false },
        betconstruct: { ...prev.betconstruct, loading: false },
      }));
    } finally {
      setPageLoading(false);
    }
  }, []);

  const loadQtechRemaining = useCallback(async () => {
    setQtechRemainingLoading(true);
    try {
      const res = await secureApi('casinoTopup.qtechRemaining', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load Qtech remaining balance');
        setQtechRemaining(emptyRemainingSummary());
        return;
      }
      setQtechRemaining(parseQtechRemaining(res.data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Qtech remaining balance');
      setQtechRemaining(emptyRemainingSummary());
    } finally {
      setQtechRemainingLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBalances(), loadQtechRemaining()]);
  }, [loadBalances, loadQtechRemaining]);

  useEffect(() => {
    if (canView) void refreshAll();
  }, [canView, refreshAll]);

  const openAddPopup = () => {
    setAddOpen(true);
    setForm(emptyForm(PROVIDER_CONFIG.qtech.defaultNote));
    setFormErrors({ amount: false, toppedUpAtIst: false });
  };

  const closeAddPopup = () => {
    setAddOpen(false);
    setForm(emptyForm(''));
    setFormErrors({ amount: false, toppedUpAtIst: false });
  };

  const openRemainingModal = () => {
    setRemainingForm(emptyRemainingForm());
    setRemainingFormErrors(emptyRemainingFormErrors());
    setRemainingModalOpen(true);
  };

  const closeRemainingModal = () => {
    setRemainingModalOpen(false);
    setRemainingForm(emptyRemainingForm());
    setRemainingFormErrors(emptyRemainingFormErrors());
  };

  const handleSubmitRemainingBalance = async () => {
    const built = buildRemainingSubmitPayload(remainingForm);
    if (!built.ok) {
      setRemainingFormErrors(built.errors);
      toast.error('Please fill required fields');
      return;
    }

    setRemainingSubmitting(true);
    try {
      const res = await secureApi('casinoTopup.qtechRemaining', {
        amount: built.payload.amount,
        date: built.payload.date,
        time: built.payload.time,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to submit remaining balance');
        return;
      }
      toast.success('Remaining balance submitted successfully');
      closeRemainingModal();
      setQtechRemaining(mergeRemainingAfterSubmit(res.data, built.payload));
      // Refresh full breakdown in case submit response is minimal.
      void loadQtechRemaining();
    } finally {
      setRemainingSubmitting(false);
    }
  };

  const handleAdd = async () => {
    const amountError = !form.amount || Number(form.amount) <= 0;
    const dateError = !form.toppedUpAtIst;
    if (amountError || dateError) {
      setFormErrors({ amount: amountError, toppedUpAtIst: dateError });
      toast.error('Please fill required fields');
      return;
    }

    setSubmitting(true);
    try {
      const config = PROVIDER_CONFIG.qtech;
      const res = await secureApi('casinoTopup.addQtech', {
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
      void loadBalances();
      void loadQtechRemaining();
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = useMemo<CommonTableColumn<TopupRecord>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'amount',
        label: 'Amount',
        render: (row) => (row.amount != null ? Number(row.amount).toLocaleString() : '—'),
      },
      {
        id: 'currency',
        label: 'Currency',
        render: (row) => display(row.currency),
      },
      {
        id: 'toppedUpAtIst',
        label: toDisplayText('Topped Up At (IST)'),
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

  const remainingColumns = useMemo<CommonTableColumn<RemainingBreakdownRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: remainingTab === 'provider' ? 'Provider' : 'Game',
        render: (row) => remainingRowLabel(row, remainingTab),
      },
      {
        id: 'code',
        label: 'ID / Code',
        render: (row) => remainingRowCode(row),
      },
      {
        id: 'ggrUsd',
        label: 'GGR / Amount (USD)',
        render: (row) => remainingRowGgrUsd(row),
      },
      {
        id: 'ggrInr',
        label: 'GGR / Amount (INR)',
        render: (row) => remainingRowGgrInr(row),
      },
      {
        id: 'consumed',
        label: 'Consumed / Turnover',
        render: (row) => remainingRowConsumed(row),
      },
    ],
    [remainingTab],
  );

  const remainingRows =
    remainingTab === 'provider' ? qtechRemaining.byProvider : qtechRemaining.byGame;

  if (!canView) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} mb={2}>
          {toDisplayText('Casino Top-up Balance')}
        </Typography>
        <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
          <Typography color="text.secondary">
            You do not have permission to view this page.
          </Typography>
        </Paper>
      </Box>
    );
  }

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
          {toDisplayText('Casino Top-up Balance')}
        </Typography>
        <Button
          startIcon={
            pageLoading || qtechRemainingLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshIcon />
            )
          }
          onClick={() => void refreshAll()}
          disabled={pageLoading || qtechRemainingLoading || submitting}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
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
              Qtech Remaining Balance
            </Typography>
            <Typography color="text.secondary" fontSize={13}>
              From /Qtech/topup-balance-remaining
              {qtechRemaining.toppedUpAtIst ? ` • Topped up: ${qtechRemaining.toppedUpAtIst}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              startIcon={
                qtechRemainingLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <RefreshIcon />
                )
              }
              onClick={() => void loadQtechRemaining()}
              disabled={qtechRemainingLoading}
              sx={orangeBtnSx}
            >
              Refresh
            </Button>
            <Button
              startIcon={<HistoryIcon />}
              onClick={() => {
                setHistoryModalOpen(true);
                void loadBalances();
              }}
              sx={orangeBtnSx}
            >
              History
            </Button>
            <Button
              startIcon={<AddIcon />}
              onClick={openRemainingModal}
              disabled={remainingSubmitting || qtechRemainingLoading}
              sx={orangeBtnSx}
            >
              Remaining Balance
            </Button>
            <Button startIcon={<AddIcon />} onClick={() => openAddPopup()} sx={orangeBtnSx}>
              Add
            </Button>
          </Stack>
        </Stack>

        {qtechRemainingLoading && qtechRemaining.remainingUsd == null ? (
          <Typography color="text.secondary" py={3} textAlign="center">
            Loading remaining balance…
          </Typography>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))',
                },
                gap: 1.5,
                mb: 2,
              }}
            >
              <MetricCard
                label="Remaining (USD)"
                value={formatMoney(qtechRemaining.remainingUsd)}
                accent="#2dd4bf"
              />
              <MetricCard
                label="Topped Up (USD)"
                value={formatMoney(qtechRemaining.toppedUpUsd)}
                accent="#60a5fa"
              />
              <MetricCard
                label="Consumed (USD)"
                value={formatMoney(qtechRemaining.consumedUsd)}
                accent="#fbbf24"
              />
              <MetricCard label="Currency" value={qtechRemaining.currency || 'USD'} />
              <MetricCard label="USD → INR" value={formatMoney(qtechRemaining.usdToInr, 2)} />
              <MetricCard label="Fee (INR)" value={formatMoney(qtechRemaining.feeInr)} />
              <MetricCard label="GGR (USD)" value={formatMoney(qtechRemaining.ggrUsd)} />
              <MetricCard label="GGR (INR)" value={formatMoney(qtechRemaining.ggrInr)} />
              <MetricCard
                label="Unmatched Games"
                value={
                  qtechRemaining.unmatchedGamesCount != null
                    ? String(qtechRemaining.unmatchedGamesCount)
                    : '—'
                }
              />
            </Box>

            {(qtechRemaining.rangeStart || qtechRemaining.rangeEnd) && (
              <Typography color="text.secondary" fontSize={13} mb={1.5}>
                Range:{' '}
                {qtechRemaining.rangeStart
                  ? new Date(qtechRemaining.rangeStart).toLocaleString()
                  : '—'}{' '}
                →{' '}
                {qtechRemaining.rangeEnd ? new Date(qtechRemaining.rangeEnd).toLocaleString() : '—'}
              </Typography>
            )}

            <Stack direction="row" spacing={1} mb={1.5}>
              <Button
                size="small"
                variant={remainingTab === 'provider' ? 'contained' : 'outlined'}
                onClick={() => setRemainingTab('provider')}
                sx={
                  remainingTab === 'provider'
                    ? orangeBtnSx
                    : { textTransform: 'none', borderColor: 'rgba(255,255,255,0.28)' }
                }
              >
                By Provider ({qtechRemaining.byProvider.length})
              </Button>
              <Button
                size="small"
                variant={remainingTab === 'game' ? 'contained' : 'outlined'}
                onClick={() => setRemainingTab('game')}
                sx={
                  remainingTab === 'game'
                    ? orangeBtnSx
                    : { textTransform: 'none', borderColor: 'rgba(255,255,255,0.28)' }
                }
              >
                By Game ({qtechRemaining.byGame.length})
              </Button>
            </Stack>

            <TablePanel>
              <CommonTable
                columns={remainingColumns}
                rows={remainingRows}
                getRowKey={(row, i) => String(row._id || row.id || row.gameId || row.provider || i)}
                loading={qtechRemainingLoading && remainingRows.length === 0}
                emptyMessage="No data found"
                stickyHeader
                dense
                minWidth={900}
                maxHeight="100%"
              />
            </TablePanel>
          </>
        )}
      </Paper>

      <Dialog
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Qtech Top-up History</DialogTitle>
        <DialogContent>
          <CommonTable
            columns={historyColumns}
            rows={providers.qtech.records}
            getRowKey={(row, i) => String(row._id || i)}
            loading={providers.qtech.loading && providers.qtech.records.length === 0}
            emptyMessage="No top-up records found"
            minWidth={640}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={closeAddPopup} maxWidth="sm" fullWidth>
        <DialogTitle>Add {toDisplayText(PROVIDER_CONFIG.qtech.title)} Top-up</DialogTitle>
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
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
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
              label={`${toDisplayText('Topped Up At (IST)')} *`}
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
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddPopup} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleAdd()} disabled={submitting} sx={orangeBtnSx}>
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={remainingModalOpen} onClose={closeRemainingModal} maxWidth="sm" fullWidth>
        <DialogTitle>Submit Remaining Balance</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Amount *"
              placeholder="e.g. 850.25"
              value={remainingForm.amount}
              error={remainingFormErrors.amount}
              helperText={remainingFormErrors.amount ? 'Amount is required' : ''}
              onChange={(e) => {
                setRemainingForm((prev) => ({ ...prev, amount: e.target.value }));
                setRemainingFormErrors((prev) => ({ ...prev, amount: false }));
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Date *"
              placeholder="e.g. 24-08-2026"
              value={remainingForm.date}
              error={remainingFormErrors.date}
              helperText={
                remainingFormErrors.date ? 'Date is required' : 'Format: DD-MM-YYYY (IST)'
              }
              onChange={(e) => {
                setRemainingForm((prev) => ({ ...prev, date: e.target.value }));
                setRemainingFormErrors((prev) => ({ ...prev, date: false }));
              }}
            />
            <TextField
              fullWidth
              size="small"
              label="Time *"
              placeholder="e.g. 05:44 p.m."
              value={remainingForm.time}
              error={remainingFormErrors.time}
              helperText={
                remainingFormErrors.time ? 'Time is required' : 'Format: hh:mm a.m./p.m. (IST)'
              }
              onChange={(e) => {
                setRemainingForm((prev) => ({ ...prev, time: e.target.value }));
                setRemainingFormErrors((prev) => ({ ...prev, time: false }));
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRemainingModal} disabled={remainingSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmitRemainingBalance()}
            disabled={remainingSubmitting}
            sx={orangeBtnSx}
          >
            {remainingSubmitting ? <CircularProgress size={18} color="inherit" /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
