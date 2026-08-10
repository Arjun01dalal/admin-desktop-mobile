import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { asList, useReportQuery } from '@/screens/panel/shared';

type BannerRow = {
  _id: string;
  imagePath?: string;
  gameName?: string;
  type?: string;
  status?: boolean;
  position?: number;
  [key: string]: unknown;
};

const EMPTY_FORM = { url: '', gameName: '', type: '' };

const POSITION_OPTIONS = Array.from({ length: 25 }, (_, i) => i + 1);

const fieldSx = {
  minWidth: 88,
  width: 96,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function BannersPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [positionDrafts, setPositionDrafts] = useState<Record<string, string>>({});
  const [savingPositionId, setSavingPositionId] = useState('');

  const canAdd = hasPermission(Permissions.Add_Banner);
  const canToggle = hasPermission(Permissions.Toggle_Banner);
  const canDelete = hasPermission(Permissions.Delete_Banner);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback((res: { data?: unknown }) => {
    const list = asList<BannerRow>(res.data);
    const sorted = [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return { rows: sorted };
  }, []);

  const { rows, loading, load, setRows } = useReportQuery<BannerRow>({
    action: 'ops.bannersGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load banners',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openDelete = useCallback((row: BannerRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.url.trim() || !form.gameName.trim() || !form.type.trim()) {
        toast.error('Please fill image URL, game name and type');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.bannersCreate', {
          imagePath: form.url.trim(),
          gameName: form.gameName.trim(),
          type: form.type.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add banner');
          return;
        }
        toast.success('Banner added');
        setAddOpen(false);
        setForm(EMPTY_FORM);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [form, load],
  );

  const handleToggleStatus = useCallback(
    async (row: BannerRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('ops.bannersUpdate', { _id: row._id, status: next });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => (item._id === row._id ? { ...item, status: next } : item)),
        );
      } finally {
        setTogglingId('');
      }
    },
    [setRows],
  );

  const handleUpdatePosition = useCallback(
    async (row: BannerRow) => {
      const raw = positionDrafts[row._id] ?? String(row.position ?? '');
      const position = Number(raw);
      if (!position || position < 1) {
        toast.error('Please enter a valid position');
        return;
      }
      setSavingPositionId(row._id);
      try {
        const res = await secureApi('ops.bannersUpdatePosition', { _id: row._id, position });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update position');
          return;
        }
        toast.success('Position updated');
        void load();
      } finally {
        setSavingPositionId('');
      }
    },
    [positionDrafts, load],
  );

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.bannersDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete banner');
        return;
      }
      toast.success('Banner deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<CommonTableColumn<BannerRow>[]>(() => {
    const cols: CommonTableColumn<BannerRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'image',
        label: 'Image',
        width: 120,
        render: (row) =>
          row.imagePath ? (
            <Box
              component="img"
              src={row.imagePath}
              alt={row.gameName || 'Banner'}
              sx={{
                height: 56,
                width: 96,
                objectFit: 'cover',
                borderRadius: 1,
                display: 'block',
                mx: 'auto',
              }}
            />
          ) : (
            '—'
          ),
      },
      {
        id: 'gameName',
        label: 'Game Name',
        render: (row) => row.gameName || '—',
      },
    ];

    if (canToggle) {
      cols.push({
        id: 'status',
        label: 'Status',
        width: 90,
        render: (row) => (
          <Switch
            size="small"
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onChange={(_e, checked) => void handleToggleStatus(row, checked)}
            color="warning"
          />
        ),
      });
    }

    cols.push(
      {
        id: 'type',
        label: 'Type',
        render: (row) => row.type || '—',
      },
      {
        id: 'position',
        label: 'Position',
        width: 140,
        render: (row) => {
          const draft = positionDrafts[row._id];
          const current = draft ?? String(row.position ?? '');
          const selectValue =
            current && POSITION_OPTIONS.includes(Number(current)) ? current : '';

          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <TextField
                select
                size="small"
                value={selectValue}
                onChange={(e) =>
                  setPositionDrafts((prev) => ({ ...prev, [row._id]: e.target.value }))
                }
                sx={fieldSx}
              >
                <MenuItem value="">—</MenuItem>
                {POSITION_OPTIONS.map((n) => (
                  <MenuItem key={n} value={String(n)}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton
                size="small"
                aria-label="Save position"
                disabled={savingPositionId === row._id}
                onClick={() => void handleUpdatePosition(row)}
                sx={{ color: '#ff9f0a' }}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        },
      },
    );

    if (canDelete) {
      cols.push({
        id: 'action',
        label: 'Action',
        width: 80,
        render: (row) => (
          <IconButton
            size="small"
            aria-label="Delete"
            onClick={() => openDelete(row)}
            sx={{ color: '#f44336' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      });
    }

    return cols;
  }, [
    canToggle,
    canDelete,
    togglingId,
    handleToggleStatus,
    positionDrafts,
    savingPositionId,
    handleUpdatePosition,
    openDelete,
  ]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1.5}
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          Banners List
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          {canAdd ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openAdd}
              sx={orangeBtnSx}
            >
              Add
            </Button>
          ) : null}
          <Button
            variant="outlined"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={() => void load()}
            disabled={loading}
            sx={{
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#e8e8ea',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
              },
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No banners found"
        stickyHeader
        dense
        minWidth={1000}
        maxHeight="calc(100vh - 220px)"
      />

      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={handleCreate}>
          <DialogTitle>Add Banner</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Image URL"
                size="small"
                fullWidth
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                autoFocus
              />
              <TextField
                label="Game Name"
                size="small"
                fullWidth
                value={form.gameName}
                onChange={(e) => setForm((prev) => ({ ...prev, gameName: e.target.value }))}
              />
              <TextField
                label="Type"
                size="small"
                fullWidth
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? 'Saving…' : 'Submit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => !submitting && setDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This banner will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
