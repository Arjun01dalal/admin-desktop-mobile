import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secureApi } from '@/api/secureClient';
import { todayIST, formatAmount } from '@/utils/dates';
import { cn } from '@/lib/utils';
import {
  ReportPage,
  DataTable,
  ReportDialog,
  DateField,
  ApplyButton,
  useReportQuery,
  asList,
  type DataColumn,
} from '@/screens/panel/shared';

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

function StatusSwitch({
  checked,
  disabled,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-1',
        )}
      />
    </button>
  );
}

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

  const columns = useMemo<DataColumn<UtrRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        className: 'w-12',
        render: (_row, index) => index + 1,
      },
      {
        id: 'totalAmount',
        label: 'Total Amount',
        render: (row) => (
          <div className="text-xs">
            Approved - <b>{formatAmount(row.approvedTotal ?? 0)}</b>
            <br />
            Pending - <b>{formatAmount(row.pendingTotal ?? 0)}</b>
          </div>
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
        render: (row) => (
          <StatusSwitch
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onToggle={(next) => void handleToggleStatus(row, next)}
          />
        ),
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            className="text-destructive hover:text-destructive"
            onClick={() => openDelete(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [togglingId, handleToggleStatus, openDelete],
  );

  return (
    <ReportPage
      title="UTR Providers"
      loading={loading}
      onRefresh={() => void load()}
      actions={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      }
      toolbar={
        <>
          <DateField label="From Date" value={startDate} onChange={setStartDate} />
          <DateField label="To Date" value={endDate} onChange={setEndDate} />
          <ApplyButton onClick={() => void load()} loading={loading} />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No UTR providers found"
        minWidth={1000}
      />

      <ReportDialog
        open={addOpen}
        title="Add UTR Provider"
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        loading={submitting}
      >
        <Input
          placeholder="Bank Name"
          value={form.bankName}
          onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
          autoFocus
        />
        <Input
          placeholder="Bank Account Number"
          value={form.accountNumber}
          onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
        />
        <Input
          placeholder="Account Holder Name"
          value={form.accountHolderName}
          onChange={(e) => setForm((prev) => ({ ...prev, accountHolderName: e.target.value }))}
        />
        <Input
          placeholder="IFSC"
          value={form.ifsc}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, ifsc: e.target.value.toUpperCase() }))
          }
        />
      </ReportDialog>

      <ReportDialog
        open={deleteOpen}
        title="Are you sure?"
        onClose={() => setDeleteOpen(false)}
        footer={
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          This UTR provider will be permanently removed.
        </p>
      </ReportDialog>
    </ReportPage>
  );
}
