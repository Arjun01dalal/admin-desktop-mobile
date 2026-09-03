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
import { asList, display, useReportQuery } from '@/screens/panel/shared';
import { useRevealCodes } from '@/context/useRevealCodes';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type CasinoSwitchRow = {
  _id: string;
  casinoActiveProvider?: string;
  startAmount?: number;
  endAmount?: number;
  percent?: number;
  status?: boolean;
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

function normalizeCasinoList(data: unknown): CasinoSwitchRow[] {
  const list = asList<CasinoSwitchRow>(data);
  if (list.length) return list;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const payload = (obj.payload ?? obj) as Record<string, unknown>;
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload._id) {
      return [payload as CasinoSwitchRow];
    }
  }
  return [];
}

export function CasinoSwitchPage() {
  useRevealCodes();
  const canUse = hasPermission(Permissions.casino_switch);
  const canDelete = hasPermission(Permissions.casino_delete_button);

  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: normalizeCasinoList(res.data) }),
    [],
  );

  const { rows, loading, load, setRows } = useReportQuery<CasinoSwitchRow>({
    action: 'casinoSwitch.list',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load casino switch list',
  });

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!providerName.trim()) {
      toast.error('Please enter casino provider name');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('casinoSwitch.create', {
        casinoActiveProvider: providerName.trim(),
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add casino provider');
        return;
      }
      toast.success('Casino provider added successfully');
      setAddOpen(false);
      setProviderName('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = useCallback(
    async (row: CasinoSwitchRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('casinoSwitch.changeStatus', {
          _id: row._id,
          status: next,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => (item._id === row._id ? { ...item, status: next } : item)),
        );
        toast.success('Status updated successfully');
      } finally {
        setTogglingId('');
      }
    },
    [setRows],
  );

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await secureApi('casinoSwitch.delete', { _id: deleteId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete casino provider');
        return;
      }
      toast.success('Casino provider deleted successfully');
      setDeleteOpen(false);
      setDeleteId('');
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<CommonTableColumn<CasinoSwitchRow>[]>(() => {
    const cols: CommonTableColumn<CasinoSwitchRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 64,
        render: (_row, index) => index + 1,
      },
      {
        id: 'provider',
        label: 'Casino Provider',
        render: (row) => display(row.casinoActiveProvider),
      },
      {
        id: 'startAmount',
        label: 'Start Amount',
        render: (row) => (row.startAmount !== undefined ? row.startAmount : '—'),
      },
      {
        id: 'endAmount',
        label: 'End Amount',
        render: (row) => (row.endAmount !== undefined ? row.endAmount : '—'),
      },
      {
        id: 'percent',
        label: 'Percent',
        render: (row) => (row.percent !== undefined ? row.percent : '—'),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => (
          <Switch
            size="small"
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onChange={(_e, checked) => void handleToggleStatus(row, checked)}
            color="warning"
          />
        ),
      },
    ];
    if (canDelete) {
      cols.push({
        id: 'action',
        label: 'Action',
        width: 80,
        render: (row) => (
          <IconButton
            size="small"
            aria-label="Delete"
            onClick={() => {
              setDeleteId(row._id);
              setDeleteOpen(true);
            }}
            sx={{ color: '#ef5350' }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      });
    }
    return cols;
  }, [canDelete, togglingId, handleToggleStatus]);

  if (!canUse) {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography color="text.secondary">
          You do not have permission to view this page.
        </Typography>
      </Box>
    );
  }

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
          {toDisplayText('Casino Switch')}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setProviderName('');
              setAddOpen(true);
            }}
            sx={orangeBtnSx}
          >
            Add
          </Button>
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
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
          getRowKey={(row, index) => row._id || index}
          loading={loading}
          emptyMessage="No casino providers found"
          stickyHeader
          dense
          minWidth={900}
          maxHeight="100%"
          virtualize={false}
        />
      </TablePanel>

      <Dialog
        open={addOpen}
        onClose={() => !submitting && setAddOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={(e) => void handleCreate(e)}>
          <DialogTitle>{toDisplayText('Add Casino Provider')}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label={toDisplayText('Casino Active Provider')}
                size="small"
                fullWidth
                placeholder="e.g. QTECH"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                autoFocus
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
        </Box>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => !submitting && setDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Are You Sure?</DialogTitle>
        <DialogContent>
          Do you want to delete this {toDisplayText('casino')} provider?
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
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
