import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplyIcon from '@mui/icons-material/Reply';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, CopyText, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { copyToClipboard } from '@/utils/clipboard';
import { asPaged, display, maskMobile, useReportQuery } from '@/screens/panel/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';

type FeedbackRow = {
  _id: string;
  name?: string;
  mobile?: string;
  message?: string;
  feedbackResponse?: string;
  createdOn?: string;
  [key: string]: unknown;
};

const headerFieldSx = {
  width: 180,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218' },
  '& .MuiInputLabel-root': { color: '#9aa3b5' },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.4,
  '&:hover': { bgcolor: '#e08c00' },
};

export function FeedbackPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [replyOpen, setReplyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canEdit = hasPermission(Permissions.Edit_Feedback);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);

  const { rows, total, totalPages, loading, error, load } = useReportQuery<FeedbackRow>({
    action: 'ops.feedbackGetAll',
    buildPayload: () => {
      const payload: Record<string, unknown> = {
        pageNo: page,
        itemsPerPage: pageSize,
        filter: { feedBackStatus: 'Pending' },
      };
      if (appliedStart && appliedEnd) {
        payload.startDate = appliedStart;
        payload.endDate = appliedEnd;
      }
      return payload;
    },
    unpack: (res) => asPaged<FeedbackRow>(res.data),
    autoDeps: [page, pageSize, appliedStart, appliedEnd],
    errorMessage: 'Failed to load feedback list',
  });

  const applyFilters = useCallback(() => {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPage(1);
  }, [startDate, endDate]);

  const clearDates = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setAppliedStart('');
    setAppliedEnd('');
    setPage(1);
  }, []);

  const openReply = useCallback((row: FeedbackRow) => {
    setActiveId(row._id);
    setReplyText(row.feedbackResponse || '');
    setReplyOpen(true);
  }, []);

  const openDelete = useCallback((row: FeedbackRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const copyMobile = useCallback(async (mobile?: string) => {
    if (!mobile) return;
    const ok = await copyToClipboard(mobile);
    if (ok) toast.success('Mobile copied');
    else toast.error('Failed to copy');
  }, []);

  const handleReply = useCallback(async () => {
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
  }, [activeId, replyText, load]);

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

  const columns = useMemo<CommonTableColumn<FeedbackRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'id',
        label: 'ID',
        render: (row) => <CopyText value={row._id} breakAll />,
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => {
          const name = display(row.name);
          return name === '—' ? name : name.slice(0, 15);
        },
      },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (row) => {
          if (!canShowMobile) {
            return (
              <Typography variant="body2">
                {maskMobile(row.mobile, false)}
              </Typography>
            );
          }
          const mobile = String(row.mobile || '');
          return (
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5}>
              <Typography variant="body2">{mobile || '—'}</Typography>
              {mobile ? (
                <IconButton
                  size="small"
                  aria-label="Copy mobile"
                  onClick={() => void copyMobile(row.mobile)}
                  sx={{ color: '#ff9f0a', p: 0.25 }}
                >
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : null}
            </Stack>
          );
        },
      },
      {
        id: 'message',
        label: 'Message',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ maxWidth: 260, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'left' }}
          >
            {row.message || '—'}
          </Typography>
        ),
      },
      {
        id: 'reply',
        label: 'Reply',
        render: (row) => (
          <Typography
            variant="body2"
            sx={{ maxWidth: 200, whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'left' }}
          >
            {row.feedbackResponse || '—'}
          </Typography>
        ),
      },
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
        width: 170,
        render: (row) => (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.75}>
            {canEdit && (
              <Button
                size="small"
                variant="contained"
                startIcon={<ReplyIcon sx={{ fontSize: 16 }} />}
                onClick={() => openReply(row)}
                sx={{ ...orangeBtnSx, fontSize: 11, px: 1.25, py: 0.25, minHeight: 28 }}
              >
                Respond
              </Button>
            )}
            <IconButton
              size="small"
              aria-label="Delete"
              onClick={() => openDelete(row)}
              sx={{ color: '#f44336' }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ),
      },
    ],
    [page, pageSize, canEdit, canShowMobile, openReply, openDelete, copyMobile],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title="Pending Feedback"
        summary={`${appliedStart && appliedEnd ? `${appliedStart} – ${appliedEnd} · ` : ''}${pageSize} per page · ${total} total`}
        headerActions={
          <Button
            variant="outlined"
            size="small"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            onClick={(event) => {
              event.stopPropagation();
              void load();
            }}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        }
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="nowrap"
          useFlexGap
          sx={{ minWidth: 'max-content' }}
        >
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={headerFieldSx}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={headerFieldSx}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...headerFieldSx, width: 140 }}
          >
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyFilters}
            disabled={loading}
            sx={{ ...orangeBtnSx, height: 40, px: 2.5, flexShrink: 0 }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
          </Button>
          <Button
            variant="outlined"
            onClick={clearDates}
            disabled={loading}
            sx={{
              height: 40,
              px: 2,
              flexShrink: 0,
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#e8e8ea',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
              },
            }}
          >
            Clear Dates
          </Button>
          <Typography
            variant="body2"
            fontWeight={700}
            color="text.secondary"
            sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            Total: {total}
          </Typography>
        </Stack>
      </CollapsibleFilterPanel>

      {error ? (
        <Typography variant="body2" color="error" mb={2}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          <>
            <Pagination
              count={Math.max(1, totalPages)}
              page={page}
              onChange={(_e, p) => setPage(p)}
              color="primary"
              disabled={loading}
            />
          </>
        }
        footerJustify="center"
      >
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, i) => row._id || i}
          loading={loading}
          emptyMessage="No pending feedback found"
          stickyHeader
          dense
          minWidth={1100}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={replyOpen} onClose={() => setReplyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reply to Feedback</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            label="Feedback reply"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplyOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleReply()}
            disabled={submitting}
            sx={orangeBtnSx}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Do you want to delete?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This feedback will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
