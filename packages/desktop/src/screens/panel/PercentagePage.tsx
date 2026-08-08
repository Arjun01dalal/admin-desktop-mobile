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
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount } from '@/utils/dates';
import { asList, useReportQuery } from '@/screens/panel/shared';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type PercentageRow = {
  _id: string;
  type?: string;
  percent?: number;
  startAmount?: number;
  endAmount?: number;
  bonus?: number;
  status?: boolean;
  [key: string]: unknown;
};

type PercentForm = {
  type: string;
  percent: string;
  startAmount: string;
  endAmount: string;
  bonus: string;
};

const EMPTY_FORM: PercentForm = {
  type: '',
  percent: '',
  startAmount: '',
  endAmount: '',
  bonus: '',
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function PercentagePage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<PercentForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingType, setTogglingType] = useState('');

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: asList<PercentageRow>(res.data) }),
    [],
  );

  const { rows, loading, load, setRows } = useReportQuery<PercentageRow>({
    action: 'ops.percentageGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load percentage list',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((row: PercentageRow) => {
    setForm({
      type: row.type || '',
      percent: row.percent !== undefined ? String(row.percent) : '',
      startAmount: row.startAmount !== undefined ? String(row.startAmount) : '',
      endAmount: row.endAmount !== undefined ? String(row.endAmount) : '',
      bonus: row.bonus !== undefined ? String(row.bonus) : '',
    });
    setEditOpen(true);
  }, []);

  const setField = useCallback((key: keyof PercentForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const submitForm = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const percent = Number(form.percent);
      const startAmount = Number(form.startAmount);
      const endAmount = Number(form.endAmount);
      const bonus = Number(form.bonus);

      if (!form.type.trim()) {
        toast.error('Enter type name');
        return;
      }
      if (!form.percent || Number.isNaN(percent)) {
        toast.error('Enter percentage');
        return;
      }
      if (!form.startAmount || Number.isNaN(startAmount)) {
        toast.error('Enter start amount');
        return;
      }
      if (!form.endAmount || Number.isNaN(endAmount) || endAmount <= startAmount) {
        toast.error('Enter end amount greater than start amount');
        return;
      }
      if (!form.bonus || Number.isNaN(bonus)) {
        toast.error('Enter bonus');
        return;
      }

      setSubmitting(true);
      try {
        const res = await secureApi('ops.percentageSave', {
          type: form.type.trim(),
          percent,
          startAmount,
          endAmount,
          bonus,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to save percentage');
          return;
        }
        toast.success('Percentage saved');
        setAddOpen(false);
        setEditOpen(false);
        setForm(EMPTY_FORM);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [form, load],
  );

  const handleToggleStatus = useCallback(
    async (row: PercentageRow, next: boolean) => {
      if (!row.type) return;
      setTogglingType(row.type);
      try {
        const res = await secureApi('ops.percentageChangeStatus', {
          type: row.type,
          status: next,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => (item._id === row._id ? { ...item, status: next } : item)),
        );
      } finally {
        setTogglingType('');
      }
    },
    [setRows],
  );

  const columns = useMemo<CommonTableColumn<PercentageRow>[]>(
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
        render: (row) => row.type || '—',
      },
      {
        id: 'percent',
        label: 'Percentage',
        render: (row) => (row.percent !== undefined ? row.percent : '—'),
      },
      {
        id: 'startAmount',
        label: 'Start Amount',
        render: (row) => formatAmount(row.startAmount ?? 0),
      },
      {
        id: 'endAmount',
        label: 'End Amount',
        render: (row) => formatAmount(row.endAmount ?? 0),
      },
      {
        id: 'bonus',
        label: 'Bonus',
        render: (row) => (row.bonus !== undefined ? row.bonus : '—'),
      },
      {
        id: 'action',
        label: 'Action',
        width: 160,
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
            <Switch
              size="small"
              checked={Boolean(row.status)}
              disabled={togglingType === row.type}
              onChange={(_e, checked) => void handleToggleStatus(row, checked)}
              color="warning"
            />
          </Stack>
        ),
      },
    ],
    [openEdit, togglingType, handleToggleStatus],
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
          Percentage
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
        getRowKey={(row, index) => row._id || row.type || index}
        loading={loading}
        emptyMessage="No percentage records found"
        stickyHeader
        dense
        minWidth={900}
        maxHeight="calc(100vh - 220px)"
      />

      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={submitForm}>
          <DialogTitle>Add Percentage</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Type"
                size="small"
                fullWidth
                value={form.type}
                onChange={(e) => setField('type', e.target.value)}
                autoFocus
              />
              <TextField
                label="Percent"
                type="number"
                size="small"
                fullWidth
                value={form.percent}
                onChange={(e) => setField('percent', e.target.value)}
              />
              <TextField
                label="Start Amount"
                type="number"
                size="small"
                fullWidth
                value={form.startAmount}
                onChange={(e) => setField('startAmount', e.target.value)}
              />
              <TextField
                label="End Amount"
                type="number"
                size="small"
                fullWidth
                value={form.endAmount}
                onChange={(e) => setField('endAmount', e.target.value)}
              />
              <TextField
                label={toDisplayText('Bonus')}
                type="number"
                size="small"
                fullWidth
                value={form.bonus}
                onChange={(e) => setField('bonus', e.target.value)}
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
        <form onSubmit={submitForm}>
          <DialogTitle>Edit Percentage</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField label="Type" size="small" fullWidth value={form.type} disabled />
              <TextField
                label="Percent"
                type="number"
                size="small"
                fullWidth
                value={form.percent}
                onChange={(e) => setField('percent', e.target.value)}
                autoFocus
              />
              <TextField
                label="Start Amount"
                type="number"
                size="small"
                fullWidth
                value={form.startAmount}
                onChange={(e) => setField('startAmount', e.target.value)}
              />
              <TextField
                label="End Amount"
                type="number"
                size="small"
                fullWidth
                value={form.endAmount}
                onChange={(e) => setField('endAmount', e.target.value)}
              />
              <TextField
                label={toDisplayText('Bonus')}
                type="number"
                size="small"
                fullWidth
                value={form.bonus}
                onChange={(e) => setField('bonus', e.target.value)}
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
    </Box>
  );
}
