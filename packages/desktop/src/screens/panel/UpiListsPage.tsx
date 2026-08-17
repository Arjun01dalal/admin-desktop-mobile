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
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { asList, useReportQuery } from '@/screens/panel/shared';

type UpiRow = {
  _id: string;
  name?: string;
  upiId?: string;
  status?: boolean;
  [key: string]: unknown;
};

const EMPTY_FORM = { name: '', upiId: '', status: false };

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function UpiListsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const canAdd = hasPermission(Permissions.Add_UPI);
  const canToggle = hasPermission(Permissions.Toggle_UPI);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: asList<UpiRow>(res.data) }),
    [],
  );

  const { rows, loading, load, setRows } = useReportQuery<UpiRow>({
    action: 'ops.upiGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load UPI list',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openDelete = useCallback((row: UpiRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.name.trim() || !form.upiId.trim()) {
        toast.error('Enter PN and UPI Id');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.upiCreate', {
          name: form.name.trim(),
          upiId: form.upiId.trim(),
          status: form.status,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add UPI');
          return;
        }
        toast.success('UPI added');
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
    async (row: UpiRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('ops.upiUpdate', { _id: row._id, status: next });
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

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.upiDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete UPI');
        return;
      }
      toast.success('UPI deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<CommonTableColumn<UpiRow>[]>(() => {
    const cols: CommonTableColumn<UpiRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'pn',
        label: 'PN',
        render: (row) => row.name || '—',
      },
      {
        id: 'upiId',
        label: 'UPI Id',
        render: (row) => row.upiId || '—',
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

    return cols;
  }, [canToggle, togglingId, handleToggleStatus, openDelete]);

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
          AB UPIs
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

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row._id}
          loading={loading}
          emptyMessage="No UPI records found"
          stickyHeader
          dense
          minWidth={600}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={handleCreate}>
          <DialogTitle>Add UPI</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="PN"
                size="small"
                fullWidth
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                autoFocus
              />
              <TextField
                label="UPI Id"
                size="small"
                fullWidth
                value={form.upiId}
                onChange={(e) => setForm((prev) => ({ ...prev, upiId: e.target.value }))}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.status}
                    onChange={(_e, checked) =>
                      setForm((prev) => ({ ...prev, status: checked }))
                    }
                    color="warning"
                  />
                }
                label={form.status ? 'Active' : 'Inactive'}
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
            This UPI entry will be permanently removed.
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
