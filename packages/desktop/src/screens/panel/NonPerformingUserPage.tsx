import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { appCodeForName, CLIENT_NAMES } from '@/constants/clientNames';
import { formatDisplayDate, formatDisplayTime, getStoredUser } from '@/utils/dates';
import { DEFAULT_ITEMS_PER_PAGE, ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { useReportQuery, asPaged, display, maskMobile } from './shared';

type NonPerformingComment = {
  comment?: string;
  who?: { userId?: string; userName?: string };
  userName?: string;
  commented_by?: string;
  date?: string;
  createdOn?: string;
  createdAt?: string;
};

type NonPerformingUserRow = {
  _id: string;
  name?: string;
  clientName?: string;
  email?: string;
  mobile?: string;
  balance?: number;
  totalAmount?: number;
  state?: string;
  city?: string;
  currentAppVersion?: string;
  updatedAppVersion?: string;
  createdOn?: string;
  updatedOn?: string;
  nonPerformingComments?: NonPerformingComment[];
  nonPerformingComment?: NonPerformingComment[];
  newRegistrationComments?: NonPerformingComment[];
  comments?: NonPerformingComment[];
};

type Filters = {
  name: string;
  dpId: string;
  mobile: string;
  balance: string;
  state: string;
  city: string;
};

const EMPTY_FILTERS: Filters = {
  name: '',
  dpId: '',
  mobile: '',
  balance: '',
  state: '',
  city: '',
};

const filterFieldSx = {
  minWidth: 120,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
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

const iconActionSx = {
  p: 0.35,
  border: '1px solid',
  borderRadius: 1,
} as const;

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

function roundAmount(value: unknown): number {
  return Math.floor(Number(value) || 0);
}

/** Tolerant comment lookup (admin-panel-domains / mobile parity). */
function commentsOf(row: NonPerformingUserRow | null | undefined): NonPerformingComment[] {
  if (!row) return [];
  const raw =
    row.nonPerformingComments ||
    row.nonPerformingComment ||
    row.newRegistrationComments ||
    row.comments ||
    [];
  return Array.isArray(raw) ? raw : [];
}

function commentAuthor(c: NonPerformingComment): string {
  return String(c.who?.userName || c.userName || c.commented_by || '-');
}

function commentWhen(c: NonPerformingComment): string {
  const raw = c.date || c.createdOn || c.createdAt;
  if (!raw) return '';
  const date = formatDisplayDate(raw);
  const time = formatDisplayTime(raw);
  return [date, time].filter(Boolean).join(' ');
}

/** Non Performing User list — ops.nonPerformingUser + add/view comments. */
export function NonPerformingUserPage() {
  const navigate = useNavigate();
  const admin = getStoredUser<{ _id?: string; name?: string }>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState('');
  const [appliedEnd, setAppliedEnd] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentUserId, setCommentUserId] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [viewCommentsOpen, setViewCommentsOpen] = useState(false);
  const [viewComments, setViewComments] = useState<NonPerformingComment[]>([]);
  const [viewCommentsName, setViewCommentsName] = useState('');

  const canShowMobile = hasPermission('show_mobile');

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigate(`/users/report/${userId}/${encodeURIComponent(userName || '')}`);
    },
    [navigate],
  );

  const buildFilter = useCallback((): Record<string, unknown> => {
    const filter: Record<string, unknown> = {};
    if (applied.name.trim()) filter.name = applied.name.trim();
    if (applied.dpId.trim()) filter._id = applied.dpId.trim();
    if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
    if (applied.balance.trim() && !Number.isNaN(Number(applied.balance))) {
      filter.balance = Number(applied.balance);
    }
    if (applied.state.trim()) filter.state = applied.state.trim();
    if (applied.city.trim()) filter.city = applied.city.trim();
    if (clientName) filter.clientName = clientName;
    return filter;
  }, [applied, clientName]);

  const { rows, totalPages, total, loading, error, load, setRows } =
    useReportQuery<NonPerformingUserRow>({
      action: 'ops.nonPerformingUser',
      buildPayload: () => ({
        pageNo: page,
        itemPerPage: itemsPerPage,
        ...(appliedStart && appliedEnd ? { startDate: appliedStart, endDate: appliedEnd } : {}),
        filter: buildFilter(),
      }),
      unpack: (res) => asPaged<NonPerformingUserRow>(res.data),
      autoDeps: [page, itemsPerPage, applied, clientName, appliedStart, appliedEnd],
      errorMessage: 'Failed to load non performing users',
    });

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  const applyDates = useCallback(() => {
    setApplied(draft);
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
    setPage(1);
  }, [draft, startDate, endDate]);

  const setDraftField = useCallback(
    (key: keyof Filters) => (value: string) => setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const openAddComment = useCallback((row: NonPerformingUserRow) => {
    setCommentUserId(row._id);
    setCommentInput('');
    setCommentOpen(true);
  }, []);

  const openViewComments = useCallback((row: NonPerformingUserRow) => {
    setViewComments(commentsOf(row));
    setViewCommentsName(String(row.name || ''));
    setViewCommentsOpen(true);
  }, []);

  const submitComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text || !commentUserId) {
      toast.error('Please enter a comment');
      return;
    }
    const newComment: NonPerformingComment = {
      comment: text,
      who: { userId: admin?._id, userName: admin?.name },
      date: new Date().toISOString(),
    };
    setCommentBusy(true);
    try {
      const res = await secureApi('ops.addNonPerformingComment', {
        _id: commentUserId,
        comment: text,
        who: { userId: admin?._id, userName: admin?.name },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add comment');
        return;
      }
      setRows((prev) =>
        prev.map((u) =>
          u._id === commentUserId
            ? { ...u, nonPerformingComments: [...commentsOf(u), newComment] }
            : u,
        ),
      );
      toast.success('Comment added successfully');
      setCommentOpen(false);
      setCommentUserId('');
      setCommentInput('');
      void load();
    } finally {
      setCommentBusy(false);
    }
  }, [admin?._id, admin?.name, commentInput, commentUserId, load, setRows]);

  const columns = useMemo<CommonTableColumn<NonPerformingUserRow>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => (page - 1) * itemsPerPage + index + 1,
      },
      {
        id: 'name',
        label: 'User Name',
        filter: (
          <ColumnSearch
            value={draft.name}
            onChange={setDraftField('name')}
            onSearch={search}
            placeholder="Search name"
          />
        ),
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 600,
              cursor: row._id ? 'pointer' : 'default',
              whiteSpace: 'normal',
              maxWidth: 160,
            }}
            onClick={() => openUserReport(row._id, row.name)}
          >
            {display(row.name)}
          </Typography>
        ),
      },
      {
        id: 'dpId',
        label: 'Dp ID',
        filter: (
          <ColumnSearch
            value={draft.dpId}
            onChange={setDraftField('dpId')}
            onSearch={search}
            placeholder="Search Dp Id"
          />
        ),
        render: (row) => display(row._id),
      },
      {
        id: 'appName',
        label: 'App Code',
        render: (row) => appCodeForName(row.clientName),
      },
      { id: 'email', label: 'Email', render: (row) => display(row.email) },
      {
        id: 'mobile',
        label: 'Mobile',
        filter: (
          <ColumnSearch
            value={draft.mobile}
            onChange={setDraftField('mobile')}
            onSearch={search}
            placeholder="Search mobile"
          />
        ),
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      {
        id: 'balance',
        label: 'Balance',
        filter: (
          <ColumnSearch
            value={draft.balance}
            onChange={setDraftField('balance')}
            onSearch={search}
            placeholder="Search balance"
          />
        ),
        render: (row) => roundAmount(row.balance),
      },
      {
        id: 'deposit',
        label: 'Deposit Amount',
        render: (row) => roundAmount(row.totalAmount),
      },
      {
        id: 'state',
        label: 'State',
        filter: (
          <ColumnSearch
            value={draft.state}
            onChange={setDraftField('state')}
            onSearch={search}
            placeholder="Search state"
          />
        ),
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        filter: (
          <ColumnSearch
            value={draft.city}
            onChange={setDraftField('city')}
            onSearch={search}
            placeholder="Search city"
          />
        ),
        render: (row) => display(row.city),
      },
      {
        id: 'appVersion',
        label: 'Current / Updated App Version',
        render: (row) => `${display(row.currentAppVersion)} / ${display(row.updatedAppVersion)}`,
      },
      {
        id: 'created',
        label: 'Created',
        render: (row) =>
          row.createdOn
            ? `${formatDisplayDate(row.createdOn)} ${formatDisplayTime(row.createdOn)}`
            : '—',
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        render: (row) =>
          row.updatedOn
            ? `${formatDisplayDate(row.updatedOn)} ${formatDisplayTime(row.updatedOn)}`
            : '—',
      },
      {
        id: 'comments',
        label: (
          <>
            Add
            <br />
            Comment
          </>
        ),
        width: 150,
        filter: null,
        render: (row) => {
          const count = commentsOf(row).length;
          return (
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.35}>
              <Tooltip title="Add Comment">
                <IconButton
                  size="small"
                  aria-label="Add Comment"
                  onClick={() => openAddComment(row)}
                  sx={{
                    ...iconActionSx,
                    color: '#1a1200',
                    borderColor: '#f1a144',
                    bgcolor: '#ff9f0a',
                    '&:hover': { bgcolor: '#e09030' },
                  }}
                >
                  <ChatBubbleOutlineIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={count > 0 ? `View All (${count})` : 'View All'}>
                <IconButton
                  size="small"
                  aria-label="View All Comments"
                  onClick={() => openViewComments(row)}
                  sx={{
                    ...iconActionSx,
                    color: 'text.primary',
                    borderColor: 'divider',
                    bgcolor: 'transparent',
                  }}
                >
                  <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              {count > 0 ? (
                <Typography variant="caption" color="text.secondary">
                  ({count})
                </Typography>
              ) : null}
            </Stack>
          );
        },
      },
    ],
    [
      page,
      itemsPerPage,
      draft,
      search,
      canShowMobile,
      setDraftField,
      openUserReport,
      openAddComment,
      openViewComments,
    ],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title="Non Performing User"
        summary={`${startDate && endDate ? `${startDate} – ${endDate} · ` : ''}Total: ${total}`}
        headerActions={
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={(event) => {
              event.stopPropagation();
              void load();
            }}
            disabled={loading}
            sx={{
              borderColor: 'rgba(255,255,255,0.2)',
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
        }
        sx={{ mb: 2 }}
        contentSx={{ overflowX: 'auto' }}
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
            type="date"
            label="From Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={headerFieldSx}
          />
          <TextField
            type="date"
            label="To Date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={headerFieldSx}
          />
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(itemsPerPage)}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
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
          <TextField
            select
            label="App Code"
            size="small"
            value={clientName}
            onChange={(e) => {
              setClientName(e.target.value);
              setPage(1);
            }}
            SelectProps={{ displayEmpty: true }}
            InputLabelProps={{ shrink: true }}
            sx={{ ...headerFieldSx, width: 140 }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {appCodeForName(name)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={applyDates}
            disabled={loading}
            sx={{ ...orangeBtnSx, height: 40, px: 2.5, flexShrink: 0 }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Apply'}
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
          getRowKey={(row, index) => row._id || index}
          loading={loading}
          emptyMessage="No non performing users found"
          stickyHeader
          dense
          minWidth={1600}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog
        open={commentOpen}
        onClose={() => !commentBusy && setCommentOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Please enter Comment"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            disabled={commentBusy}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentOpen(false)} disabled={commentBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={commentBusy || !commentInput.trim()}
            onClick={() => void submitComment()}
          >
            {commentBusy ? '…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={viewCommentsOpen}
        onClose={() => setViewCommentsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Comments{viewCommentsName ? ` — ${viewCommentsName}` : ''}
        </DialogTitle>
        <DialogContent>
          {viewComments.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No Comments
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ py: 1 }}>
              {viewComments.map((c, i) => (
                <Box
                  key={`${commentAuthor(c)}-${i}`}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {c.comment || '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    By: {commentAuthor(c)}
                    {commentWhen(c) ? ` · ${commentWhen(c)}` : ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewCommentsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
