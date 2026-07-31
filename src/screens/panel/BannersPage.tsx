import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
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

type BannerRow = {
  _id: string;
  imagePath?: string;
  gameName?: string;
  type?: string;
  status?: boolean;
  position?: number;
  [key: string]: unknown;
};

const EMPTY_FORM = { url: '', gameName: '', type: '' };

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

export function BannersPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [positionDrafts, setPositionDrafts] = useState<Record<string, string>>({});
  const [savingPositionId, setSavingPositionId] = useState('');

  const canAdd = hasPermission(Permissions.Add_Banner);
  const canToggle = hasPermission(Permissions.Toggle_Banner);
  const canDelete = hasPermission(Permissions.Delete_Banner);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback((res: { data?: unknown }) => {
    const list = asList<BannerRow>(res.data);
    const sorted = [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return { rows: sorted };
  }, []);

  const { rows, loading, load, setRows } = useReportQuery<BannerRow>({
    action: 'ops.bannersGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load banners',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openDelete = useCallback((row: BannerRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.url.trim() || !form.gameName.trim() || !form.type.trim()) {
        toast.error('Please fill image URL, game name and type');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.bannersCreate', {
          imagePath: form.url.trim(),
          gameName: form.gameName.trim(),
          type: form.type.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add banner');
          return;
        }
        toast.success('Banner added');
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
    async (row: BannerRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('ops.bannersUpdate', { _id: row._id, status: next });
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

  const handleUpdatePosition = useCallback(
    async (row: BannerRow) => {
      const raw = positionDrafts[row._id] ?? String(row.position ?? '');
      const position = Number(raw);
      if (!position || position < 1) {
        toast.error('Please enter a valid position');
        return;
      }
      setSavingPositionId(row._id);
      try {
        const res = await secureApi('ops.bannersUpdatePosition', { _id: row._id, position });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update position');
          return;
        }
        toast.success('Position updated');
        void load();
      } finally {
        setSavingPositionId('');
      }
    },
    [positionDrafts, load],
  );

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.bannersDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete banner');
        return;
      }
      toast.success('Banner deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<DataColumn<BannerRow>[]>(() => {
    const cols: DataColumn<BannerRow>[] = [
      {
        id: 'index',
        label: '#',
        className: 'w-12',
        render: (_row, index) => index + 1,
      },
      {
        id: 'image',
        label: 'Image',
        render: (row) =>
          row.imagePath ? (
            <img
              src={row.imagePath}
              alt={row.gameName || 'Banner'}
              className="h-14 w-24 rounded object-cover"
            />
          ) : (
            '—'
          ),
      },
      { id: 'gameName', label: 'Game Name', render: (row) => row.gameName || '—' },
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

    cols.push({ id: 'type', label: 'Type', render: (row) => row.type || '—' });

    cols.push({
      id: 'position',
      label: 'Position',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={1}
            value={positionDrafts[row._id] ?? String(row.position ?? '')}
            onChange={(e) =>
              setPositionDrafts((prev) => ({ ...prev, [row._id]: e.target.value }))
            }
            className="h-8 w-16"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Save position"
            disabled={savingPositionId === row._id}
            onClick={() => void handleUpdatePosition(row)}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
      ),
    });

    if (canDelete) {
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
    }

    return cols;
  }, [
    canToggle,
    canDelete,
    togglingId,
    handleToggleStatus,
    positionDrafts,
    savingPositionId,
    handleUpdatePosition,
    openDelete,
  ]);

  return (
    <ReportPage
      title="Banners List"
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
        emptyMessage="No banners found"
        minWidth={1000}
      />

      <ReportDialog
        open={addOpen}
        title="Add Banner"
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        loading={submitting}
      >
        <Input
          placeholder="Image URL"
          value={form.url}
          onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
          autoFocus
        />
        <Input
          placeholder="Game Name"
          value={form.gameName}
          onChange={(e) => setForm((prev) => ({ ...prev, gameName: e.target.value }))}
        />
        <Input
          placeholder="Type"
          value={form.type}
          onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
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
        <p className="text-sm text-muted-foreground">This banner will be permanently removed.</p>
      </ReportDialog>
    </ReportPage>
  );
}
