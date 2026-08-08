import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import {
  buildGameRows,
  formatCategoryLabel,
  formatDateValue,
  getGameName,
  getImageUrl,
  getProviderName,
  normalizePayload,
} from '@/screens/panel/topGames/helpers';
import type {
  DeleteTarget,
  GameRow,
  StatusTarget,
  TopGamesDoc,
} from '@/screens/panel/topGames/types';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

function unpackDoc(data: unknown): TopGamesDoc {
  if (!data || typeof data !== 'object') return { data: {} };
  const obj = data as Record<string, unknown>;
  const inner = obj.payload ?? obj;
  return normalizePayload(inner);
}

export function TopGamesPage() {
  useRevealCodes();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [doc, setDoc] = useState<TopGamesDoc | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('topGames.completeDoc', {});
      if (!res.ok) {
        toast.error(res.message || 'Failed to fetch top games');
        setDoc(null);
        return;
      }
      const normalized = unpackDoc(res.data);
      const keys = Object.keys(normalized.data || {});
      setDoc(normalized);
      setSelectedCategory((prev) =>
        prev !== 'All' && keys.includes(prev) ? prev : 'All',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGames();
  }, [loadGames]);

  const categoryKeys = useMemo(
    () => Object.keys(doc?.data || {}),
    [doc?.data],
  );

  const games = useMemo(
    () => buildGameRows(doc?.data || {}, selectedCategory, appliedSearch),
    [doc?.data, selectedCategory, appliedSearch],
  );

  const activeCount = useMemo(
    () => games.reduce((count, item) => count + (item.status ? 1 : 0), 0),
    [games],
  );

  const applySearch = () => setAppliedSearch(search.trim());

  const openDelete = (item: GameRow) => {
    if (!item._categoryKey || !item._position) {
      toast.error('Invalid game position');
      return;
    }
    setDeleteTarget({
      category: item._categoryKey,
      position: item._position,
      name: getGameName(item),
    });
  };

  const openStatus = (item: GameRow, status: boolean) => {
    if (!item._categoryKey || !item.gameId) {
      toast.error('Category and Game ID are required');
      return;
    }
    setStatusTarget({
      category: item._categoryKey,
      gameId: item.gameId,
      status,
      name: getGameName(item),
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const res = await secureApi('topGames.removeAtPosition', {
        category: deleteTarget.category,
        position: deleteTarget.position,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to remove game');
        return;
      }
      setDoc((prev) => {
        if (!prev?.data?.[deleteTarget.category]) return prev;
        const nextList = [...prev.data[deleteTarget.category]];
        nextList.splice(deleteTarget.position - 1, 1);
        return {
          ...prev,
          data: { ...prev.data, [deleteTarget.category]: nextList },
        };
      });
      toast.success('Game removed successfully');
    } finally {
      setDeleteTarget(null);
      setActionLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget) return;
    setActionLoading(true);
    try {
      const res = await secureApi('topGames.updateStatus', {
        category: statusTarget.category,
        gameId: statusTarget.gameId,
        status: statusTarget.status,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update status');
        return;
      }
      setDoc((prev) => {
        if (!prev?.data?.[statusTarget.category]) return prev;
        return {
          ...prev,
          data: {
            ...prev.data,
            [statusTarget.category]: prev.data[statusTarget.category].map(
              (game) =>
                game.gameId === statusTarget.gameId
                  ? { ...game, status: statusTarget.status }
                  : game,
            ),
          },
        };
      });
      toast.success(
        `Status ${statusTarget.status ? 'activated' : 'deactivated'} successfully`,
      );
    } finally {
      setStatusTarget(null);
      setActionLoading(false);
    }
  };

  const busy = loading || actionLoading;

  const columns = useMemo<CommonTableColumn<GameRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_row, index) => index + 1,
      },
      {
        id: 'image',
        label: 'Image',
        width: 72,
        render: (row) => {
          const url = getImageUrl(row);
          if (!url) return '-';
          return (
            <Box
              component="img"
              src={url}
              alt={getGameName(row)}
              sx={{
                width: 48,
                height: 48,
                objectFit: 'cover',
                borderRadius: 1,
                display: 'block',
                mx: 'auto',
              }}
            />
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => getGameName(row),
      },
      {
        id: 'gameId',
        label: 'Game ID',
        render: (row) => row.gameId || '-',
      },
      {
        id: 'provider',
        label: 'Provider',
        render: (row) => getProviderName(row),
      },
      {
        id: 'categoryGroup',
        label: 'Category Group',
        render: (row) => formatCategoryLabel(row._categoryKey),
      },
      {
        id: 'category',
        label: 'Game Category',
        render: (row) => row.category || '-',
      },
      {
        id: 'status',
        label: 'Status',
        width: 90,
        render: (row) => (
          <Switch
            size="small"
            checked={!!row.status}
            disabled={actionLoading}
            onChange={(_, checked) => openStatus(row, checked)}
            inputProps={{ 'aria-label': 'Change status' }}
          />
        ),
      },
      {
        id: 'updatedOn',
        label: 'Updated On',
        render: (row) => formatDateValue(row.updatedOn || row.createdOn),
      },
      {
        id: 'action',
        label: 'Action',
        width: 72,
        render: (row) => (
          <IconButton
            size="small"
            color="error"
            disabled={actionLoading}
            onClick={() => openDelete(row)}
            aria-label="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [actionLoading],
  );

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
          {toDisplayText('Top Games')}
        </Typography>
        <Button
          startIcon={
            loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshIcon />
            )
          }
          onClick={() => void loadGames()}
          disabled={busy}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <Stack
        direction="row"
        alignItems="flex-end"
        flexWrap="wrap"
        gap={2}
        mb={2}
      >
        <TextField
          select
          size="small"
          label="Category"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="All">All</MenuItem>
          {categoryKeys.map((key) => (
            <MenuItem key={key} value={key}>
              {formatCategoryLabel(key)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Search"
          placeholder="Name / Game ID / Provider"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applySearch();
          }}
          sx={{ minWidth: 240 }}
        />
        <Button onClick={applySearch} sx={orangeBtnSx}>
          Apply
        </Button>
      </Stack>

      <Typography fontWeight={700} mb={1.5}>
        Showing: {games.length} | Active: {activeCount}
      </Typography>

      <CommonTable
        columns={columns}
        rows={games}
        getRowKey={(row, i) =>
          `${row._categoryKey}-${row.gameId || row._id || i}-${row._position}`
        }
        loading={busy}
        emptyMessage="No top games found"
        minWidth={1000}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove game</DialogTitle>
        <DialogContent>
          Do you want to remove{' '}
          <strong>{deleteTarget?.name || 'this game'}</strong> from{' '}
          <strong>
            {deleteTarget
              ? formatCategoryLabel(deleteTarget.category)
              : '-'}
          </strong>{' '}
          at position <strong>{deleteTarget?.position}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void handleDelete()}
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!statusTarget} onClose={() => setStatusTarget(null)}>
        <DialogTitle>Change status</DialogTitle>
        <DialogContent>
          Do you want to{' '}
          <strong>
            {statusTarget?.status ? 'activate' : 'deactivate'}
          </strong>{' '}
          <strong>{statusTarget?.name || 'this game'}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusTarget(null)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleStatusChange()}
            disabled={actionLoading}
            sx={orangeBtnSx}
          >
            {actionLoading ? <CircularProgress size={18} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
