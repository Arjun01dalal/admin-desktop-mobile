/**
 * Withdrawal Bifurcation modal — played-wise (E/C/S) + status totals + CSV export.
 * Gated by see_withdrawal_bifurcation (or full-access).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  BIFURCATION_STATUS_META,
  bifurcationResultToCsv,
  formatBifurcationAmount,
  formatPlayedLabel,
  getBifurcationSummary,
  parseBifurcationResult,
  validateBifurcationDateRange,
  type BifurcationRow,
  type BifurcationStatus,
  type BifurcationStatusKey,
  type BifurcationStatusTotals,
} from '@astro/shared/withdrawalBifurcation';
import { secureApi } from '@/api/secureClient';

type Props = {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  clientName?: string;
};

type Tone = 'ok' | 'warn' | 'danger' | 'mute';

const TONE_COLOR: Record<Tone, string> = {
  ok: 'success.main',
  warn: 'warning.main',
  danger: 'error.main',
  mute: 'text.secondary',
};

const STATUS_TONE: Record<BifurcationStatusKey, Tone> = {
  approved: 'ok',
  pending: 'warn',
  inProgress: 'warn',
  rejected: 'danger',
  cancelled: 'mute',
  failed: 'danger',
  onHold: 'warn',
  reverse: 'mute',
};

function StatusCell({ status, tone = 'mute' }: { status?: BifurcationStatus; tone?: Tone }) {
  const amount = Number(status?.amount) || 0;
  const count = Number(status?.count) || 0;
  const empty = amount === 0 && count === 0;
  return (
    <Box sx={{ opacity: empty ? 0.45 : 1 }}>
      <Typography fontSize={13} fontWeight={700} color={TONE_COLOR[tone]} noWrap>
        {formatBifurcationAmount(amount)}
      </Typography>
      <Typography fontSize={11} color="text.secondary">
        {count} txn
      </Typography>
    </Box>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

export function WithdrawalBifurcationDialog({
  open,
  onClose,
  startDate,
  endDate,
  clientName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEmpty, setIsEmpty] = useState(false);
  const [rows, setRows] = useState<BifurcationRow[]>([]);
  const [statusTotals, setStatusTotals] = useState<BifurcationStatusTotals | null>(null);

  const dateCheck = useMemo(
    () => validateBifurcationDateRange(startDate, endDate),
    [endDate, startDate],
  );

  const load = useCallback(async () => {
    if (!dateCheck.ok) {
      setError(dateCheck.message);
      setIsEmpty(false);
      setRows([]);
      setStatusTotals(null);
      toast.error(dateCheck.message);
      return;
    }
    setLoading(true);
    setError('');
    setIsEmpty(false);
    try {
      const payload: Record<string, unknown> = { startDate, endDate };
      const app = String(clientName || '').trim();
      if (app && app !== 'All') payload.clientName = app;
      const res = await secureApi('withdrawals.playedBifurcation', payload);
      if (!res.ok) {
        const msg = res.message || 'Failed to fetch bifurcation';
        setError(msg);
        toast.error(msg);
        return;
      }
      const parsed = parseBifurcationResult(res.data);
      setRows(parsed.rows);
      setStatusTotals(parsed.statusTotals);
      const empty = !parsed.rows.length && !parsed.statusTotals;
      setIsEmpty(empty);
      if (empty) setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch bifurcation';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [clientName, dateCheck, endDate, startDate]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const summary = getBifurcationSummary(rows, statusTotals);
  const hasData = rows.length > 0 || !!statusTotals;

  const onExport = () => {
    if (!hasData) {
      toast.info('Nothing to export');
      return;
    }
    const csv = bifurcationResultToCsv(rows, statusTotals);
    downloadCsv(`withdrawal-bifurcation_${startDate}_${endDate}.csv`, csv);
    toast.success('CSV downloaded');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" aria-labelledby="bifurcation-title">
      <DialogTitle sx={{ pb: 1 }} id="bifurcation-title">
        <Typography fontWeight={800} fontSize={18}>
          Withdrawal Bifurcation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {startDate || '—'} → {endDate || '—'}
          {clientName && clientName !== 'All' ? ` · ${clientName}` : ' · ALL apps'}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {loading && !hasData ? (
          <Stack spacing={2} sx={{ minHeight: 180 }} aria-busy="true" aria-label="Loading bifurcation">
            <Stack direction="row" spacing={1.5}>
              <Skeleton variant="rounded" height={72} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={72} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={72} sx={{ flex: 1 }} />
            </Stack>
            <Skeleton variant="rounded" height={160} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        ) : null}

        {!loading && error ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }} role="alert">
            <Typography color="error" fontWeight={800}>
              Could not load data
            </Typography>
            <Typography color="text.secondary" textAlign="center">
              {error}
            </Typography>
            {!dateCheck.ok ? null : (
              <Button variant="contained" onClick={() => void load()}>
                Retry
              </Button>
            )}
          </Stack>
        ) : null}

        {!loading && !error && isEmpty ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
            <Typography fontWeight={800}>No data for this range</Typography>
            <Typography color="text.secondary" textAlign="center">
              Try another From/To date, then open Bifurcation again.
            </Typography>
          </Stack>
        ) : null}

        {hasData ? (
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1.5,
              }}
            >
              {[
                ['Played groups', String(rows.length)],
                ['Total count', String(summary.totalCount)],
                ['Grand total', formatBifurcationAmount(summary.totalAmount)],
              ].map(([label, value]) => (
                <Box
                  key={label}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography fontSize={12} color="text.secondary" fontWeight={600}>
                    {label}
                  </Typography>
                  <Typography fontSize={18} fontWeight={800}>
                    {value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {statusTotals ? (
              <Box>
                <Typography fontWeight={800} sx={{ mb: 1 }}>
                  Status totals
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1,
                  }}
                >
                  {BIFURCATION_STATUS_META.map(({ key, label }) => (
                    <Box
                      key={key}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography fontSize={11} color="text.secondary" fontWeight={700}>
                        {label}
                      </Typography>
                      <StatusCell status={statusTotals[key]} tone={STATUS_TONE[key]} />
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : null}

            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                <Typography fontWeight={800}>Played wise breakup</Typography>
                <Typography fontSize={11} color="text.secondary">
                  E = Exchange · C = Casino · S = Satta Matka
                </Typography>
              </Stack>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" stickyHeader aria-label="Played wise bifurcation">
                  <TableHead>
                    <TableRow>
                      {['Sr', 'Played', 'Total', 'Count', ...BIFURCATION_STATUS_META.map((s) => s.label)].map(
                        (h) => (
                          <TableCell key={h} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                            {h}
                          </TableCell>
                        ),
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={`${row.played}-${index}`} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography fontSize={13} fontWeight={700}>
                            {formatPlayedLabel(row.played)}
                          </Typography>
                          {row.played ? (
                            <Typography fontSize={11} color="text.secondary">
                              {row.played}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {formatBifurcationAmount(row.totalAmount)}
                        </TableCell>
                        <TableCell>{row.totalCount}</TableCell>
                        {BIFURCATION_STATUS_META.map(({ key }) => (
                          <TableCell key={key}>
                            <StatusCell status={row[key]} tone={STATUS_TONE[key]} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={onExport} disabled={!hasData}>
          Export CSV
        </Button>
        <Button variant="contained" disabled={loading || !dateCheck.ok} onClick={() => void load()}>
          Refresh
        </Button>
      </DialogActions>
    </Dialog>
  );
}
