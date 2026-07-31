import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { cn } from '@/lib/utils';
import {
  ReportPage,
  DataTable,
  ReportDialog,
  useReportQuery,
  asList,
  type DataColumn,
} from '@/screens/panel/shared';

type UpiRow = {
  _id: string;
  name?: string;
  upiId?: string;
  status?: boolean;
  [key: string]: unknown;
};

const EMPTY_FORM = { name: '', upiId: '', status: false };

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

  const columns = useMemo<DataColumn<UpiRow>[]>(() => {
    const cols: DataColumn<UpiRow>[] = [
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
        render: (row) => (
          <StatusSwitch
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onToggle={(next) => void handleToggleStatus(row, next)}
          />
        ),
      });
    }

    cols.push({
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
    });

    return cols;
  }, [canToggle, togglingId, handleToggleStatus, openDelete]);

  return (
    <ReportPage
      title="AB UPIs"
      loading={loading}
      onRefresh={() => void load()}
      actions={
        canAdd ? (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        ) : undefined
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row._id}
        loading={loading}
        emptyMessage="No UPI records found"
        minWidth={600}
      />

      <ReportDialog
        open={addOpen}
        title="Add UPI"
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        loading={submitting}
      >
        <Input
          placeholder="PN"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          autoFocus
        />
        <Input
          placeholder="UPI Id"
          value={form.upiId}
          onChange={(e) => setForm((prev) => ({ ...prev, upiId: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.checked }))}
            className="h-4 w-4 rounded border-input"
          />
          {form.status ? 'Active' : 'Inactive'}
        </label>
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
        <p className="text-sm text-muted-foreground">This UPI entry will be permanently removed.</p>
      </ReportDialog>
    </ReportPage>
  );
}
