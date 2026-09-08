import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  buildIncomingBotCreatePayload,
  buildIncomingBotUserMapByPhone,
  buildIncomingBotUserMapBySid,
  enrichIncomingCallsWithUsers,
  extractIncomingBotCallUsers,
  extractIncomingBotDocId,
  formatIncomingBotCommentAuthor,
  formatIncomingBotCommentWhen,
  getIncomingBotCallMobile,
  getIncomingBotUntilFromSinceDate,
  INCOMING_BOT_DIALER,
  incomingBotPhoneMatchKey,
  mergeIncomingBotCommentOntoCalls,
  normalizeIncomingBotPhone,
  type IncomingBotCallerComment,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { getSessionUser, hasPermission } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { RecordingPlayerDialog } from '@/components/RecordingPlayerDialog';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { display } from '@/screens/panel/shared';
import { todayIST } from '@/utils/dates';

type IncomingCall = {
  sid: string;
  from?: string;
  to?: string;
  direction?: string;
  status?: string;
  start_time?: string;
  duration?: string | number;
  recording_url?: string | null;
  name?: string;
  state?: string;
  city?: string;
  dp_id?: string;
  app_name?: string;
  mobile?: string;
  doc_id?: string;
  comments?: IncomingBotCallerComment[];
};

type SummaryFlag = {
  flag?: unknown;
  reason?: string;
  level?: unknown;
  required?: unknown;
  value?: unknown;
  detected?: unknown;
  types?: string[];
};

type CallAnalysis = {
  summary?: unknown;
  transcript?: string;
  next_best_action?: unknown;
  threat?: SummaryFlag;
  priority?: SummaryFlag;
  human_intervention?: SummaryFlag;
  satisfaction?: SummaryFlag;
  frustration?: SummaryFlag;
  nuisance?: SummaryFlag;
  repeated_complaint?: SummaryFlag;
  pii_details?: SummaryFlag;
};

type CallSummaryData = {
  status?: string;
  message?: string;
  call_sid?: string;
  data?: {
    transcript?: string;
    analysis?: CallAnalysis;
    summary?: unknown;
    next_best_action?: unknown;
    threat?: SummaryFlag;
    priority?: SummaryFlag;
    human_intervention?: SummaryFlag;
    satisfaction?: SummaryFlag;
    frustration?: SummaryFlag;
    nuisance?: SummaryFlag;
    repeated_complaint?: SummaryFlag;
    pii_details?: SummaryFlag;
  };
};

type SummaryMetric = {
  title: string;
  value: unknown;
  reason?: unknown;
};

type SummaryView = {
  summary: string;
  transcript: string;
  nextAction: string;
  metrics: SummaryMetric[];
};

const ALLOWED_TO_NUMBERS = ['08040265157', '08040265127', '02048556172'];

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const dateFieldSx = {
  width: 180,
  flexShrink: 0,
  '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 13 },
};

const dialogPaperSx = {
  bgcolor: '#0f0f14',
  backgroundImage: 'none',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 2.5,
  overflow: 'hidden',
};

function getLast10Digits(value?: string | null): string {
  return incomingBotPhoneMatchKey(value);
}

const ALLOWED_TO_NORMALIZED = new Set(ALLOWED_TO_NUMBERS.map((num) => normalizeIncomingBotPhone(num)));

function isAllowedToNumber(to?: string | null): boolean {
  const normalized = normalizeIncomingBotPhone(to);
  if (!normalized) return false;
  if (ALLOWED_TO_NORMALIZED.has(normalized)) return true;
  const last10 = getLast10Digits(to);
  return Array.from(ALLOWED_TO_NORMALIZED).some(
    (allowed) => allowed === last10 || getLast10Digits(allowed) === last10,
  );
}

function startOfDayUtc(dateValue?: string): string {
  const date = dateValue ? new Date(dateValue) : new Date();
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatDurationInMin(duration: string | number | undefined): string {
  const seconds = Number(duration);
  if (duration === undefined || duration === '' || Number.isNaN(seconds)) return '—';
  return (seconds / 60).toFixed(2);
}

function asText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return String(value).trim();
}

function formatMetricValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function metricTone(
  title: string,
  value: unknown,
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  const text = String(value ?? '').toLowerCase();
  if (
    value === true ||
    text === 'true' ||
    text === 'yes' ||
    text === 'high' ||
    text === 'critical'
  ) {
    if (title === 'Satisfaction') return 'success';
    return 'error';
  }
  if (text === 'medium' || text === 'moderate') return 'warning';
  if (value === false || text === 'false' || text === 'no' || text === 'low' || text === 'none') {
    return 'success';
  }
  return 'info';
}

function buildSummaryView(summaryData: CallSummaryData | null): SummaryView {
  const raw = summaryData?.data?.analysis ?? summaryData?.data;
  if (!raw || typeof raw !== 'object') {
    return { summary: '', transcript: '', nextAction: '', metrics: [] };
  }

  const data = raw as CallAnalysis;
  const threat = data.threat;
  const priority = data.priority;
  const humanIntervention = data.human_intervention;
  const satisfaction = data.satisfaction;
  const frustration = data.frustration;
  const nuisance = data.nuisance;
  const repeatedComplaint = data.repeated_complaint;
  const piiDetails = data.pii_details;

  return {
    summary: asText(data.summary),
    transcript: asText(summaryData?.data?.transcript || data.transcript),
    nextAction: asText(data.next_best_action),
    metrics: [
      { title: 'Priority', value: priority?.level, reason: priority?.reason },
      { title: 'Threat', value: threat?.flag, reason: threat?.reason },
      {
        title: 'Human Intervention',
        value: humanIntervention?.required,
        reason: humanIntervention?.reason,
      },
      { title: 'Frustration', value: frustration?.level, reason: frustration?.reason },
      { title: 'Satisfaction', value: satisfaction?.value, reason: satisfaction?.reason },
      { title: 'Nuisance', value: nuisance?.value, reason: nuisance?.reason },
      {
        title: 'Repeated Complaint',
        value: repeatedComplaint?.value,
        reason: repeatedComplaint?.reason,
      },
      {
        title: 'PII Details',
        value: piiDetails?.detected,
        reason: piiDetails?.types?.join(', '),
      },
    ],
  };
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        bgcolor: '#16161d',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 2,
      }}
    >
      <Typography
        sx={{
          mb: 1.25,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export function IncomingBotCallPage() {
  const navigate = useNavigate();
  const canShowMobile = hasPermission('show_mobile');
  const [sinceDate, setSinceDate] = useState(() => todayIST());
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchSid, setSearchSid] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedSid, setAppliedSid] = useState('');
  const [rows, setRows] = useState<IncomingCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<CallSummaryData | null>(null);
  const [summaryCall, setSummaryCall] = useState<IncomingCall | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [dialerLoadingSid, setDialerLoadingSid] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentDocId, setCommentDocId] = useState('');
  const [commentCallSid, setCommentCallSid] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [viewCommentsOpen, setViewCommentsOpen] = useState(false);
  const [viewComments, setViewComments] = useState<IncomingBotCallerComment[]>([]);
  const [viewCommentsName, setViewCommentsName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = startOfDayUtc(sinceDate);
      const until = getIncomingBotUntilFromSinceDate(sinceDate);
      const [listRes, usersRes] = await Promise.all([
        secureApi<{ calls?: IncomingCall[] }>('incomingBot.list', { since, until }),
        secureApi('incomingBot.getAll', {
          pageNo: 1,
          itemsPerPage: 500,
          startDate: sinceDate,
          endDate: sinceDate,
          filter: {},
        }),
      ]);

      if (!listRes.ok) {
        toast.error(listRes.message || 'Failed to load incoming calls');
        setRows([]);
        return;
      }

      const calls = Array.isArray(listRes.data?.calls) ? listRes.data.calls : [];
      const filtered = calls.filter((c) => isAllowedToNumber(c.to));

      let enriched = filtered;
      if (usersRes.ok) {
        const users = extractIncomingBotCallUsers(usersRes.data);
        enriched = enrichIncomingCallsWithUsers(
          filtered,
          buildIncomingBotUserMapByPhone(users),
          buildIncomingBotUserMapBySid(users),
        );
      } else if (usersRes.message) {
        toast.error(usersRes.message || 'Failed to fetch user details for matching');
      }

      setRows(enriched);
    } finally {
      setLoading(false);
    }
  }, [sinceDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = useCallback(() => {
    setAppliedFrom(searchFrom.trim());
    setAppliedTo(searchTo.trim());
    setAppliedSid(searchSid.trim());
  }, [searchFrom, searchTo, searchSid]);

  const filteredRows = useMemo(() => {
    const fromQ = appliedFrom.toLowerCase();
    const toQ = appliedTo.toLowerCase();
    const sidQ = appliedSid.toLowerCase();
    return rows.filter((call) => {
      if (
        fromQ &&
        !String(call.from || '')
          .toLowerCase()
          .includes(fromQ)
      )
        return false;
      if (
        toQ &&
        !String(call.to || '')
          .toLowerCase()
          .includes(toQ)
      )
        return false;
      if (
        sidQ &&
        !String(call.sid || '')
          .toLowerCase()
          .includes(sidQ)
      )
        return false;
      return true;
    });
  }, [rows, appliedFrom, appliedTo, appliedSid]);

  const closeSummary = useCallback(() => {
    setSummaryOpen(false);
    setSummaryCall(null);
    setSummaryData(null);
  }, []);

  const openSummary = useCallback(async (call: IncomingCall) => {
    setSummaryCall(call);
    setSummaryOpen(true);
    setSummaryData(null);
    setSummaryLoading(true);
    try {
      const res = await secureApi<CallSummaryData>('incomingBot.processCall', {
        call_sid: call.sid,
      });
      if (!res.ok) {
        toast.error(res.message || 'Analysis is in progress.');
        setSummaryOpen(false);
        setSummaryCall(null);
        return;
      }
      setSummaryData(res.data || null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const openUserReport = useCallback(
    (call: IncomingCall) => {
      const userId = String(call.dp_id || '').trim();
      if (!userId) return;
      navigate(
        `/users/report/${encodeURIComponent(userId)}/${encodeURIComponent(
          String(call.name || userId),
        )}`,
      );
    },
    [navigate],
  );

  const connectToDialer = useCallback(async (call: IncomingCall) => {
    const phone = getIncomingBotCallMobile(call);
    if (!phone) {
      toast.error('No phone number for this call');
      return;
    }
    setDialerLoadingSid(call.sid);
    try {
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId: INCOMING_BOT_DIALER.campaignId,
        serverId: INCOMING_BOT_DIALER.serverId,
        listId: INCOMING_BOT_DIALER.listId,
        listName: INCOMING_BOT_DIALER.listName,
        leads: [
          {
            first_name: call.name || '',
            last_name: '',
            phone_number: phone,
            city: call.city ?? '',
            state: call.state ?? '',
            email: call.app_name ?? '',
            comments: call.app_name ?? '',
            province: call.dp_id || '',
          },
        ],
      });
      if (!res.ok) toast.error(res.message || 'Dialer API failed');
      else toast.success(res.message || 'Data sent successfully');
    } finally {
      setDialerLoadingSid('');
    }
  }, []);

  const openAddComment = useCallback((call: IncomingCall) => {
    const docId = String(call.doc_id || '').trim();
    const sid = String(call.sid || '').trim();
    if (!docId && !sid) {
      toast.error('Unable to add comment for this call');
      return;
    }
    setCommentDocId(docId);
    setCommentCallSid(sid);
    setCommentInput('');
    setCommentOpen(true);
  }, []);

  const submitComment = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const text = commentInput.trim();
      if (!text) {
        toast.error('Please enter a comment');
        return;
      }
      if (!commentDocId && !commentCallSid) {
        toast.error('Unable to add comment for this call');
        return;
      }

      const user = getSessionUser();
      const newComment: IncomingBotCallerComment = {
        comment: text,
        who: { userId: user?._id, userName: user?.name },
        date: new Date().toISOString(),
      };
      const submittedDocId = commentDocId;
      const submittedSid = commentCallSid;
      const targetCall = rows.find(
        (c) =>
          (submittedSid && c.sid === submittedSid) ||
          (submittedDocId && c.doc_id === submittedDocId),
      );

      setCommentBusy(true);
      try {
        let docIdForComment = submittedDocId;

        // No doc_id → create record, then add-comment (Laxmi parity)
        if (!docIdForComment) {
          if (!targetCall) {
            toast.error('Unable to add comment for this call');
            return;
          }
          const createRes = await secureApi(
            'incomingBot.create',
            buildIncomingBotCreatePayload({
              ...targetCall,
              sid: targetCall.sid || submittedSid,
            }),
          );
          if (!createRes.ok) {
            toast.error(createRes.message || 'Failed to create comment record');
            return;
          }
          docIdForComment = extractIncomingBotDocId(createRes.data);
          if (!docIdForComment) {
            toast.error('Failed to create comment record');
            return;
          }
        }

        const res = await secureApi('incomingBot.addComment', {
          _id: docIdForComment,
          comment: text,
        });
        if (!res.ok) {
          toast.error(res.message || 'Failed to add comment');
          return;
        }

        setRows((prev) =>
          mergeIncomingBotCommentOntoCalls(prev, {
            sid: submittedSid,
            docId: docIdForComment,
            comment: newComment,
          }),
        );
        toast.success('Comment added successfully');
        setCommentOpen(false);
        setCommentInput('');
        setCommentDocId('');
        setCommentCallSid('');

        // Refresh getAll for doc_id, then re-apply local comment if server list lags
        if (!submittedDocId) {
          void load().then(() => {
            setRows((prev) =>
              mergeIncomingBotCommentOntoCalls(prev, {
                sid: submittedSid,
                docId: docIdForComment,
                comment: newComment,
              }),
            );
          });
        }
      } finally {
        setCommentBusy(false);
      }
    },
    [commentInput, commentDocId, commentCallSid, rows, load],
  );

  const openViewComments = useCallback((call: IncomingCall) => {
    setViewCommentsName(String(call.name || call.dp_id || call.sid || ''));
    setViewComments(call.comments || []);
    setViewCommentsOpen(true);
  }, []);

  const summaryView = useMemo(() => buildSummaryView(summaryData), [summaryData]);

  const columns = useMemo<CommonTableColumn<IncomingCall>[]>(
    () => [
      {
        id: 'index',
        label: '#',
        width: 64,
        render: (_row, index) => index + 1,
      },
      {
        id: 'from',
        label: 'From',
        filter: (
          <TableSearchBar
            value={searchFrom}
            onChange={(e) => setSearchFrom(e.target.value)}
            onSearch={applySearch}
            placeholder="From"
          />
        ),
        render: (row) => {
          const mobile = getIncomingBotCallMobile(row);
          const shown =
            row.dp_id && !canShowMobile ? '**********' : display(mobile || row.from);
          const busy = dialerLoadingSid === row.sid;
          return (
            <Stack alignItems="center" spacing={0.75} sx={{ py: 0.5 }}>
              <Typography fontSize={13}>{shown}</Typography>
              <Button
                size="small"
                variant="contained"
                disabled={busy || !mobile}
                onClick={() => void connectToDialer(row)}
                sx={{
                  ...orangeBtnSx,
                  minWidth: 72,
                  py: 0.25,
                  px: 1.25,
                  fontSize: 12,
                }}
              >
                {busy ? 'Sending…' : 'Call'}
              </Button>
            </Stack>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => display(row.name),
      },
      {
        id: 'state',
        label: 'State',
        render: (row) => display(row.state),
      },
      {
        id: 'city',
        label: 'City',
        render: (row) => display(row.city),
      },
      {
        id: 'dpId',
        label: 'DP ID',
        render: (row) =>
          row.dp_id ? (
            <Link
              component="button"
              type="button"
              onClick={() => openUserReport(row)}
              underline="hover"
              sx={{ fontSize: 13, fontWeight: 600 }}
            >
              {row.dp_id}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        id: 'appName',
        label: 'App Name',
        render: (row) => display(row.app_name),
      },
      {
        id: 'to',
        label: 'To',
        filter: (
          <TableSearchBar
            value={searchTo}
            onChange={(e) => setSearchTo(e.target.value)}
            onSearch={applySearch}
            placeholder="To"
          />
        ),
        render: (row) => display(row.to),
      },
      {
        id: 'sid',
        label: 'SID',
        filter: (
          <TableSearchBar
            value={searchSid}
            onChange={(e) => setSearchSid(e.target.value)}
            onSearch={applySearch}
            placeholder="SID"
          />
        ),
        render: (row) => display(row.sid),
      },
      {
        id: 'type',
        label: 'Type',
        render: (row) => display(row.direction),
      },
      {
        id: 'status',
        label: 'Status',
        render: (row) => display(row.status),
      },
      {
        id: 'duration',
        label: 'Duration',
        render: (row) => formatDurationInMin(row.duration),
      },
      {
        id: 'startTime',
        label: 'Start Time',
        render: (row) => formatDateTime(row.start_time),
      },
      {
        id: 'comments',
        label: 'Comment',
        width: 170,
        render: (row) => {
          const count = row.comments?.length || 0;
          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <Tooltip title="Add Comment">
                <IconButton
                  size="small"
                  onClick={() => openAddComment(row)}
                  sx={{ color: '#ff9f0a' }}
                >
                  <ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={count > 0 ? `View All (${count})` : 'View All'}>
                <IconButton
                  size="small"
                  onClick={() => openViewComments(row)}
                  sx={{ color: 'text.secondary' }}
                >
                  <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
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
      {
        id: 'action',
        label: 'Action',
        width: 120,
        render: (row) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center' }}>
              {row.recording_url ? (
                <Tooltip title="Play Recording">
                  <IconButton
                    size="small"
                    onClick={() => setRecordingUrl(row.recording_url!)}
                    sx={{ color: '#ff9f0a' }}
                  >
                    <PlayArrowOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
            <Tooltip title="View Summary">
              <IconButton
                size="small"
                onClick={() => void openSummary(row)}
                sx={{ color: '#ff9f0a' }}
              >
                <SummarizeOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ),
      },
    ],
    [
      searchFrom,
      searchTo,
      searchSid,
      applySearch,
      openSummary,
      openUserReport,
      canShowMobile,
      dialerLoadingSid,
      connectToDialer,
      openAddComment,
      openViewComments,
    ],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-end"
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 1.5 }}
      >
        <TextField
          size="small"
          type="date"
          label="Since Date (UTC)"
          InputLabelProps={{ shrink: true }}
          value={sinceDate}
          onChange={(e) => setSinceDate(e.target.value)}
          sx={dateFieldSx}
        />
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          sx={orangeBtnSx}
        >
          Refresh
        </Button>
      </Stack>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={filteredRows}
          loading={loading}
          getRowKey={(row) => row.sid}
          emptyMessage="No incoming calls found"
          virtualize={false}
          stickyHeader
          dense
          minWidth={1700}
          maxHeight="100%"
        />
      </TablePanel>

      <RecordingPlayerDialog url={recordingUrl} onClose={() => setRecordingUrl(null)} />

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
              {viewComments.map((c, i) => {
                const who = formatIncomingBotCommentAuthor(c);
                const when = formatIncomingBotCommentWhen(c);
                return (
                  <Box
                    key={`c-${i}`}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {String(c.comment || '—')}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.75 }}
                    >
                      By: {who}
                      {when ? ` · ${when}` : ''}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewCommentsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={summaryOpen}
        onClose={closeSummary}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: dialogPaperSx }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            pr: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#121218',
          }}
        >
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Box
              sx={{
                mt: 0.25,
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(255,159,10,0.14)',
                color: '#ff9f0a',
                flexShrink: 0,
              }}
            >
              <SummarizeOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography fontWeight={700} fontSize={18}>
                Call Summary
              </Typography>
              <Typography color="text.secondary" fontSize={12} sx={{ mt: 0.35 }}>
                {summaryCall
                  ? `${display(summaryCall.from)} → ${display(summaryCall.to)}`
                  : 'AI analysis'}
                {summaryCall?.sid ? ` · ${summaryCall.sid}` : ''}
              </Typography>
            </Box>
          </Stack>
          <IconButton size="small" onClick={closeSummary} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2.5, bgcolor: '#0f0f14' }}>
          {summaryLoading ? (
            <Stack alignItems="center" justifyContent="center" py={8} spacing={1.5}>
              <CircularProgress size={28} sx={{ color: '#ff9f0a' }} />
              <Typography color="text.secondary" fontSize={13}>
                Loading call analysis…
              </Typography>
            </Stack>
          ) : summaryData ? (
            <Stack spacing={2} mt={0.5}>
              <SectionCard title="Summary">
                <Typography
                  sx={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    color: summaryView.summary ? 'text.primary' : 'text.secondary',
                    fontSize: 14,
                  }}
                >
                  {summaryView.summary || 'No summary available.'}
                </Typography>
              </SectionCard>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                  },
                  gap: 1.25,
                }}
              >
                {summaryView.metrics.map((item) => {
                  const tone = metricTone(item.title, item.value);
                  const reason = asText(item.reason);
                  return (
                    <Paper
                      key={item.title}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        bgcolor: '#16161d',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 2,
                        minHeight: 92,
                      }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={1}
                        mb={0.75}
                      >
                        <Typography
                          fontSize={12}
                          fontWeight={700}
                          color="rgba(255,255,255,0.55)"
                          sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}
                        >
                          {item.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={formatMetricValue(item.value)}
                          color={tone === 'default' ? 'default' : tone}
                          variant={tone === 'default' ? 'outlined' : 'filled'}
                          sx={{
                            height: 24,
                            fontWeight: 700,
                            fontSize: 11,
                            ...(tone === 'default'
                              ? {
                                  borderColor: 'rgba(255,255,255,0.2)',
                                  color: 'text.primary',
                                }
                              : null),
                          }}
                        />
                      </Stack>
                      <Typography
                        fontSize={12.5}
                        color={reason ? 'text.secondary' : 'rgba(255,255,255,0.28)'}
                        sx={{ lineHeight: 1.45 }}
                      >
                        {reason || 'No extra details'}
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>

              {summaryView.nextAction ? (
                <SectionCard title="Next Best Action">
                  <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>
                    {summaryView.nextAction}
                  </Typography>
                </SectionCard>
              ) : null}

              <SectionCard title="Transcript">
                <Box
                  sx={{
                    maxHeight: 220,
                    overflow: 'auto',
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 6 },
                    '&::-webkit-scrollbar-thumb': {
                      bgcolor: 'rgba(255,255,255,0.18)',
                      borderRadius: 8,
                    },
                  }}
                >
                  <Typography
                    sx={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.65,
                      fontSize: 13.5,
                      color: summaryView.transcript ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {summaryView.transcript || 'No transcript available.'}
                  </Typography>
                </Box>
              </SectionCard>
            </Stack>
          ) : (
            <Stack alignItems="center" py={8}>
              <Typography color="text.secondary">No summary data available.</Typography>
            </Stack>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
            py: 1.75,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#121218',
          }}
        >
          <Button onClick={closeSummary} sx={orangeBtnSx}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
