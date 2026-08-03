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
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
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

type SummaryFlag = { flag?: unknown; reason?: string; level?: unknown; required?: unknown; value?: unknown; detected?: unknown; types?: string[] };

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

function buildSummaryRows(summaryData: CallSummaryData | null) {
  const raw = summaryData?.data?.analysis ?? summaryData?.data;
  if (!raw || typeof raw !== 'object') return [];

  const data = raw as Record<string, unknown>;
  const threat = data.threat as SummaryFlag | undefined;
  const priority = data.priority as SummaryFlag | undefined;
  const humanIntervention = data.human_intervention as SummaryFlag | undefined;
  const satisfaction = data.satisfaction as SummaryFlag | undefined;
  const frustration = data.frustration as SummaryFlag | undefined;
  const nuisance = data.nuisance as SummaryFlag | undefined;
  const repeatedComplaint = data.repeated_complaint as SummaryFlag | undefined;
  const piiDetails = data.pii_details as SummaryFlag | undefined;

  return [
    { title: 'Summary', value: data.summary, reason: '-' },
    {
      title: 'Transcript',
      value: summaryData?.data?.transcript || data.transcript,
      reason: '-',
    },
    { title: 'Priority', value: priority?.level, reason: priority?.reason },
    { title: 'Threat', value: threat?.flag, reason: threat?.reason || 'N/A' },
    {
      title: 'Human Intervention',
      value: humanIntervention?.required,
      reason: humanIntervention?.reason,
    },
    {
      title: 'Frustration',
      value: frustration?.level,
      reason: frustration?.reason,
    },
    {
      title: 'Satisfaction',
      value: satisfaction?.value,
      reason: satisfaction?.reason || 'N/A',
    },
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
    { title: 'Next Best Action', value: data.next_best_action, reason: '' },
  ];
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

  const openSummary = useCallback(async (call: IncomingCall) => {
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
        return;
      }
      setSummaryData(res.data || null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const summaryRows = useMemo(() => buildSummaryRows(summaryData), [summaryData]);

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
      />

      <Dialog
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Call Summary</DialogTitle>
        <DialogContent>
          {summaryLoading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress size={28} />
            </Stack>
          ) : summaryData ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Attribute</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>Reason / Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaryRows.map((item) => (
                  <TableRow key={item.title}>
                    <TableCell>
                      <Typography fontWeight={600}>{item.title}</Typography>
                    </TableCell>
                    <TableCell>{display(item.value)}</TableCell>
                    <TableCell>{display(item.reason)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography color="text.secondary">No summary data available.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
