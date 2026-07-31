import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { secureApi } from '@/api/secureClient';
import {
  ReportPage,
  DataTable,
  ReportDialog,
  useReportQuery,
  asList,
  type DataColumn,
} from '@/screens/panel/shared';

type SocialMediaRow = {
  _id: string;
  name?: string;
  link?: string;
  [key: string]: unknown;
};

const EMPTY_FORM = { name: '', link: '' };

export function SocialMediaPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback(
    (res: { data?: unknown }) => ({ rows: asList<SocialMediaRow>(res.data) }),
    [],
  );

  const { rows, loading, load } = useReportQuery<SocialMediaRow>({
    action: 'ops.socialMediaGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load social media links',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }, []);

  const openEdit = useCallback((row: SocialMediaRow) => {
    setActiveId(row._id);
    setForm({ name: row.name || '', link: row.link || '' });
    setEditOpen(true);
  }, []);

  const openDelete = useCallback((row: SocialMediaRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.name.trim() || !form.link.trim()) {
        toast.error('Enter Name and Link');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.socialMediaCreate', {
          name: form.name.trim(),
          link: form.link.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add social media link');
          return;
        }
        toast.success('Social media link added');
        setAddOpen(false);
        setForm(EMPTY_FORM);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [form, load],
  );

  const handleUpdate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.name.trim() || !form.link.trim()) {
        toast.error('Enter Name and Link');
        return;
      }
      setSubmitting(true);
      try {
        const res = await secureApi('ops.socialMediaUpdate', {
          _id: activeId,
          name: form.name.trim(),
          link: form.link.trim(),
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update social media link');
          return;
        }
        toast.success('Social media link updated');
        setEditOpen(false);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [activeId, form, load],
  );

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.socialMediaDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete social media link');
        return;
      }
      toast.success('Social media link deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<DataColumn<SocialMediaRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        className: 'w-12',
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => row.name || '—',
      },
      {
        id: 'link',
        label: 'Link',
        render: (row) => (
          <a
            href={row.link}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {row.link || '—'}
          </a>
        ),
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => openEdit(row)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              className="text-destructive hover:text-destructive"
              onClick={() => openDelete(row)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [openEdit, openDelete],
  );

  return (
    <ReportPage
      title="Social Media"
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
        emptyMessage="No social media links found"
        minWidth={600}
      />

      <ReportDialog
        open={addOpen}
        title="Add Social Media"
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        loading={submitting}
      >
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          autoFocus
        />
        <Input
          placeholder="Link"
          value={form.link}
          onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
        />
      </ReportDialog>

      <ReportDialog
        open={editOpen}
        title="Edit Social Media"
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdate}
        loading={submitting}
      >
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          autoFocus
        />
        <Input
          placeholder="Link"
          value={form.link}
          onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
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
          This social media link will be permanently removed.
        </p>
      </ReportDialog>
    </ReportPage>
  );
}
