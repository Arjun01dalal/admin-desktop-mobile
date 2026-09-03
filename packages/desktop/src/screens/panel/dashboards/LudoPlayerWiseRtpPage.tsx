import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type GameOption = { value: string; label: string };

type LocationState = {
  gameId?: string;
  gameOptions?: GameOption[];
};

type RtpUserRow = {
  userId?: string;
  gameId?: string;
  rtp?: number | string;
  houseEdge?: number | string;
  source?: string;
  operatorId?: string;
  updatedOn?: number | string;
  name?: string;
  mobile?: string;
  [key: string]: unknown;
};

type GameBound = { minRtp?: number; maxRtp?: number };
type GameBoundsMap = Record<string, GameBound>;

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const fieldSx = {
  minWidth: 160,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

function extractList(payload: unknown): RtpUserRow[] {
  if (Array.isArray(payload)) return payload as RtpUserRow[];
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ['overrides', 'data', 'users', 'list', 'items'] as const) {
    if (Array.isArray(obj[key])) return obj[key] as RtpUserRow[];
  }
  return [];
}

function formatUpdatedOn(value?: number | string) {
  if (value === undefined || value === null || value === '') return '—';
  const ts = Number(value);
  if (Number.isNaN(ts)) return String(value);
  return new Date(ts).toLocaleString('en-IN');
}

function formatRtpBound(value?: number) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(3);
}

function parseGameOptions(raw: unknown): GameOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { value: item, label: item };
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const value = rec.gameId ?? rec.id ?? rec.value ?? rec.gameName;
      const label = rec.gameName ?? rec.name ?? rec.label ?? rec.gameId ?? rec.id;
      if (!value) return null;
      return { value: String(value), label: String(label ?? value) };
    })
    .filter(Boolean) as GameOption[];
}

/** Port of admin-panel-domains LudoPlayerWiseRtp — per-player Ludo RTP overrides. */
export function LudoPlayerWiseRtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as LocationState;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RtpUserRow[]>([]);
  const [gameBounds, setGameBounds] = useState<GameBoundsMap>({});
  const [showGameBounds, setShowGameBounds] = useState(false);
  const [gameOptions, setGameOptions] = useState<GameOption[]>(state.gameOptions || []);
  const [filterGameId, setFilterGameId] = useState(
    state.gameId && state.gameId !== 'All' ? state.gameId : '',
  );
  const [filterUserId, setFilterUserId] = useState('');
  const [searchUserId, setSearchUserId] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formGameId, setFormGameId] = useState('');
  const [formRtp, setFormRtp] = useState('');

  const filteredRows = useMemo(() => {
    const q = searchUserId.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const userId = String(row?.userId ?? '').toLowerCase();
      const gameId = String(row?.gameId ?? '').toLowerCase();
      const source = String(row?.source ?? '').toLowerCase();
      return userId.includes(q) || gameId.includes(q) || source.includes(q);
    });
  }, [rows, searchUserId]);

  const gameBoundEntries = useMemo(
    () =>
      Object.entries(gameBounds).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [gameBounds],
  );

  const loadGameIds = useCallback(async () => {
    if (state.gameOptions?.length) {
      setGameOptions(state.gameOptions.filter((g) => g.value && g.value !== 'All'));
      return;
    }
    const res = await secureApi('dashboard.ludoGameIds', {});
    if (!res.ok) return;
    const payload = unpackPayload(res.data);
    const list =
      (Array.isArray(payload.gameIds) && payload.gameIds) ||
      (Array.isArray(payload.games) && payload.games) ||
      (Array.isArray(res.data) && res.data) ||
      [];
    setGameOptions(parseGameOptions(list).filter((g) => g.value !== 'All'));
  }, [state.gameOptions]);

  const fetchUsersRtp = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('dashboard.ludoPlayerRtpUsers', {});
      if (!res.ok) {
        setRows([]);
        setGameBounds({});
        toast.error(res.message || 'Failed to fetch player RTP list');
        return;
      }
      const payload = unpackPayload(res.data);
      const supported = payload.supportedGames ?? unpackPayload(res.data).supportedGames;
      const opts = parseGameOptions(supported);
      if (opts.length) setGameOptions(opts.filter((g) => g.value !== 'All'));

      const bounds =
        payload.gameBounds && typeof payload.gameBounds === 'object' && !Array.isArray(payload.gameBounds)
          ? (payload.gameBounds as GameBoundsMap)
          : {};
      setGameBounds(bounds);

      const list = extractList(payload);
      const userId = filterUserId.trim().toLowerCase();
      const gameId = filterGameId.trim().toLowerCase();
      setRows(
        list.filter((row) => {
          const rowUserId = String(row?.userId ?? '').toLowerCase();
          const rowGameId = String(row?.gameId ?? '').toLowerCase();
          if (userId && !rowUserId.includes(userId)) return false;
          if (gameId && rowGameId !== gameId) return false;
          return true;
        }),
      );
    } catch {
      setRows([]);
      setGameBounds({});
      toast.error('Failed to fetch player RTP list');
    } finally {
      setLoading(false);
    }
  }, [filterGameId, filterUserId]);

  useEffect(() => {
    void loadGameIds();
    void fetchUsersRtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  const openCreateDialog = useCallback(
    (row?: RtpUserRow) => {
      setFormUserId(String(row?.userId ?? ''));
      setFormGameId(String(row?.gameId ?? filterGameId ?? gameOptions[0]?.value ?? ''));
      setFormRtp(row?.rtp !== undefined && row?.rtp !== null ? String(row.rtp) : '');
      setDialogOpen(true);
    },
    [filterGameId, gameOptions],
  );

  const handleSaveRtp = useCallback(async () => {
    const userId = formUserId.trim();
    const gameId = formGameId.trim();
    const rtp = Number(formRtp);
    if (!userId) {
      toast.error('User ID is required');
      return;
    }
    if (!gameId) {
      toast.error('Game ID is required');
      return;
    }
    if (formRtp === '' || Number.isNaN(rtp)) {
      toast.error('Please enter a valid RTP value');
      return;
    }
    setSaving(true);
    try {
      const res = await secureApi('dashboard.ludoPlayerRtpUsersSet', { userId, gameId, rtp });
      if (!res.ok) {
        toast.error(res.message || 'Failed to save player RTP');
        return;
      }
      toast.success(res.message || 'Player RTP saved successfully');
      setDialogOpen(false);
      void fetchUsersRtp();
    } finally {
      setSaving(false);
    }
  }, [formUserId, formGameId, formRtp, fetchUsersRtp]);

  const columns = useMemo<CommonTableColumn<RtpUserRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 48,
        render: (_row, index) => index + 1,
      },
      { id: 'userId', label: 'User ID', render: (row) => display(row.userId) },
      { id: 'gameId', label: 'Game ID', render: (row) => display(row.gameId) },
      {
        id: 'rtp',
        label: 'RTP',
        render: (row) => <Typography sx={{ fontWeight: 700, fontSize: 12 }}>{display(row.rtp)}</Typography>,
      },
      { id: 'houseEdge', label: 'House Edge', render: (row) => display(row.houseEdge) },
      { id: 'source', label: 'Source', render: (row) => display(row.source) },
      { id: 'operatorId', label: 'Operator', render: (row) => display(row.operatorId) },
      {
        id: 'updatedOn',
        label: 'Updated On',
        render: (row) => formatUpdatedOn(row.updatedOn),
      },
      {
        id: 'action',
        label: 'Action',
        width: 90,
        render: (row) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => openCreateDialog(row)}
            sx={{ textTransform: 'none', fontSize: 11, py: 0.25 }}
          >
            Edit
          </Button>
        ),
      },
    ],
    [openCreateDialog],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title={toDisplayText('Player Wise RTP')}
        summary={`Total: ${filteredRows.length}`}
        headerActions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate(-1)}
              sx={{ textTransform: 'none' }}
            >
              Back
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <RefreshIcon />}
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                void fetchUsersRtp();
              }}
              sx={{ textTransform: 'none' }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => openCreateDialog()}
              sx={{ ...orangeBtnSx, height: 32 }}
            >
              Set Player RTP
            </Button>
          </Stack>
        }
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ width: '100%', overflowX: 'auto' }}
        >
          <TextField
            size="small"
            label="User ID"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            sx={{ ...fieldSx, width: 160, flex: '0 0 auto' }}
          />
          <TextField
            select
            size="small"
            label="Game ID"
            value={filterGameId}
            onChange={(e) => setFilterGameId(e.target.value)}
            sx={{ ...fieldSx, width: 180, flex: '0 0 auto' }}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {gameOptions.map((game) => (
              <MenuItem key={game.value} value={game.value}>
                {game.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Search"
            placeholder="userId / gameId / source"
            value={searchUserId}
            onChange={(e) => setSearchUserId(e.target.value)}
            sx={{ ...fieldSx, width: 220, flex: '0 0 auto' }}
          />
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => void fetchUsersRtp()}
            sx={{ ...orangeBtnSx, height: 40, flex: '0 0 auto', whiteSpace: 'nowrap' }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      {gameBoundEntries.length > 0 ? (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            onClick={() => setShowGameBounds((v) => !v)}
            sx={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <Typography variant="subtitle2" fontWeight={700}>
              Game Bounds ({gameBoundEntries.length})
            </Typography>
            <IconButton size="small">
              {showGameBounds ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Stack>
          <Collapse in={showGameBounds}>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} sx={{ mt: 1.5 }}>
              {gameBoundEntries.map(([gameId, bound]) => (
                <Box
                  key={gameId}
                  sx={{
                    minWidth: 160,
                    flex: '1 1 160px',
                    maxWidth: 240,
                    p: 1.25,
                    borderRadius: 1.5,
                    border: '1px solid rgba(255,159,10,0.2)',
                    bgcolor: 'rgba(255,159,10,0.06)',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                    {gameId}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Min RTP
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#66bb6a' }}>
                        {formatRtpBound(bound?.minRtp)}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary">
                        Max RTP
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#ef5350' }}>
                        {formatRtpBound(bound?.maxRtp)}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Collapse>
        </Box>
      ) : null}

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={filteredRows}
          getRowKey={(row, i) => `${row.userId}-${row.gameId}-${i}`}
          loading={loading}
          emptyMessage="No player RTP records found"
          stickyHeader
          dense
          minWidth={1100}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Set Player RTP</DialogTitle>
        <DialogContent>
          <Stack spacing={2} pt={1}>
            <TextField
              label="User ID"
              value={formUserId}
              onChange={(e) => setFormUserId(e.target.value)}
              fullWidth
              disabled={saving}
            />
            <TextField
              select
              label="Game ID"
              value={formGameId}
              onChange={(e) => setFormGameId(e.target.value)}
              fullWidth
              disabled={saving || !gameOptions.length}
            >
              {gameOptions.map((game) => (
                <MenuItem key={game.value} value={game.value}>
                  {game.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="RTP"
              type="number"
              value={formRtp}
              onChange={(e) => setFormRtp(e.target.value)}
              placeholder="e.g. 0.95"
              inputProps={{ step: '0.01' }}
              fullWidth
              disabled={saving}
              helperText="Example: 0.95"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveRtp()}
            disabled={saving}
            sx={orangeBtnSx}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
