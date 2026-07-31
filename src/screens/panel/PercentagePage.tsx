import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secureApi } from '@/api/secureClient';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/utils/dates';
import {
  ReportPage,
  DataTable,
  ReportDialog,
  useReportQuery,
  asList,
  type DataColumn,
} from '@/screens/panel/shared';

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

  const columns = useMemo<DataColumn<PercentageRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        className: 'w-12',
        render: (_row, index) => index + 1,
      },
      { id: 'name', label: 'Name', render: (row) => row.type || '—' },
      { id: 'percent', label: 'Percentage', render: (row) => row.percent ?? '—' },
      { id: 'startAmount', label: 'Start Amount', render: (row) => formatAmount(row.startAmount ?? 0) },
      { id: 'endAmount', label: 'End Amount', render: (row) => formatAmount(row.endAmount ?? 0) },
      { id: 'bonus', label: 'Bonus', render: (row) => row.bonus ?? '—' },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(row)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <StatusSwitch
              checked={Boolean(row.status)}
              disabled={togglingType === row.type}
              onToggle={(next) => void handleToggleStatus(row, next)}
            />
          </div>
        ),
      },
    ],
    [openEdit, togglingType, handleToggleStatus],
  );

  return (
    <ReportPage
      title="Percentage"
      loading={loading}
      onRefresh={() => void load()}
      actions={
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No percentage records found"
        minWidth={800}
      />

      <ReportDialog
        open={addOpen}
        title="Add Percentage"
        onClose={() => setAddOpen(false)}
        onSubmit={submitForm}
        loading={submitting}
      >
        <Input
          placeholder="Type"
          value={form.type}
          onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
          autoFocus
        />
        <Input
          type="number"
          placeholder="Percent"
          value={form.percent}
          onChange={(e) => setForm((prev) => ({ ...prev, percent: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Start Amount"
          value={form.startAmount}
          onChange={(e) => setForm((prev) => ({ ...prev, startAmount: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="End Amount"
          value={form.endAmount}
          onChange={(e) => setForm((prev) => ({ ...prev, endAmount: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Bonus"
          value={form.bonus}
          onChange={(e) => setForm((prev) => ({ ...prev, bonus: e.target.value }))}
        />
      </ReportDialog>

      <ReportDialog
        open={editOpen}
        title="Edit Percentage"
        onClose={() => setEditOpen(false)}
        onSubmit={submitForm}
        loading={submitting}
      >
        <Input value={form.type} disabled placeholder="Type" />
        <Input
          type="number"
          placeholder="Percent"
          value={form.percent}
          onChange={(e) => setForm((prev) => ({ ...prev, percent: e.target.value }))}
          autoFocus
        />
        <Input
          type="number"
          placeholder="Start Amount"
          value={form.startAmount}
          onChange={(e) => setForm((prev) => ({ ...prev, startAmount: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="End Amount"
          value={form.endAmount}
          onChange={(e) => setForm((prev) => ({ ...prev, endAmount: e.target.value }))}
        />
        <Input
          type="number"
          placeholder="Bonus"
          value={form.bonus}
          onChange={(e) => setForm((prev) => ({ ...prev, bonus: e.target.value }))}
        />
      </ReportDialog>
    </ReportPage>
  );
}
