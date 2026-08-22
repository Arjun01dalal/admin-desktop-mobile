import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { formatLudoRtp, parseLudoRtpList, type LudoRtpRow } from '@astro/shared/ludoRtp';
import {
  apiOtpFailed,
  maskOtpMobile,
  resolveWalletOtpMobile,
} from '@astro/shared/walletOtp';
import { secureApi } from '@/api/secureClient';
import { getSessionUser } from '@/auth/permissions';

export type LudoModalAction = 'update' | 'rtp' | null;

type Props = {
  open: boolean;
  action: LudoModalAction;
  existingGameIds?: string[];
  onClose: () => void;
  onGameIdsUpdated?: () => void;
};

const parseGameIds = (input: string): string[] =>
  Array.from(
    new Set(
      input
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );

/**
 * Ludo Update Game IDs + Update RTP dialogs
 * (ported from admin-panel-domains LudoDetailsModal).
 */
export function LudoDetailsModal({
  open,
  action,
  existingGameIds = [],
  onClose,
  onGameIdsUpdated,
}: Props) {
  const [addInput, setAddInput] = useState('');
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [selectedRtpGameId, setSelectedRtpGameId] = useState('');
  const [rtpValue, setRtpValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [rtpLoading, setRtpLoading] = useState(false);
  const [rtpListLoading, setRtpListLoading] = useState(false);
  const [rtpRows, setRtpRows] = useState<LudoRtpRow[]>([]);
  const [currentGameIds, setCurrentGameIds] = useState<string[]>([]);
  const [otpPending, setOtpPending] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const otpMobile = resolveWalletOtpMobile(getSessionUser()?.mobile);

  const gameIdsKey = existingGameIds.join(',');
  const updateOpen = open && action === 'update';
  const rtpOpen = open && action === 'rtp';

  useEffect(() => {
    const gameIds = existingGameIds.filter((id) => id && id !== 'All');
    setCurrentGameIds(gameIds);
  }, [gameIdsKey]);

  useEffect(() => {
    if (!open) return;
    setAddInput('');
    setSelectedToRemove([]);
    setRtpValue('');
    setSelectedRtpGameId('');
    setOtpPending(false);
    setOtp('');
    setOtpSending(false);
    setOtpVerifying(false);
    setOtpSent(false);
  }, [open, action]);

  const loadRtpList = useCallback(async () => {
    setRtpListLoading(true);
    try {
      const res = await secureApi<unknown>('dashboard.ludoRtpGet', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to load RTP list');
        setRtpRows([]);
        return;
      }
      const rows = parseLudoRtpList(res.data);
      setRtpRows(rows);
      if (rows.length) {
        setSelectedRtpGameId((prev) => prev || rows[0].gameId);
        setRtpValue((prev) => (prev ? prev : String(rows[0].rtp ?? '')));
      }
    } catch {
      toast.error('Failed to load RTP list');
      setRtpRows([]);
    } finally {
      setRtpListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rtpOpen) void loadRtpList();
  }, [rtpOpen, loadRtpList]);

  const callGameIdsApi = async (payload: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await secureApi('dashboard.ludoGameIdsUpdate', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update game IDs');
        return false;
      }
      toast.success(res.message || 'Game IDs updated successfully');
      onGameIdsUpdated?.();
      return true;
    } catch {
      toast.error('Failed to update game IDs');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const gameIds = parseGameIds(addInput);
    if (!gameIds.length) {
      toast.error('Please enter at least one game ID to add');
      return;
    }
    const success = await callGameIdsApi({ action: 'add', gameIds });
    if (success) {
      setAddInput('');
      setCurrentGameIds((prev) => Array.from(new Set([...prev, ...gameIds])));
    }
  };

  const handleRemove = async () => {
    if (!selectedToRemove.length) {
      toast.error('Please select at least one game ID to remove');
      return;
    }
    const success = await callGameIdsApi({
      action: 'remove',
      gameIds: selectedToRemove,
    });
    if (success) {
      setCurrentGameIds((prev) =>
        prev.filter((id) => !selectedToRemove.includes(id)),
      );
      setSelectedToRemove([]);
    }
  };

  const toggleRemoveSelection = (gameId: string) => {
    setSelectedToRemove((prev) =>
      prev.includes(gameId)
        ? prev.filter((id) => id !== gameId)
        : [...prev, gameId],
    );
  };

  const handleCloseUpdate = () => {
    if (loading) return;
    onClose();
  };

  const handleCloseRtp = () => {
    if (rtpLoading || rtpListLoading || otpSending || otpVerifying) return;
    onClose();
  };

  const selectRtpRow = (row: LudoRtpRow) => {
    setSelectedRtpGameId(row.gameId);
    setRtpValue(String(row.rtp ?? ''));
    setOtpPending(false);
    setOtp('');
  };

  const performRtpUpdate = async () => {
    if (!selectedRtpGameId) {
      toast.error('Please select a game');
      return false;
    }
    const rtp = Number(rtpValue);
    if (rtpValue === '' || !Number.isFinite(rtp) || rtp < 0) {
      toast.error('Please enter a valid RTP value');
      return false;
    }

    setRtpLoading(true);
    try {
      const res = await secureApi('dashboard.ludoRtp', {
        gameId: selectedRtpGameId,
        rtp,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update RTP');
        return false;
      }
      toast.success(res.message || 'RTP updated successfully');
      setRtpRows((prev) =>
        prev.map((row) =>
          row.gameId === selectedRtpGameId ? { ...row, rtp } : row,
        ),
      );
      setOtpPending(false);
      setOtp('');
      return true;
    } catch {
      toast.error('Failed to update RTP');
      return false;
    } finally {
      setRtpLoading(false);
    }
  };

  const sendRtpOtp = async () => {
    setOtpSending(true);
    try {
      const res = await secureApi('users.sendWalletOtp', { mobile: otpMobile });
      if (apiOtpFailed(res)) {
        toast.error(res.message || 'Failed to send OTP');
        return false;
      }
      setOtpSent(true);
      toast.success(`OTP sent to SuperAdmin (${maskOtpMobile(otpMobile)})`);
      return true;
    } catch {
      toast.error('Failed to send OTP');
      return false;
    } finally {
      setOtpSending(false);
    }
  };

  const beginRtpOtpVerification = async () => {
    if (!selectedRtpGameId) {
      toast.error('Please select a game');
      return;
    }
    const rtp = Number(rtpValue);
    if (rtpValue === '' || !Number.isFinite(rtp) || rtp < 0) {
      toast.error('Please enter a valid RTP value');
      return;
    }
    setOtp('');
    setOtpPending(true);
    await sendRtpOtp();
  };

  const verifyRtpOtpAndUpdate = async () => {
    const code = otp.trim();
    if (code.length !== 4) {
      toast.error('OTP must be 4 digits');
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await secureApi('users.verifyBlockOtp', {
        mobile: otpMobile,
        otp: Number(code),
      });
      if (apiOtpFailed(res)) {
        toast.error(res.message || 'Invalid OTP');
        return;
      }
      await performRtpUpdate();
    } finally {
      setOtpVerifying(false);
    }
  };

  const selectedRow = rtpRows.find((row) => row.gameId === selectedRtpGameId);

  return (
    <>
      <Dialog
        open={updateOpen}
        onClose={handleCloseUpdate}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Update Game IDs</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Current Game IDs
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" sx={{ mb: 3 }}>
            {currentGameIds.length ? (
              currentGameIds.map((id) => (
                <Chip
                  key={id}
                  label={id}
                  color={selectedToRemove.includes(id) ? 'error' : 'default'}
                  variant={
                    selectedToRemove.includes(id) ? 'filled' : 'outlined'
                  }
                  onClick={() => toggleRemoveSelection(id)}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary">
                No game IDs found
              </Typography>
            )}
          </Box>

          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Add
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Game IDs to add"
              placeholder="Game IDs to add"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              disabled={loading}
              sx={{ mb: 1.5 }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => void handleAdd()}
              disabled={loading}
            >
              Add
            </Button>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Remove
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Click chips above to select game IDs for removal
              {selectedToRemove.length
                ? ` (${selectedToRemove.length} selected)`
                : ''}
              .
            </Typography>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={() => void handleRemove()}
              disabled={loading || !selectedToRemove.length}
            >
              Remove
            </Button>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUpdate} disabled={loading}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rtpOpen} onClose={handleCloseRtp} fullWidth maxWidth="sm">
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={700}>
              Update RTP
            </Typography>
            <Button
              size="small"
              onClick={() => void loadRtpList()}
              disabled={rtpListLoading || rtpLoading || otpSending || otpVerifying}
            >
              Refresh
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Game-wise RTP
          </Typography>

          {rtpListLoading ? (
            <Stack alignItems="center" py={2}>
              <CircularProgress size={28} />
            </Stack>
          ) : rtpRows.length ? (
            <Stack
              sx={{
                mb: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {rtpRows.map((row) => {
                const active = selectedRtpGameId === row.gameId;
                return (
                  <Stack
                    key={row.gameId}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    onClick={() => selectRtpRow(row)}
                    sx={{
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      bgcolor: active ? 'action.selected' : 'transparent',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1, pr: 1 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {row.gameName || row.gameId}
                      </Typography>
                      {row.gameName ? (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          ID: {row.gameId}
                        </Typography>
                      ) : null}
                    </Box>
                    <Typography variant="body2" fontWeight={800} color="primary.main">
                      {formatLudoRtp(row.rtp)}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No RTP data found
            </Typography>
          )}

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              {selectedRow
                ? `Edit RTP — ${selectedRow.gameName || selectedRow.gameId}`
                : 'Edit RTP'}
            </Typography>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="RTP"
              placeholder="e.g. 0, 0.8, 0.9, 1"
              value={rtpValue}
              onChange={(e) => {
                setRtpValue(e.target.value);
                setOtpPending(false);
                setOtp('');
              }}
              disabled={rtpLoading || otpVerifying || !selectedRtpGameId}
              inputProps={{ step: 'any', min: 0 }}
            />

            {otpPending ? (
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  OTP sent to SuperAdmin ({maskOtpMobile(otpMobile)}). Verify to save RTP
                  for {selectedRtpGameId} → {rtpValue}.
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="OTP"
                  placeholder="4-digit OTP"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  disabled={otpVerifying || rtpLoading}
                  inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                />
              </Stack>
            ) : null}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseRtp}
            disabled={rtpLoading || rtpListLoading || otpSending || otpVerifying}
          >
            Close
          </Button>
          {otpPending ? (
            <>
              <Button
                onClick={() => {
                  setOtpPending(false);
                  setOtp('');
                }}
                disabled={otpVerifying || rtpLoading}
              >
                Cancel OTP
              </Button>
              <Button
                onClick={() => void sendRtpOtp()}
                disabled={otpSending || otpVerifying || rtpLoading}
              >
                Resend OTP
              </Button>
              <Button
                variant="contained"
                onClick={() => void verifyRtpOtpAndUpdate()}
                disabled={
                  otpVerifying ||
                  rtpLoading ||
                  !otpSent ||
                  otp.trim().length !== 4
                }
              >
                {otpVerifying || rtpLoading ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  'Verify & Update'
                )}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              onClick={() => void beginRtpOtpVerification()}
              disabled={
                rtpLoading ||
                rtpListLoading ||
                otpSending ||
                !selectedRtpGameId
              }
            >
              {otpSending ? <CircularProgress size={18} color="inherit" /> : 'Update RTP'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
