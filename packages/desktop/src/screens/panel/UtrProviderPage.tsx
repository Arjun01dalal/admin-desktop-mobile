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
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { todayIST, formatAmount } from '@/utils/dates';
import { asList, useReportQuery } from '@/screens/panel/shared';

type UtrRow = {
  _id: string;
  BankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  ifsc?: string;
  status?: boolean;
  pendingTotal?: number;
  approvedTotal?: number;
  [key: string]: unknown;
};

const EMPTY_FORM = {
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  ifsc: '',
};

const fieldSx = {
  flex: 1,
  minWidth: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

export function UtrProviderPage() {
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const buildPayload = useCallback(
    () => ({
      startDate: startDate || todayIST(),
      endDate: endDate || todayIST(),
    }),
    [startDate, endDate],
  );
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: asList<UtrRow>(res.data) }),
    [],
  );

  const { rows, loading, load, setRows } = useReportQuery<UtrRow>({
    action: 'ops.utrGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load UTR providers',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openDelete = useCallback((row: UtrRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (
        !form.bankName.trim() ||
        !form.accountNumber.trim() ||
        !form.accountHolderName.trim() ||
        !form.ifsc.trim()
      ) {
        toast.error('Please fill all bank details');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.utrCreate', {
          bankName: form.bankName.trim(),
          accountNumber: form.accountNumber.trim(),
          accountHolderName: form.accountHolderName.trim(),
          ifsc: form.ifsc.trim().toUpperCase(),
          status: false,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add UTR provider');
          return;
        }
        toast.success('UTR provider added');
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
    async (row: UtrRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('ops.utrUpdate', { _id: row._id, status: next });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => {
            if (item._id === row._id) return { ...item, status: next };
            if (next && item.BankName === row.BankName) return { ...item, status: false };
            return item;
          }),
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
      const res = await secureApi('ops.utrDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete UTR provider');
        return;
      }
      toast.success('UTR provider deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<CommonTableColumn<UtrRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'totalAmount',
        label: 'Total Amount',
        render: (row) => (
          <Stack spacing={0.25} alignItems="flex-start">
            <Typography variant="caption">
              Approved - <Box component="b">{formatAmount(row.approvedTotal ?? 0)}</Box>
            </Typography>
            <Typography variant="caption">
              Pending - <Box component="b">{formatAmount(row.pendingTotal ?? 0)}</Box>
            </Typography>
          </Stack>
        ),
      },
      {
        id: 'accountHolder',
        label: 'Account Holder',
        render: (row) => row.accountHolderName || '—',
      },
      {
        id: 'bankName',
        label: 'Bank Name',
        render: (row) => row.BankName || '—',
      },
      {
        id: 'accountNumber',
        label: 'Account Number',
        render: (row) => row.accountNumber || '—',
      },
      {
        id: 'ifsc',
        label: 'IFSC',
        render: (row) => row.ifsc || '—',
      },
      {
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
      },
      {
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
      },
    ],
    [togglingId, handleToggleStatus, openDelete],
  );

  return (
    <Box>
      <CollapsibleFilterPanel
        title="UTR Providers"
        summary={`${startDate} → ${endDate}`}
      >
        <Stack direction="row" spacing={1} alignItems="center" mb={2}>
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
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={fieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={fieldSx}
          />
          <Button
            variant="contained"
            onClick={() => void load()}
            disabled={loading}
            sx={{ ...orangeBtnSx, flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Apply
          </Button>
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row._id}
          loading={loading}
          emptyMessage="No UTR providers found"
          stickyHeader
          dense
          minWidth={1000}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} fullWidth maxWidth="xs">
        <form onSubmit={handleCreate}>
          <DialogTitle>Add UTR Provider</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                label="Bank Name"
                size="small"
                fullWidth
                value={form.bankName}
                onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
                autoFocus
              />
              <TextField
                label="Bank Account Number"
                size="small"
                fullWidth
                value={form.accountNumber}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                }
              />
              <TextField
                label="Account Holder Name"
                size="small"
                fullWidth
                value={form.accountHolderName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, accountHolderName: e.target.value }))
                }
              />
              <TextField
                label="IFSC"
                size="small"
                fullWidth
                value={form.ifsc}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))
                }
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
            This UTR provider will be permanently removed.
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
