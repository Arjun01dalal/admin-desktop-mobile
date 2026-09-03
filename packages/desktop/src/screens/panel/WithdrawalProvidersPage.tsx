import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { getStoredUser, todayIST } from '@/utils/dates';
import { asList, display, useReportQuery } from '@/screens/panel/shared';

type WithdrawalRow = {
  _id: string;
  name?: string;
  displayName?: string;
  gatewayImage?: string;
  mid?: string;
  link?: string;
  redirectionLink?: string;
  status?: boolean;
  token?: string;
  cookies?: string;
};

type FormState = {
  name: string;
  link: string;
  mid: string;
  token: string;
  cookies: string;
  status: boolean;
};

type UpdateKind = 'displayName' | 'gatewayImg' | 'mid' | 'link';

const EMPTY_FORM: FormState = {
  name: '',
  link: '',
  mid: '',
  token: '',
  cookies: '',
  status: false,
};

const UPDATE_LABELS: Record<UpdateKind, string> = {
  displayName: 'Display Name',
  gatewayImg: 'Gateway Image URL',
  mid: 'Mid',
  link: 'Link',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const dateFieldSx = {
  width: 160,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

export function WithdrawalProvidersPage() {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  const canAdd = hasPermission(Permissions.Add_PayOut_Account);
  const canToggle = hasPermission(Permissions.Toggle_PayOut_Account);
  const canDelete = hasPermission(Permissions.Delete_PayOut_Account);

  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [appliedStart, setAppliedStart] = useState(() => todayIST());
  const [appliedEnd, setAppliedEnd] = useState(() => todayIST());
  const [searchName, setSearchName] = useState('');
  const [searchMid, setSearchMid] = useState('');
  const [searchLink, setSearchLink] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updateKind, setUpdateKind] = useState<UpdateKind>('link');
  const [updateText, setUpdateText] = useState('');
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = {};
    if (appliedStart) payload.startDate = appliedStart;
    if (appliedEnd) payload.endDate = appliedEnd;
    return payload;
  }, [appliedStart, appliedEnd]);

  const unpack = useCallback(
    (res: { data?: unknown }) => ({
      rows: asList<WithdrawalRow>(res.data).sort((a, b) => {
        if (a.status === b.status) return 0;
        return a.status ? -1 : 1;
      }),
    }),
    [],
  );

  const { rows, loading, load, setRows } = useReportQuery<WithdrawalRow>({
    action: 'withdrawalProviders.list',
    buildPayload,
    unpack,
    autoDeps: [appliedStart, appliedEnd],
    errorMessage: 'Failed to load withdrawal providers',
  });

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (
          searchName &&
          !String(row.name || '')
            .toLowerCase()
            .includes(searchName.toLowerCase())
        ) {
          return false;
        }
        if (
          searchMid &&
          !String(row.mid || '')
            .toLowerCase()
            .includes(searchMid.toLowerCase())
        ) {
          return false;
        }
        if (
          searchLink &&
          !`${row.link || ''} ${row.redirectionLink || ''}`
            .toLowerCase()
            .includes(searchLink.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [rows, searchName, searchMid, searchLink],
  );

  const openUpdate = (row: WithdrawalRow, kind: UpdateKind, current?: string) => {
    setActiveId(row._id);
    setUpdateKind(kind);
    setUpdateText(current || '');
    setUpdateOpen(true);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !form.name.trim() ||
      !form.link.trim() ||
      !form.mid.trim() ||
      !form.token.trim() ||
      !form.cookies.trim()
    ) {
      toast.error('Please fill all fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('withdrawalProviders.create', {
        name: form.name.trim(),
        link: form.link.trim(),
        status: form.status,
        token: form.token.trim(),
        cookies: form.cookies.trim(),
        mid: form.mid.trim(),
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

  const handleEdit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await secureApi('withdrawalProviders.updateAll', {
        _id: activeId,
        name: form.name.trim(),
        link: form.link.trim(),
        status: form.status,
        token: form.token.trim(),
        cookies: form.cookies.trim(),
        mid: form.mid.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update provider');
        return;
      }
      toast.success('Provider updated');
      setEditOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateField = async () => {
    if (!updateText.trim()) {
      toast.error('Please enter a value');
      return;
    }
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = { _id: activeId };
      if (updateKind === 'mid') data.mid = updateText.trim();
      else if (updateKind === 'displayName') data.displayName = updateText.trim();
      else if (updateKind === 'gatewayImg') data.gatewayImage = updateText.trim();
      else data.link = updateText.trim();

      const res = await secureApi('withdrawalProviders.updateMidNameLink', data);
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

  const handleToggle = async (row: WithdrawalRow, next: boolean) => {
    setTogglingId(row._id);
    try {
      const res = await secureApi('withdrawalProviders.update', {
        _id: row._id,
        status: next,
        name: row.name,
        updatedBy: { userId: user?._id, userName: user?.name },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update status');
        return;
      }
      setRows((prev) =>
        prev.map((item) => {
          if (item._id === row._id) return { ...item, status: next };
          if (next && item.name === row.name && item._id !== row._id) {
            return { ...item, status: false };
          }
          return item;
        }),
      );
      void load();
    } finally {
      setTogglingId('');
    }
  };

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('withdrawalProviders.delete', { _id: activeId });
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

  const columns = useMemo<CommonTableColumn<WithdrawalRow>[]>(() => {
    const cols: CommonTableColumn<WithdrawalRow>[] = [
      {
        id: 'name',
        label: 'Gateway Name',
        filter: (
          <TableSearchBar
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search name"
          />
        ),
        render: (row) => display(row.name),
      },
      {
        id: 'displayName',
        label: 'Display Name',
        filter: <Box />,
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.displayName)}</Typography>
            <IconButton
              size="small"
              onClick={() => openUpdate(row, 'displayName', row.displayName)}
            >
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
    ];

    if (canToggle) {
      cols.push({
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
      });
    }

    cols.push(
      {
        id: 'image',
        label: 'Image',
        filter: <Box />,
        render: (row) => {
          const src = row.gatewayImage || '';
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              {src ? (
                <Box
                  component="img"
                  src={src}
                  alt={row.name || 'gateway'}
                  sx={{
                    width: 48,
                    height: 48,
                    objectFit: 'contain',
                    bgcolor: '#fff',
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Typography variant="body2">—</Typography>
              )}
              <IconButton size="small" onClick={() => openUpdate(row, 'gatewayImg', src)}>
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Stack>
          );
        },
      },
      {
        id: 'mid',
        label: 'Mid',
        filter: (
          <TableSearchBar
            value={searchMid}
            onChange={(e) => setSearchMid(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search mid"
            width={110}
          />
        ),
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography variant="body2">{display(row.mid)}</Typography>
            <IconButton size="small" onClick={() => openUpdate(row, 'mid', row.mid)}>
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'link',
        label: 'Link',
        filter: (
          <TableSearchBar
            value={searchLink}
            onChange={(e) => setSearchLink(e.target.value)}
            onSearch={() => undefined}
            placeholder="Search link"
            width={120}
          />
        ),
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Typography
              variant="body2"
              sx={{
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {display(row.link)}
            </Typography>
            <IconButton size="small" onClick={() => openUpdate(row, 'link', row.link)}>
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'redirectionLink',
        label: 'Redirection Link',
        filter: <Box />,
        render: (row) => display(row.redirectionLink),
      },
      {
        id: 'token',
        label: 'Token',
        filter: <Box />,
        cellSx: { whiteSpace: 'normal', maxWidth: 140 },
        render: (row) => (
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
            {display(row.token)}
          </Typography>
        ),
      },
      {
        id: 'cookies',
        label: 'Cookies',
        filter: <Box />,
        cellSx: { whiteSpace: 'normal', maxWidth: 140 },
        render: (row) => (
          <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
            {display(row.cookies)}
          </Typography>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        filter: <Box />,
        render: (row) => (
          <Stack direction="row" spacing={0.25} justifyContent="center">
            <IconButton
              size="small"
              onClick={() => {
                setActiveId(row._id);
                setForm({
                  name: row.name || '',
                  link: row.link || '',
                  mid: row.mid || '',
                  token: row.token || '',
                  cookies: row.cookies || '',
                  status: Boolean(row.status),
                });
                setEditOpen(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            {canDelete && (
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
            )}
          </Stack>
        ),
      },
    );

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchName, searchMid, searchLink, canToggle, canDelete, togglingId]);

  const formFields = (
    <Stack spacing={1.5}>
      {(
        [
          ['name', 'Parent Company / Name'],
          ['link', 'Link / UPI'],
          ['mid', 'Mid'],
          ['token', 'Token'],
          ['cookies', 'Cookies'],
        ] as const
      ).map(([key, label]) => (
        <TextField
          key={key}
          label={label}
          fullWidth
          multiline={key === 'cookies' || key === 'token'}
          minRows={key === 'cookies' || key === 'token' ? 2 : 1}
          value={form[key]}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        />
      ))}
    </Stack>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Box
        sx={{
          mb: 1.5,
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          flexWrap="nowrap"
          sx={{ overflowX: 'auto', '& > *': { flexShrink: 0 } }}
        >
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={dateFieldSx}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={dateFieldSx}
          />
          <Button
            variant="contained"
            sx={orangeBtnSx}
            onClick={() => {
              setAppliedStart(startDate);
              setAppliedEnd(endDate);
            }}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={loading}
            onClick={() => void load()}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          {canAdd && (
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
          )}
        </Stack>
      </Box>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={filteredRows}
          loading={loading}
          getRowKey={(row) => row._id}
          emptyMessage="No withdrawal providers"
          virtualize={false}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Withdrawal Provider</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleCreate(e)}>
          <DialogContent>{formFields}</DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Withdrawal Provider</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleEdit(e)}>
          <DialogContent>{formFields}</DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Update
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={updateOpen} onClose={() => setUpdateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Update {UPDATE_LABELS[updateKind]}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={UPDATE_LABELS[updateKind]}
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleUpdateField();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={() => void handleUpdateField()}
            sx={orangeBtnSx}
          >
            Update
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
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
