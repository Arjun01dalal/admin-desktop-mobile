import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';

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
  const [currentGameIds, setCurrentGameIds] = useState<string[]>([]);

  const gameIdsKey = existingGameIds.join(',');
  const updateOpen = open && action === 'update';
  const rtpOpen = open && action === 'rtp';

  useEffect(() => {
    const gameIds = existingGameIds.filter((id) => id && id !== 'All');
    setCurrentGameIds(gameIds);
    if (!selectedRtpGameId && gameIds.length) {
      setSelectedRtpGameId(gameIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdsKey]);

  useEffect(() => {
    if (!open) return;
    setAddInput('');
    setSelectedToRemove([]);
    setRtpValue('');
    const gameIds = existingGameIds.filter((id) => id && id !== 'All');
    if (action === 'rtp') {
      setSelectedRtpGameId(gameIds[0] || '');
    }
  }, [open, action, existingGameIds]);

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
    if (rtpLoading) return;
    onClose();
  };

  const handleUpdateRtp = async () => {
    if (!selectedRtpGameId) {
      toast.error('Please select a game ID');
      return;
    }
    const rtp = Number(rtpValue);
    if (rtpValue === '' || Number.isNaN(rtp)) {
      toast.error('Please enter a valid RTP value');
      return;
    }

    setRtpLoading(true);
    try {
      const res = await secureApi('dashboard.ludoRtp', {
        gameId: selectedRtpGameId,
        rtp,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update RTP');
        return;
      }
      toast.success(res.message || 'RTP updated successfully');
      setRtpValue('');
      onClose();
    } catch {
      toast.error('Failed to update RTP');
    } finally {
      setRtpLoading(false);
    }
  };

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
        <DialogTitle>Update RTP</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="rtp-game-id-label">Game ID</InputLabel>
            <Select
              labelId="rtp-game-id-label"
              label="Game ID"
              value={selectedRtpGameId}
              onChange={(e) => setSelectedRtpGameId(String(e.target.value))}
              disabled={rtpLoading || !currentGameIds.length}
            >
              {currentGameIds.length ? (
                currentGameIds.map((id) => (
                  <MenuItem key={id} value={id}>
                    {id}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="" disabled>
                  No game IDs available
                </MenuItem>
              )}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            size="small"
            type="number"
            label="RTP"
            placeholder="RTP"
            value={rtpValue}
            onChange={(e) => setRtpValue(e.target.value)}
            disabled={rtpLoading}
            inputProps={{ step: 'any', min: 0 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRtp} disabled={rtpLoading}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleUpdateRtp()}
            disabled={rtpLoading || !currentGameIds.length}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
