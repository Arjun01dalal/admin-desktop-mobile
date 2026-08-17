import { useCallback, useMemo, useState } from 'react';
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
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { TableSearchBar } from '@/components/TableSearchBar';
import { display, useReportQuery } from '@/screens/panel/shared';
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

type CallSummaryData = {
  status?: string;
  message?: string;
  call_sid?: string;
  data?: {
    transcript?: string;
    analysis?: Record<string, unknown>;
    [key: string]: unknown;
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
  return (value ?? '').replace(/\D/g, '').slice(-10);
}

const ALLOWED_TO_SUFFIXES = ALLOWED_TO_NUMBERS.map(getLast10Digits);

function isAllowedToNumber(to?: string | null): boolean {
  return ALLOWED_TO_SUFFIXES.includes(getLast10Digits(to));
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
  if (value === true || text === 'true' || text === 'yes' || text === 'high' || text === 'critical') {
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

  const data = raw as Record<string, unknown>;
  const threat = data.threat as SummaryFlag | undefined;
  const priority = data.priority as SummaryFlag | undefined;
  const humanIntervention = data.human_intervention as SummaryFlag | undefined;
  const satisfaction = data.satisfaction as SummaryFlag | undefined;
  const frustration = data.frustration as SummaryFlag | undefined;
  const nuisance = data.nuisance as SummaryFlag | undefined;
  const repeatedComplaint = data.repeated_complaint as SummaryFlag | undefined;
  const piiDetails = data.pii_details as SummaryFlag | undefined;

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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  const [sinceDate, setSinceDate] = useState(() => todayIST());
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchSid, setSearchSid] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedSid, setAppliedSid] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<CallSummaryData | null>(null);
  const [summaryCall, setSummaryCall] = useState<IncomingCall | null>(null);

  const buildPayload = useCallback(
    () => ({ since: startOfDayUtc(sinceDate) }),
    [sinceDate],
  );

  const unpack = useCallback((res: { data?: unknown }) => {
    const data = res.data as { calls?: IncomingCall[] } | undefined;
    const calls = Array.isArray(data?.calls) ? data.calls : [];
    return { rows: calls.filter((c) => isAllowedToNumber(c.to)) };
  }, []);

  const { rows, loading, load } = useReportQuery<IncomingCall>({
    action: 'incomingBot.list',
    buildPayload,
    unpack,
    autoDeps: [sinceDate],
    errorMessage: 'Failed to load incoming calls',
    cacheTtlMs: 0,
  });

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
      if (fromQ && !String(call.from || '').toLowerCase().includes(fromQ)) return false;
      if (toQ && !String(call.to || '').toLowerCase().includes(toQ)) return false;
      if (sidQ && !String(call.sid || '').toLowerCase().includes(sidQ)) return false;
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
        render: (row) => display(row.from),
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
                    onClick={() =>
                      window.open(row.recording_url!, '_blank', 'noopener,noreferrer')
                    }
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
    [searchFrom, searchTo, searchSid, applySearch, openSummary],
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
        minWidth={1100}
        maxHeight="100%"
      />
      </TablePanel>

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
