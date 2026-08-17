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
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { asList, display, useReportQuery } from '@/screens/panel/shared';
import { appCodeForName } from '@/constants/clientNames';

type DepositConfigRow = {
  _id: string;
  clientName?: string;
  minDeposit?: number | string;
  maxDeposit?: number | string;
  allowedAmounts?: number[];
};

type FormState = {
  clientName: string;
  minDeposit: string;
  maxDeposit: string;
  allowedAmounts: string;
};

const EMPTY_FORM: FormState = {
  clientName: '',
  minDeposit: '',
  maxDeposit: '',
  allowedAmounts: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

function parseAllowedAmounts(raw: string): number[] {
  return raw
    .replace(/[^0-9,]/g, '')
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

export function DepositConfigPage() {
  const canEdit = hasPermission(Permissions.Deposit_Config);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: asList<DepositConfigRow>(res.data) }),
    [],
  );

  const { rows, loading, load } = useReportQuery<DepositConfigRow>({
    action: 'depositConfig.getAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load deposit config',
  });

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  };

  const openEdit = (row: DepositConfigRow) => {
    setForm({
      clientName: String(row.clientName || ''),
      minDeposit: String(row.minDeposit ?? ''),
      maxDeposit: String(row.maxDeposit ?? ''),
      allowedAmounts: Array.isArray(row.allowedAmounts)
        ? row.allowedAmounts.join(', ')
        : '',
    });
    setEditOpen(true);
  };

  const handleSave = async (event: FormEvent, mode: 'add' | 'edit') => {
    event.preventDefault();
    if (
      !form.clientName.trim() ||
      !form.minDeposit.trim() ||
      !form.maxDeposit.trim() ||
      !form.allowedAmounts.trim()
    ) {
      toast.error('Please fill all fields');
      return;
    }
    const allowedAmounts = parseAllowedAmounts(form.allowedAmounts);
    if (!allowedAmounts.length) {
      toast.error('Enter valid allowed amounts');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        clientName: form.clientName.trim(),
        minDeposit: form.minDeposit.trim(),
        maxDeposit: form.maxDeposit.trim(),
        allowedAmounts,
      };
      const res = await secureApi(
        mode === 'add' ? 'depositConfig.add' : 'depositConfig.update',
        payload,
      );
      if (!res.ok) {
        toast.error(res.message || `Failed to ${mode} deposit config`);
        return;
      }
      toast.success(mode === 'add' ? 'Config added' : 'Config updated');
      setAddOpen(false);
      setEditOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<CommonTableColumn<DepositConfigRow>[]>(
    () => [
      {
        id: 'clientName',
        label: 'App Name',
        render: (row) => appCodeForName(row.clientName),
      },
      {
        id: 'minDeposit',
        label: 'Min Deposit',
        render: (row) => display(row.minDeposit),
      },
      {
        id: 'maxDeposit',
        label: 'Max Deposit',
        render: (row) => display(row.maxDeposit),
      },
      {
        id: 'allowedAmounts',
        label: 'Allowed Amount',
        render: (row) =>
          Array.isArray(row.allowedAmounts) ? row.allowedAmounts.join(', ') : '—',
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) =>
          canEdit ? (
            <IconButton size="small" onClick={() => openEdit(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          ) : (
            '—'
          ),
      },
    ],
    [canEdit],
  );

  const formFields = (
    <Stack spacing={1.5}>
      <TextField
        label="Client Name"
        fullWidth
        disabled={editOpen}
        value={form.clientName}
        onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
      />
      <TextField
        label="Min Deposit"
        type="number"
        fullWidth
        value={form.minDeposit}
        onChange={(e) => setForm((p) => ({ ...p, minDeposit: e.target.value }))}
      />
      <TextField
        label="Max Deposit"
        type="number"
        fullWidth
        value={form.maxDeposit}
        onChange={(e) => setForm((p) => ({ ...p, maxDeposit: e.target.value }))}
      />
      <TextField
        label="Allowed Amounts (comma separated)"
        fullWidth
        value={form.allowedAmounts}
        onChange={(e) =>
          setForm((p) => ({
            ...p,
            allowedAmounts: e.target.value.replace(/[^0-9,]/g, ''),
          }))
        }
      />
    </Stack>
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
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={orangeBtnSx}>
            Add
          </Button>
        )}
      </Stack>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          getRowKey={(row) => row._id}
          emptyMessage="No deposit config"
          stickyHeader
          dense
          virtualize
          maxHeight="100%"
          minWidth={900}
        />
      </TablePanel>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add Deposit Config</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleSave(e, 'add')}>
          <DialogContent>{formFields}</DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Submit
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Edit Deposit Config</DialogTitle>
        <Box component="form" onSubmit={(e) => void handleSave(e, 'edit')}>
          <DialogContent>{formFields}</DialogContent>
          <DialogActions>
            <Button onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              Update
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
