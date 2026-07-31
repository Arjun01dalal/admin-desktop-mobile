import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { secureApi } from '@/api/secureClient';
import { getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import {
  ReportPage,
  DataTable,
  ReportDialog,
  DateField,
  PageSizeField,
  ApplyButton,
  ReportPager,
  useReportQuery,
  asPaged,
  display,
  type DataColumn,
} from '@/screens/panel/shared';

type FeedbackRow = {
  _id: string;
  name?: string;
  mobile?: string;
  message?: string;
  feedbackResponse?: string;
  createdOn?: string;
  [key: string]: unknown;
};

function maskFeedbackMobile(mobile?: string): string {
  if (!mobile) return '—';
  const last4 = mobile.slice(-4);
  return `****** ${last4}`;
}

export function FeedbackPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [replyOpen, setReplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = hasPermission(Permissions.Edit_Feedback);

  const buildPayload = useCallback(() => {
    const payload: Record<string, unknown> = {
      pageNo: page,
      itemsPerPage,
      filter: { feedBackStatus: 'Pending' },
    };
    if (startDate && endDate) {
      payload.startDate = startDate;
      payload.endDate = endDate;
    }
    return payload;
  }, [page, itemsPerPage, startDate, endDate]);

  const unpack = useCallback(
    (res: { data?: unknown }) => asPaged<FeedbackRow>(res.data),
    [],
  );

  const { rows, total, totalPages, loading, load } = useReportQuery<FeedbackRow>({
    action: 'ops.feedbackGetAll',
    buildPayload,
    unpack,
    autoDeps: [page, itemsPerPage],
    errorMessage: 'Failed to load feedback list',
  });

  const applyFilters = useCallback(() => {
    setPage(1);
    void load();
  }, [load]);

  const openReply = useCallback((row: FeedbackRow) => {
    setActiveId(row._id);
    setReplyText(row.feedbackResponse || '');
    setReplyOpen(true);
  }, []);

  const openDelete = useCallback((row: FeedbackRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleReply = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!replyText.trim()) {
        toast.error('Enter a reply message');
        return;
      }
      const user = getSessionUser();
      setSubmitting(true);
      try {
        const res = await secureApi('ops.feedbackUpdate', {
          _id: activeId,
          feedbackResponse: replyText.trim(),
          updatedBy: { name: user?.name, _id: user?._id },
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to send reply');
          return;
        }
        toast.success('Reply sent');
        setReplyOpen(false);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [activeId, replyText, load],
  );

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.feedbackDelete', { id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete feedback');
        return;
      }
      toast.success('Feedback deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<DataColumn<FeedbackRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        className: 'w-12',
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      { id: 'id', label: 'ID', render: (row) => row._id },
      { id: 'name', label: 'Name', render: (row) => display(row.name) },
      { id: 'mobile', label: 'Mobile', render: (row) => maskFeedbackMobile(row.mobile) },
      {
        id: 'message',
        label: 'Message',
        className: 'max-w-[220px] whitespace-normal',
        render: (row) => row.message || '—',
      },
      { id: 'reply', label: 'Reply', render: (row) => row.feedbackResponse || '—' },
      {
        id: 'date',
        label: 'Date',
        render: (row) =>
          row.createdOn
            ? `${formatDisplayDate(row.createdOn)} ${formatDisplayTime(row.createdOn)}`
            : '—',
      },
      {
        id: 'action',
        label: 'Action',
        render: (row) => (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => openReply(row)}>
                <MessageSquare className="h-4 w-4" />
                Respond
              </Button>
            )}
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
    [page, itemsPerPage, canEdit, openReply, openDelete],
  );

  return (
    <ReportPage
      title="Pending Feedback"
      loading={loading}
      onRefresh={() => void load()}
      toolbar={
        <>
          <DateField label="From Date" value={startDate} onChange={setStartDate} />
          <DateField label="To Date" value={endDate} onChange={setEndDate} />
          <PageSizeField
            value={itemsPerPage}
            onChange={(value) => {
              setItemsPerPage(value);
              setPage(1);
            }}
          />
          <ApplyButton onClick={applyFilters} loading={loading} />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No pending feedback found"
        minWidth={1100}
      />

      <ReportPager page={page} totalPages={totalPages} total={total} onChange={setPage} disabled={loading} />

      <ReportDialog
        open={replyOpen}
        title="Reply to Feedback"
        onClose={() => setReplyOpen(false)}
        onSubmit={handleReply}
        submitLabel="Update"
        loading={submitting}
      >
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Feedback reply"
          rows={4}
          autoFocus
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </ReportDialog>

      <ReportDialog
        open={deleteOpen}
        title="Do you want to delete?"
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
        <p className="text-sm text-muted-foreground">This feedback will be permanently removed.</p>
      </ReportDialog>
    </ReportPage>
  );
}
