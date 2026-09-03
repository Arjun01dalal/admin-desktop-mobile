import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Stack,
  Switch,
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
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { formatDisplayDate, formatDisplayTime, getStoredUser } from '@/utils/dates';
import { asPaged, display, useReportQuery } from '@/screens/panel/shared';

type InstantRow = {
  _id: string;
  name?: string;
  mid?: string | number;
  link?: string;
  status?: boolean;
  type?: string;
  openInBrowser?: boolean;
  updatedBy?: { userName?: string; userId?: string };
  updatedOn?: string;
};

type UpdateKind = 'gatewayName' | 'mid' | 'link';

const EMPTY_FORM = {
  gatewayName: '',
  midName: '',
  linkName: '',
  type: '',
  openInBrowser: true,
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function InstantDepositProvidersPage() {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  const [nameFilter, setNameFilter] = useState('');
  const [midFilter, setMidFilter] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [appliedMid, setAppliedMid] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [updateKind, setUpdateKind] = useState<UpdateKind>('mid');
  const [updateText, setUpdateText] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const buildPayload = useCallback(() => {
    const filter: Record<string, unknown> = {};
    if (appliedName.trim()) filter.name = appliedName.trim();
    if (appliedMid.trim()) filter.mid = appliedMid.trim();
    return { pageNo: 1, itemsPerPage: 100, filter };
  }, [appliedName, appliedMid]);

  const unpack = useCallback((res: { data?: unknown }) => {
    const paged = asPaged<InstantRow>(res.data);
    return { rows: paged.rows };
  }, []);

  const { rows, loading, load, setRows } = useReportQuery<InstantRow>({
    action: 'instantDeposit.list',
    buildPayload,
    unpack,
    autoDeps: [appliedName, appliedMid],
    errorMessage: 'Failed to load instant deposit providers',
  });

  const search = useCallback(() => {
    setAppliedName(nameFilter);
    setAppliedMid(midFilter);
  }, [nameFilter, midFilter]);

  const openUpdate = (id: string, kind: UpdateKind, current?: string) => {
    setActiveId(id);
    setUpdateKind(kind);
    setUpdateText(current || '');
    setUpdateOpen(true);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !form.gatewayName.trim() ||
      !form.midName.trim() ||
      !form.linkName.trim() ||
      !form.type.trim()
    ) {
      toast.error('Please fill gateway name, mid, link and type');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('instantDeposit.create', {
        name: form.gatewayName.trim(),
        link: form.linkName.trim(),
        mid: form.midName.trim(),
        openInBrowser: form.openInBrowser,
        type: form.type.trim().toLowerCase(),
        updatedBy: {
          userId: user?._id,
          userName: user?.name,
        },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add provider');
        return;
      }
      toast.success('Provider added');
      setAddOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!updateText.trim()) {
      toast.error('Please enter a value');
      return;
    }
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = { _id: activeId };
      if (updateKind === 'mid') data.mid = updateText.trim();
      else if (updateKind === 'gatewayName') {
        data.name = updateText.trim();
        data.User = { data: { _id: user?._id, name: user?.name } };
      } else data.link = updateText.trim();

      const action =
        updateKind === 'gatewayName' ? 'instantDeposit.updateName' : 'instantDeposit.updateInstant';
      const res = await secureApi(action, data);
      if (!res.ok) {
        toast.error(res.message || 'Failed to update');
        return;
      }
      toast.success('Updated');
      setUpdateOpen(false);
      setUpdateText('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('instantDeposit.delete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete');
        return;
      }
      toast.success('Deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = useCallback(
    async (row: InstantRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('instantDeposit.updateStatus', {
          _id: row._id,
          status: next,
          updatedBy: { userId: user?._id, userName: user?.name },
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => (item._id === row._id ? { ...item, status: next } : item)),
        );
        void load();
      } finally {
        setTogglingId('');
      }
    },
    [load, setRows, user],
  );

  const columns = useMemo<CommonTableColumn<InstantRow>[]>(
    () => [
      {
        id: 'name',
        label: 'Gateway Name',
        filter: (
          <TableSearchBar
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            onSearch={search}
            placeholder="Search by name"
          />
        ),
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.name)}</Typography>
            <IconButton size="small" onClick={() => openUpdate(row._id, 'gatewayName', row.name)}>
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'mid',
        label: 'Mid',
        filter: (
          <TableSearchBar
            value={midFilter}
            onChange={(e) => setMidFilter(e.target.value)}
            onSearch={search}
            placeholder="Search by Mid"
          />
        ),
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.mid)}</Typography>
            <IconButton
              size="small"
              onClick={() => openUpdate(row._id, 'mid', String(row.mid ?? ''))}
            >
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'link',
        label: 'Link',
        filter: <Box />,
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography
              variant="body2"
              sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {display(row.link)}
            </Typography>
            <IconButton size="small" onClick={() => openUpdate(row._id, 'link', row.link)}>
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'status',
        label: 'Status',
        filter: <Box />,
        render: (row) => (
          <Switch
            size="small"
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onChange={(_, checked) => void handleToggle(row, checked)}
          />
        ),
      },
      {
        id: 'updatedBy',
        label: 'Enable / Disable By',
        filter: <Box />,
        render: (row) => (
          <Stack spacing={0.25} alignItems="center">
            <Typography variant="body2">{display(row.updatedBy?.userName)}</Typography>
            {row.updatedOn ? (
              <Typography variant="caption" color="text.secondary">
                {formatDisplayDate(row.updatedOn)} {formatDisplayTime(row.updatedOn)}
              </Typography>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        filter: <Box />,
        render: (row) => (
          <IconButton
            size="small"
            color="error"
            onClick={() => {
              setActiveId(row._id);
              setDeleteOpen(true);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [nameFilter, midFilter, search, togglingId, handleToggle],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mb: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setForm(EMPTY_FORM);
            setAddOpen(true);
          }}
          sx={orangeBtnSx}
        >
          Add
        </Button>
      </Stack>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          getRowKey={(row) => row._id}
          emptyMessage="No instant deposit providers"
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Instant Deposit Provider</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleCreate(e)}>
          <DialogContent>
            <Stack spacing={1.5}>
              <TextField
                label="Gateway Name"
                fullWidth
                value={form.gatewayName}
                onChange={(e) => setForm((p) => ({ ...p, gatewayName: e.target.value }))}
              />
              <TextField
                label="Mid"
                fullWidth
                value={form.midName}
                onChange={(e) => setForm((p) => ({ ...p, midName: e.target.value }))}
              />
              <TextField
                label="Link"
                fullWidth
                value={form.linkName}
                onChange={(e) => setForm((p) => ({ ...p, linkName: e.target.value }))}
              />
              <TextField
                label="Type"
                fullWidth
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              />
              <FormControl>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Open In Browser
                </Typography>
                <RadioGroup
                  row
                  value={String(form.openInBrowser)}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, openInBrowser: e.target.value === 'true' }))
                  }
                >
                  <FormControlLabel value="true" control={<Radio size="small" />} label="Yes" />
                  <FormControlLabel value="false" control={<Radio size="small" />} label="No" />
                </RadioGroup>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? '…' : 'Submit'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={updateOpen} onClose={() => setUpdateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          Update {updateKind === 'mid' ? 'Mid' : updateKind === 'gatewayName' ? 'Name' : 'Link'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={updateKind === 'mid' ? 'Mid' : updateKind === 'gatewayName' ? 'Name' : 'Link'}
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={() => void handleUpdate()}
            sx={orangeBtnSx}
          >
            {submitting ? '…' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Are You Sure?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={submitting}
            onClick={() => void handleDelete()}
          >
            {submitting ? '…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
