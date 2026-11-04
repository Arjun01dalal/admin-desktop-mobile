/**
 * Withdrawal Bifurcation modal — polished summary + status grid + played table.
 * Gated by see_withdrawal_bifurcation (or full-access).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { toast } from 'react-toastify';
import {
  BIFURCATION_STATUS_META,
  bifurcationResultToCsv,
  formatBifurcationAmount,
  formatPlayedCode,
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
import { orangeBtnSx } from '@/screens/panel/transactions/shared';

type Props = {
  open: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  clientName?: string;
};

type Tone = 'ok' | 'warn' | 'danger' | 'mute';

const TONE_HEX: Record<Tone, string> = {
  ok: '#22c55e',
  warn: '#f59e0b',
  danger: '#ef4444',
  mute: '#94a3b8',
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

const cardSx = {
  p: 1.75,
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'action.hover',
  minHeight: 84,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
} as const;

function StatusCell({ status, tone = 'mute' }: { status?: BifurcationStatus; tone?: Tone }) {
  const amount = Number(status?.amount) || 0;
  const count = Number(status?.count) || 0;
  const empty = amount === 0 && count === 0;
  return (
    <Box sx={{ opacity: empty ? 0.4 : 1, lineHeight: 1.2 }}>
      <Typography fontSize={13} fontWeight={800} sx={{ color: TONE_HEX[tone] }} noWrap>
        {formatBifurcationAmount(amount)}
      </Typography>
      <Typography fontSize={11} color="text.secondary" fontWeight={600}>
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

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0)),
    [rows],
  );

  const statusMaxAmount = useMemo(() => {
    if (!statusTotals) return 1;
    return Math.max(
      1,
      ...BIFURCATION_STATUS_META.map(({ key }) => Number(statusTotals[key]?.amount) || 0),
    );
  }, [statusTotals]);

  const rangeLabel = `${startDate || '—'} → ${endDate || '—'}`;
  const appLabel = clientName && clientName !== 'All' ? clientName : 'ALL apps';

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
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      aria-labelledby="bifurcation-title"
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1.5,
          pt: 2,
          px: 3,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
        id="bifurcation-title"
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box>
            <Typography fontWeight={800} fontSize={20} letterSpacing={-0.2}>
              Withdrawal Bifurcation
            </Typography>
            <Stack direction="row" gap={1} mt={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={rangeLabel}
                sx={{
                  fontWeight: 700,
                  bgcolor: 'rgba(255,159,10,0.14)',
                  color: '#ff9f0a',
                  borderRadius: 1.5,
                }}
              />
              <Chip
                size="small"
                label={appLabel}
                variant="outlined"
                sx={{ fontWeight: 700, borderRadius: 1.5 }}
              />
            </Stack>
          </Box>
          {loading && hasData ? (
            <Typography fontSize={12} color="text.secondary" fontWeight={700} sx={{ pt: 0.5 }}>
              Refreshing…
            </Typography>
          ) : null}
        </Stack>
        {loading ? (
          <LinearProgress
            sx={{
              mt: 1.5,
              borderRadius: 1,
              height: 3,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': { bgcolor: '#ff9f0a' },
            }}
          />
        ) : null}
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {loading && !hasData ? (
          <Stack spacing={2} sx={{ minHeight: 220 }} aria-busy="true" aria-label="Loading bifurcation">
            <Stack direction="row" spacing={1.5}>
              <Skeleton variant="rounded" height={84} sx={{ flex: 1, borderRadius: 2 }} />
              <Skeleton variant="rounded" height={84} sx={{ flex: 1, borderRadius: 2 }} />
              <Skeleton variant="rounded" height={84} sx={{ flex: 1, borderRadius: 2 }} />
            </Stack>
            <Skeleton variant="rounded" height={148} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={220} sx={{ borderRadius: 2 }} />
          </Stack>
        ) : null}

        {!loading && error ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }} role="alert">
            <Typography color="error" fontWeight={800} fontSize={16}>
              Could not load data
            </Typography>
            <Typography color="text.secondary" textAlign="center" maxWidth={420}>
              {error}
            </Typography>
            {dateCheck.ok ? (
              <Button variant="contained" onClick={() => void load()} sx={orangeBtnSx}>
                Retry
              </Button>
            ) : null}
          </Stack>
        ) : null}

        {!loading && !error && isEmpty ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 8 }}>
            <Typography fontWeight={800} fontSize={16}>
              No data for this range
            </Typography>
            <Typography color="text.secondary" textAlign="center" maxWidth={420}>
              Try another From/To date on Withdrawal, then open Bifurcation again.
            </Typography>
          </Stack>
        ) : null}

        {hasData ? (
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1.5,
              }}
            >
              {[
                { label: 'Played groups', value: String(rows.length), accent: false },
                { label: 'Total count', value: String(summary.totalCount), accent: false },
                {
                  label: 'Grand total',
                  value: formatBifurcationAmount(summary.totalAmount),
                  accent: true,
                },
              ].map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    ...cardSx,
                    borderColor: item.accent ? 'rgba(255,159,10,0.45)' : 'divider',
                    bgcolor: item.accent ? 'rgba(255,159,10,0.08)' : 'action.hover',
                    boxShadow: item.accent ? 'inset 3px 0 0 #ff9f0a' : 'none',
                  }}
                >
                  <Typography fontSize={12} color="text.secondary" fontWeight={700} letterSpacing={0.2}>
                    {item.label.toUpperCase()}
                  </Typography>
                  <Typography
                    fontSize={item.accent ? 22 : 20}
                    fontWeight={800}
                    mt={0.5}
                    color={item.accent ? '#ff9f0a' : 'text.primary'}
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            {statusTotals ? (
              <Box>
                <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.25 }}>
                  Status totals
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1.25,
                  }}
                >
                  {BIFURCATION_STATUS_META.map(({ key, label }) => {
                    const tone = STATUS_TONE[key];
                    const amount = Number(statusTotals[key]?.amount) || 0;
                    const pct = Math.max(0, Math.min(100, (amount / statusMaxAmount) * 100));
                    return (
                      <Box
                        key={key}
                        sx={{
                          ...cardSx,
                          minHeight: 96,
                          boxShadow: `inset 3px 0 0 ${TONE_HEX[tone]}`,
                          gap: 0.75,
                        }}
                      >
                        <Typography fontSize={11} color="text.secondary" fontWeight={800}>
                          {label}
                        </Typography>
                        <StatusCell status={statusTotals[key]} tone={tone} />
                        <Box
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              width: `${pct}%`,
                              height: '100%',
                              bgcolor: TONE_HEX[tone],
                              opacity: amount > 0 ? 0.85 : 0.2,
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ) : null}

            <Box>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                gap={1}
                sx={{ mb: 1.25 }}
              >
                <Typography fontWeight={800} fontSize={15}>
                  Played wise breakup
                </Typography>
                <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
                  {[
                    ['E', 'Exchange'],
                    ['C', 'Casino'],
                    ['S', 'Satta Matka'],
                  ].map(([code, name]) => (
                    <Chip
                      key={code}
                      size="small"
                      label={`${code} · ${name}`}
                      sx={{
                        height: 24,
                        fontSize: 11,
                        fontWeight: 700,
                        bgcolor: 'action.hover',
                        borderRadius: 1.25,
                      }}
                    />
                  ))}
                </Stack>
              </Stack>

              <TableContainer
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  maxHeight: 380,
                }}
              >
                <Table size="small" stickyHeader aria-label="Played wise bifurcation">
                  <TableHead>
                    <TableRow>
                      {['Sr', 'Played', 'Total', 'Count', ...BIFURCATION_STATUS_META.map((s) => s.label)].map(
                        (h) => (
                          <TableCell
                            key={h}
                            sx={{
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              bgcolor: 'background.paper',
                              borderBottomColor: 'divider',
                              fontSize: 12,
                              py: 1.25,
                            }}
                          >
                            {h}
                          </TableCell>
                        ),
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedRows.map((row, index) => {
                      const code = formatPlayedCode(row.played);
                      return (
                        <TableRow
                          key={`${row.played}-${index}`}
                          hover
                          sx={{
                            '&:nth-of-type(odd)': { bgcolor: 'rgba(255,255,255,0.015)' },
                            '& td': { borderBottomColor: 'divider', py: 1.1, verticalAlign: 'top' },
                          }}
                        >
                          <TableCell sx={{ color: 'text.secondary', fontWeight: 700, width: 44 }}>
                            {index + 1}
                          </TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <Typography fontSize={13} fontWeight={800}>
                              {formatPlayedLabel(row.played)}
                            </Typography>
                            {code ? (
                              <Chip
                                size="small"
                                label={code}
                                sx={{
                                  mt: 0.5,
                                  height: 20,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  bgcolor: 'rgba(255,159,10,0.12)',
                                  color: '#ff9f0a',
                                }}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 800,
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatBifurcationAmount(row.totalAmount)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {row.totalCount}
                          </TableCell>
                          {BIFURCATION_STATUS_META.map(({ key }) => (
                            <TableCell key={key} sx={{ whiteSpace: 'nowrap' }}>
                              <StatusCell status={row[key]} tone={STATUS_TONE[key]} />
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 1.75,
          gap: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Close
        </Button>
        <Box flex={1} />
        <Button
          onClick={onExport}
          disabled={!hasData}
          startIcon={<FileDownloadOutlinedIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, color: '#ff9f0a' }}
        >
          Export CSV
        </Button>
        <Button
          variant="contained"
          disabled={loading || !dateCheck.ok}
          onClick={() => void load()}
          startIcon={<RefreshIcon />}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </DialogActions>
    </Dialog>
  );
}
