import { useCallback, useMemo, useRef, useState } from 'react';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { copyToClipboard } from '@/utils/clipboard';
import { asList, useReportQuery } from '@/screens/panel/shared';

type SocialMediaRow = {
  _id: string;
  name?: string;
  link?: string;
  [key: string]: unknown;
};

const EMPTY_FORM = { name: '', link: '' };
/** Shared decoy until the 6th name-click unlocks the real link. */
const SHARE_DECOY_URL = 'https://astropixel.live/';
/** Every Nth click on a name copies that row's real link. */
const COPY_LINK_EVERY_N_CLICKS = 6;

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function SocialMediaPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const nameClickCountsRef = useRef<Record<string, number>>({});

  const handleNameClick = useCallback((row: SocialMediaRow) => {
    const key = row._id;
    const next = (nameClickCountsRef.current[key] || 0) + 1;
    nameClickCountsRef.current[key] = next;

    const realLink = String(row.link || '').trim();
    const unlock = next % COPY_LINK_EVERY_N_CLICKS === 0;
    const toCopy = unlock ? realLink : SHARE_DECOY_URL;

    if (unlock && !realLink) {
      toast.error('No link available');
      return;
    }

    void copyToClipboard(toCopy, {
      successMessage: unlock ? 'Link copied' : 'Copied',
    });
  }, []);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: asList<SocialMediaRow>(res.data) }),
    [],
  );

  const { rows, loading, load } = useReportQuery<SocialMediaRow>({
    action: 'ops.socialMediaGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load social media links',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((row: SocialMediaRow) => {
    setActiveId(row._id);
    setForm({ name: row.name || '', link: row.link || '' });
    setEditOpen(true);
  }, []);

  const openDelete = useCallback((row: SocialMediaRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.name.trim() || !form.link.trim()) {
        toast.error('Enter Name and Link');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.socialMediaCreate', {
          name: form.name.trim(),
          link: form.link.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add social media link');
          return;
        }
        toast.success('Social media link added');
        setAddOpen(false);
        setForm(EMPTY_FORM);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [form, load],
  );

  const handleUpdate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.name.trim() || !form.link.trim()) {
        toast.error('Enter Name and Link');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.socialMediaUpdate', {
          _id: activeId,
          name: form.name.trim(),
          link: form.link.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update social media link');
          return;
        }
        toast.success('Social media link updated');
        setEditOpen(false);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [activeId, form, load],
  );

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.socialMediaDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete social media link');
        return;
      }
      toast.success('Social media link deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<CommonTableColumn<SocialMediaRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 64,
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => (
          <Box
            component="button"
            type="button"
            onClick={() => handleNameClick(row)}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 600,
              '&:hover': { color: '#ff9f0a' },
            }}
          >
            {row.name || '—'}
          </Box>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        width: 120,
        render: (row) => (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
            <IconButton
              size="small"
              aria-label="Edit"
              onClick={() => openEdit(row)}
              sx={{ color: '#ff9f0a' }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Delete"
              onClick={() => openDelete(row)}
              sx={{ color: '#f44336' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [handleNameClick, openEdit, openDelete],
  );

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
          Social Media
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            sx={orangeBtnSx}
          >
            Add
          </Button>
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
        emptyMessage="No social media links found"
        stickyHeader
        dense
        minWidth={600}
        maxHeight="calc(100vh - 220px)"
      />

      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={handleCreate}>
          <DialogTitle>Add Social Media</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                autoFocus
              />
              <TextField
                label="Link"
                size="small"
                fullWidth
                value={form.link}
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
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

      <Dialog open={editOpen} onClose={() => !submitting && setEditOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={handleUpdate}>
          <DialogTitle>Edit Social Media</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                autoFocus
              />
              <TextField
                label="Link"
                size="small"
                fullWidth
                value={form.link}
                onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? 'Saving…' : 'Submit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => !submitting && setDeleteOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This social media link will be permanently removed.
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
