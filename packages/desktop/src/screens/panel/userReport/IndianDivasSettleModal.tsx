import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  formatIndianDivasMoney,
  indianDivasStatusLabel,
  normalizeIndianDivasPendingBets,
  type IndianDivasBetStatus,
  type IndianDivasPendingBet,
} from '@astro/shared/indianDivasSettle';
import { secureApi } from '@/api/secureClient';

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
};

/** Indian Divas Settle — Laxmi User Report revealer pending-bets UI. */
export function IndianDivasSettleModal({ open, onClose, userId }: Props) {
  const [bets, setBets] = useState<IndianDivasPendingBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [rollbackConfirmOpen, setRollbackConfirmOpen] = useState(false);
  const [winDialogOpen, setWinDialogOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<IndianDivasPendingBet | null>(null);
  const [winAmount, setWinAmount] = useState('');

  const fetchPendingBets = useCallback(async () => {
    if (!userId) {
      toast.error('User id missing');
      return;
    }
    setLoading(true);
    try {
      const res = await secureApi('userReport.indianDivasPendingBets', { userId });
      if (!res.ok) {
        setBets([]);
        toast.error(res.message || 'Failed to fetch pending bets');
        return;
      }
      setBets(normalizeIndianDivasPendingBets(res.data));
    } catch (error) {
      setBets([]);
      toast.error(error instanceof Error ? error.message : 'Failed to fetch pending bets');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    setRollbackConfirmOpen(false);
    setWinDialogOpen(false);
    setSelectedBet(null);
    setWinAmount('');
    setActionKey(null);
    void fetchPendingBets();
  }, [open, fetchPendingBets]);

  const busy = Boolean(actionKey);

  const handleClose = () => {
    if (loading || busy) return;
    onClose();
  };

  const updateBetStatus = async (
    bet: IndianDivasPendingBet,
    status: IndianDivasBetStatus,
    amount?: number,
  ) => {
    const key = `${bet.transactionId}-${status}`;
    setActionKey(key);
    try {
      const body: Record<string, unknown> = {
        transactionId: bet.transactionId,
        status,
      };
      if (status === 'W') body.amount = Number(amount);

      const res = await secureApi('userReport.indianDivasUpdateBetStatus', body);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update bet');
        return;
      }
      toast.success(`Bet marked as ${indianDivasStatusLabel(status)}`);
      setWinDialogOpen(false);
      setSelectedBet(null);
      setWinAmount('');
      await fetchPendingBets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update bet status');
    } finally {
      setActionKey(null);
    }
  };

  const openWinDialog = (bet: IndianDivasPendingBet) => {
    setSelectedBet(bet);
    setWinAmount(
      bet.amount != null ? String(bet.amount) : bet.stake != null ? String(bet.stake) : '',
    );
    setWinDialogOpen(true);
  };

  const handleWinSubmit = () => {
    if (!selectedBet) return;
    const amount = Number(winAmount);
    if (!winAmount.trim() || Number.isNaN(amount) || amount < 0) {
      toast.error('Enter a valid win amount');
      return;
    }
    void updateBetStatus(selectedBet, 'W', amount);
  };

  const handleRollbackAll = async () => {
    if (!userId) {
      toast.error('User id missing');
      return;
    }
    setActionKey('rollback-all');
    try {
      const res = await secureApi('userReport.indianDivasRollbackAll', { userId });
      if (!res.ok) {
        toast.error(res.message || 'Rollback failed');
        return;
      }
      toast.success('All pending bets rolled back');
      setRollbackConfirmOpen(false);
      await fetchPendingBets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rollback pending bets');
    } finally {
      setActionKey(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1,
            pr: 1,
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700} component="div">
              Indian Divas Settle
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {loading
                ? 'Loading pending bets…'
                : `${bets.length} pending bet${bets.length === 1 ? '' : 's'}`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <IconButton
              size="small"
              onClick={() => void fetchPendingBets()}
              disabled={loading || busy}
              aria-label="Refresh"
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleClose} disabled={busy} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ bgcolor: 'action.hover' }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" minHeight={180} gap={1.5}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Fetching pending bets
              </Typography>
            </Stack>
          ) : bets.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" minHeight={180} gap={0.5}>
              <Typography fontWeight={700}>No pending bets</Typography>
              <Typography variant="body2" color="text.secondary">
                This user has no open Indian Divas bets to settle.
              </Typography>
            </Stack>
          ) : (
            <Box
              sx={{
                overflowX: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Transaction ID</TableCell>
                    <TableCell>Game / Market</TableCell>
                    <TableCell>Stake</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bets.map((bet, index) => {
                    const winBusy = actionKey === `${bet.transactionId}-W`;
                    const lossBusy = actionKey === `${bet.transactionId}-L`;
                    const rollbackBusy = actionKey === `${bet.transactionId}-R`;
                    return (
                      <TableRow key={bet.transactionId} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography
                            component="code"
                            variant="caption"
                            sx={{
                              display: 'inline-block',
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontFamily: 'monospace',
                              bgcolor: 'action.hover',
                              px: 1,
                              py: 0.5,
                              borderRadius: 0.75,
                            }}
                            title={bet.transactionId}
                          >
                            {bet.transactionId}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {bet.gameName || '—'}
                          </Typography>
                          {bet.marketName ? (
                            <Typography variant="caption" color="text.secondary">
                              {bet.marketName}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatIndianDivasMoney(bet.stake)}</TableCell>
                        <TableCell>{formatIndianDivasMoney(bet.amount)}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              disableElevation
                              disabled={busy}
                              onClick={() => openWinDialog(bet)}
                            >
                              {winBusy ? '…' : 'Win'}
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              disableElevation
                              disabled={busy}
                              onClick={() => void updateBetStatus(bet, 'L')}
                            >
                              {lossBusy ? '…' : 'Loss'}
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              disableElevation
                              disabled={busy}
                              onClick={() => void updateBetStatus(bet, 'R')}
                            >
                              {rollbackBusy ? '…' : 'Rollback'}
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={handleClose} disabled={busy}>
            Close
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            disabled={loading || busy || bets.length === 0}
            onClick={() => setRollbackConfirmOpen(true)}
          >
            Rollback All Pending
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={winDialogOpen}
        onClose={() => {
          if (busy) return;
          setWinDialogOpen(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Mark as Win</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Credits this amount to the wallet with Win history.
          </Typography>
          {selectedBet ? (
            <Typography
              component="code"
              variant="caption"
              sx={{
                display: 'block',
                mb: 1,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                bgcolor: 'action.hover',
                px: 1,
                py: 0.5,
                borderRadius: 0.75,
              }}
            >
              {selectedBet.transactionId}
            </Typography>
          ) : null}
          <TextField
            margin="dense"
            label="Win Amount"
            type="number"
            fullWidth
            value={winAmount}
            onChange={(e) => setWinAmount(e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWinDialogOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            disableElevation
            onClick={handleWinSubmit}
            disabled={busy}
          >
            {actionKey?.endsWith('-W') ? 'Updating…' : 'Confirm Win'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={rollbackConfirmOpen}
        onClose={() => {
          if (busy) return;
          setRollbackConfirmOpen(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rollback all pending?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This refunds stake for every pending Indian Divas bet for this user. This cannot be
            undone from here.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRollbackConfirmOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={() => void handleRollbackAll()}
            disabled={busy}
          >
            {actionKey === 'rollback-all' ? 'Rolling back…' : 'Rollback All'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
