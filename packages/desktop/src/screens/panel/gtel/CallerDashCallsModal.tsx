/** Caller Calls modal — web admin CallerCallsModal parity. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  GTEL_VERTICAL_LABELS,
  buildGtelCallsQuery,
  buildGtelCxSummaryCounts,
  emptyGtelFilters,
  extractGtelCallById,
  getGtelCallId,
  getGtelCallSource,
  getGtelDpiId,
  getGtelPersonalConnectIntent,
  getGtelPlayedLabel,
  getGtelPlayedVerticals,
  getGtelUsername,
  gtelDispositionTone,
  gtelStatusTone,
  isGtelFlaggedCall,
  normalizeGtelCallsPage,
  pickGtelRecordingUrl,
  pickGtelTranscription,
  type GtelCall,
  type GtelVerticalCode,
} from '@astro/shared';
import { RecordingPlayerDialog } from '@/components/RecordingPlayerDialog';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { fieldSx } from '@/screens/panel/transactions/shared';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { secureApi } from '@/api/secureClient';

import { useGtelAuth } from './useGtelAuth';
import { gtelStatusPillSx } from './styles';
import { useDashPalette } from './tones';

type Props = {
  open: boolean;
  name: string;
  empCode: string;
  from: string;
  to: string;
  onClose: () => void;
};

type QuickFilter = 'all' | GtelVerticalCode | 'flagged';

type CallActionState = {
  callId: string;
  loading: boolean;
  call: GtelCall | null;
  view: 'actions' | 'transcript';
};


const DISP_PILL: Record<
  ReturnType<typeof gtelDispositionTone>,
  { bg: string; fg: string }
> = {
  answer: { bg: alpha('#2e7d32', 0.14), fg: '#1b5e20' },
  callback: { bg: alpha('#6a1b9a', 0.12), fg: '#4a148c' },
  completed: { bg: alpha('#1565c0', 0.12), fg: '#0d47a1' },
  muted: { bg: alpha('#64748b', 0.12), fg: '#475569' },
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function statusText(call: GtelCall): string {
  const raw = String(call.statusByDialer || call.status || '').trim();
  return raw || '—';
}

function dispositionText(call: GtelCall): string {
  const raw = String(call.disposition || '').trim();
  return raw || '—';
}

export function CallerDashCallsModal({ open, name, empCode, from, to, onClose }: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  const palette = useDashPalette();
  const dark = theme.palette.mode === 'dark';
  const {
    canShowSuspiciousCall: canShowSuspicious,
    canShowMobile,
    shouldLockEmpCode,
    loginEmpCode,
    isCaller,
    loginExtensionId,
  } = useGtelAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);
  const [calls, setCalls] = useState<GtelCall[]>([]);
  const [truncatedNote, setTruncatedNote] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dispositionFilter, setDispositionFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [callAction, setCallAction] = useState<CallActionState | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const closeCallAction = useCallback(() => setCallAction(null), []);

  const openCallAction = useCallback(async (call: GtelCall) => {
    const callId = getGtelCallId(call);
    if (!callId || callId === '—') {
      toast.error('Call id missing');
      return;
    }
    setCallAction({ callId, loading: true, call: null, view: 'actions' });
    try {
      // Web admin: GET /dialer/calls?callId=… ; desktop also has gtel.callDetails.
      let resolved: GtelCall | null = null;
      const listRes = await secureApi('gtel.calls', { callId });
      if (listRes.ok) {
        resolved = extractGtelCallById(listRes.data, callId);
      }
      if (!resolved) {
        const detailRes = await secureApi('gtel.callDetails', { callId });
        if (detailRes.ok) {
          const body =
            detailRes.data && typeof detailRes.data === 'object'
              ? (detailRes.data as Record<string, unknown>)
              : {};
          const nested =
            body.data && typeof body.data === 'object'
              ? (body.data as Record<string, unknown>)
              : body;
          resolved =
            extractGtelCallById(detailRes.data, callId) ||
            (nested && typeof nested === 'object' ? (nested as GtelCall) : null);
        } else if (!listRes.ok) {
          toast.error(detailRes.message || listRes.message || 'Failed to load call');
          setCallAction(null);
          return;
        }
      }
      if (!resolved) {
        toast.error('Call details not found');
        setCallAction(null);
        return;
      }
      setCallAction({ callId, loading: false, call: resolved, view: 'actions' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load call');
      setCallAction(null);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setCallAction(null);
      setRecordingUrl(null);
      return;
    }
    setStatusFilter('all');
    setDispositionFilter('all');
    setSourceFilter('all');
    setQuickFilter('all');
    setError(null);
    setEmptyHint(null);
    setTruncatedNote(null);
    setCalls([]);
    setCallAction(null);

    const code = empCode.trim();
    if (!code) {
      setError('Emp code missing for this caller');
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      /** Cap modal payload — server pages, never dump full dashboard includeCalls. */
      const pageSize = 200;
      const maxCalls = 600;
      try {
        const collected: GtelCall[] = [];
        let pageNo = 1;
        let totalPages = 1;
        let total = 0;
        const today = from.trim() || to.trim() || '';
        const filters = {
          ...emptyGtelFilters(today, code),
          from: from.trim() || today,
          to: to.trim() || today,
          empCode: code,
        };

        while (!cancelled && pageNo <= totalPages && collected.length < maxCalls) {
          const res = await secureApi(
            'gtel.calls',
            buildGtelCallsQuery({
              pageNo,
              itemsPerPage: pageSize,
              filters,
              canShowMobile,
              shouldLockEmpCode,
              loginEmpCode,
              isCaller,
              loginExtensionId,
            }),
          );
          if (cancelled) return;
          if (!res.ok) {
            setError(res.message || 'Failed to load caller calls');
            setCalls([]);
            return;
          }
          const parsed = normalizeGtelCallsPage(res.data, pageSize, code);
          total = parsed.total;
          totalPages = parsed.totalPages;
          collected.push(...parsed.rows);
          if (!parsed.rows.length) break;
          pageNo += 1;
        }

        if (cancelled) return;
        setCalls(collected);
        if (!collected.length) {
          setEmptyHint('No calls found for this caller');
        } else if (total > collected.length) {
          setTruncatedNote(
            `Showing first ${collected.length.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} calls`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    empCode,
    from,
    to,
    canShowMobile,
    shouldLockEmpCode,
    loginEmpCode,
    isCaller,
    loginExtensionId,
  ]);

  const cxCounts = useMemo(() => buildGtelCxSummaryCounts(calls), [calls]);

  const statusOptions = useMemo(
    () => uniqueSorted(calls.map(statusText).filter((v) => v && v !== '—')),
    [calls],
  );
  const dispositionOptions = useMemo(
    () => uniqueSorted(calls.map(dispositionText).filter((v) => v && v !== '—')),
    [calls],
  );
  const sourceOptions = useMemo(
    () =>
      uniqueSorted(
        calls.map((c) => getGtelCallSource(c)).filter((v) => v && v !== '—'),
      ),
    [calls],
  );

  const filteredCalls = useMemo(() => {
    return calls.filter((call) => {
      if (statusFilter !== 'all' && statusText(call) !== statusFilter) return false;
      if (dispositionFilter !== 'all' && dispositionText(call) !== dispositionFilter) {
        return false;
      }
      if (sourceFilter !== 'all' && getGtelCallSource(call) !== sourceFilter) return false;
      if (quickFilter === 'flagged') return isGtelFlaggedCall(call);
      if (quickFilter === 'E' || quickFilter === 'C' || quickFilter === 'S') {
        return getGtelPlayedVerticals(call).includes(quickFilter);
      }
      return true;
    });
  }, [calls, statusFilter, dispositionFilter, sourceFilter, quickFilter]);

  const filtersActive =
    statusFilter !== 'all' ||
    dispositionFilter !== 'all' ||
    sourceFilter !== 'all' ||
    quickFilter !== 'all';

  const border = dark ? alpha('#94a3b8', 0.22) : alpha('#64748b', 0.18);
  const headFg = dark ? '#e9d5ff' : '#4a148c';
  const panelBg = dark ? alpha('#c084fc', 0.08) : alpha('#fce4ec', 0.55);

  const openUserReport = (call: GtelCall) => {
    const id = getGtelDpiId(call);
    if (!id || id === '—') return;
    const userName = encodeURIComponent(getGtelUsername(call) || 'user');
    navigate(`/user-report/${encodeURIComponent(id)}/${userName}`);
  };

  const verticalChip = (
    key: QuickFilter,
    label: string,
    count: number,
    activeColor: string,
  ) => {
    const active = quickFilter === key;
    return (
      <Box
        component="button"
        type="button"
        key={key}
        onClick={() => setQuickFilter((prev) => (prev === key ? 'all' : key))}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.7,
          borderRadius: 1.25,
          border: '1px solid',
          borderColor: active ? activeColor : border,
          bgcolor: active
            ? alpha(activeColor, dark ? 0.22 : 0.12)
            : dark
              ? alpha('#fff', 0.04)
              : '#fff',
          color: active ? activeColor : 'text.primary',
          cursor: 'pointer',
          font: 'inherit',
          m: 0,
          '&:hover': { borderColor: activeColor },
        }}
      >
        <Typography component="em" variant="caption" fontWeight={700} fontStyle="normal">
          {label}
        </Typography>
        <Typography component="b" fontWeight={800} fontSize={13}>
          {count}
        </Typography>
      </Box>
    );
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          maxHeight: '92vh',
          border: '1px solid',
          borderColor: border,
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid',
          borderColor: border,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={800} fontSize={17} noWrap>
            Caller Calls — {name || '—'}
            {empCode ? ` (${empCode})` : ''}
            <Typography
              component="span"
              color="text.secondary"
              fontWeight={600}
              fontSize={14}
              sx={{ ml: 0.75 }}
            >
              • {from || '—'} → {to || '—'}
            </Typography>
          </Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ px: 2.5, py: 1.75, bgcolor: panelBg, borderBottom: `1px solid ${border}` }}>
          <Typography
            variant="caption"
            fontWeight={800}
            letterSpacing={0.6}
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            CX SUMMARY
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 1.75 }}>
            {verticalChip('E', GTEL_VERTICAL_LABELS.E, cxCounts.E, '#ad1457')}
            {verticalChip('C', GTEL_VERTICAL_LABELS.C, cxCounts.C, '#424242')}
            {verticalChip('S', GTEL_VERTICAL_LABELS.S, cxCounts.S, '#6a1b9a')}
            {canShowSuspicious
              ? verticalChip('flagged', 'Flagged Keyword', cxCounts.flagged, palette.chart.flagged)
              : null}
          </Stack>

          <Stack
            direction="row"
            spacing={1.25}
            alignItems="flex-end"
            flexWrap="nowrap"
            sx={{ width: '100%' }}
          >
            <TextField
              select
              size="small"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              sx={{ ...fieldSx, flex: 1, minWidth: 0 }}
            >
              <MenuItem value="all">All Status</MenuItem>
              {statusOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Disposition"
              value={dispositionFilter}
              onChange={(e) => setDispositionFilter(e.target.value)}
              sx={{ ...fieldSx, flex: 1, minWidth: 0 }}
            >
              <MenuItem value="all">All Disposition</MenuItem>
              {dispositionOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              sx={{ ...fieldSx, flex: 1, minWidth: 0 }}
            >
              <MenuItem value="all">All Source</MenuItem>
              {sourceOptions.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
            <Box
              component="button"
              type="button"
              disabled={!filtersActive}
              onClick={() => {
                setStatusFilter('all');
                setDispositionFilter('all');
                setSourceFilter('all');
                setQuickFilter('all');
              }}
              sx={{
                border: 0,
                background: 'none',
                color: filtersActive ? palette.name : 'text.disabled',
                fontWeight: 700,
                fontSize: 13,
                cursor: filtersActive ? 'pointer' : 'default',
                pb: 0.75,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                textDecoration: filtersActive ? 'underline' : 'none',
                textUnderlineOffset: 2,
              }}
            >
              Clear filters
            </Box>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
            Showing:{' '}
            <Box component="b" sx={{ color: 'text.primary', fontWeight: 800 }}>
              {filteredCalls.length}
            </Box>
            {filteredCalls.length !== calls.length ? ` / ${calls.length}` : ''}
            {quickFilter !== 'all' ? (
              <>
                {' '}
                ·{' '}
                <Box component="b" sx={{ color: 'text.primary', fontWeight: 800 }}>
                  {quickFilter === 'flagged'
                    ? 'Flagged Keyword'
                    : GTEL_VERTICAL_LABELS[quickFilter]}
                </Box>
              </>
            ) : null}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minHeight: 280, overflow: 'auto', position: 'relative' }}>
          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : null}
          {truncatedNote ? (
            <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
              {truncatedNote}
            </Typography>
          ) : null}
          {!loading && error && !calls.length ? (
            <Typography color="error" sx={{ p: 3, textAlign: 'center' }}>
              {error}
            </Typography>
          ) : null}
          {!loading && !error && emptyHint && !calls.length ? (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              {emptyHint}
            </Typography>
          ) : null}
          {!loading && calls.length ? (
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                minWidth: 1100,
              }}
            >
              <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <Box component="tr">
                  {[
                    'Sr',
                    'DP ID',
                    'Call ID',
                    'Username',
                    'Status',
                    'Disposition',
                    ...(canShowSuspicious ? ['Personal Connect Intent'] : []),
                    'Played',
                    'Source',
                  ].map((label) => (
                    <Box
                      component="th"
                      key={label}
                      sx={{
                        px: 1.25,
                        py: 1.1,
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.35,
                        textTransform: 'uppercase',
                        color: headFg,
                        bgcolor: dark ? alpha('#1a1a1f', 0.98) : '#fff',
                        borderBottom: `1px solid ${border}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {filteredCalls.length === 0 ? (
                  <Box component="tr">
                    <Box
                      component="td"
                      colSpan={canShowSuspicious ? 9 : 8}
                      sx={{ px: 2, py: 4, textAlign: 'center', color: 'text.secondary' }}
                    >
                      No calls match the selected filters
                    </Box>
                  </Box>
                ) : (
                  filteredCalls.map((call, index) => {
                    const dpId = getGtelDpiId(call);
                    const status = statusText(call);
                    const disposition = dispositionText(call);
                    const statusTone = gtelStatusTone(status);
                    const dispTone = gtelDispositionTone(
                      disposition === '—' ? null : disposition,
                    );
                    const dispPill = DISP_PILL[dispTone];
                    const flagged = isGtelFlaggedCall(call);
                    return (
                      <Box
                        component="tr"
                        key={`${getGtelCallId(call)}-${index}`}
                        sx={{
                          bgcolor: flagged
                            ? alpha(palette.name, dark ? 0.12 : 0.06)
                            : 'transparent',
                          '&:hover td': {
                            bgcolor: alpha(palette.name, dark ? 0.1 : 0.04),
                          },
                        }}
                      >
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            fontWeight: 700,
                            fontSize: 12,
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            <span>{index + 1}</span>
                            {canShowSuspicious && flagged ? (
                              <Tooltip title="View Play / Transcript">
                                <span>
                                  <IconButton
                                    size="small"
                                    aria-label="View call play and transcript"
                                    disabled={
                                      !getGtelCallId(call) ||
                                      getGtelCallId(call) === '—' ||
                                      (Boolean(callAction?.loading) &&
                                        callAction?.callId === getGtelCallId(call))
                                    }
                                    onClick={() => void openCallAction(call)}
                                    sx={{
                                      width: 22,
                                      height: 22,
                                      color: palette.name,
                                      bgcolor: alpha(palette.name, dark ? 0.22 : 0.12),
                                      '&:hover': {
                                        bgcolor: alpha(palette.name, dark ? 0.32 : 0.2),
                                      },
                                    }}
                                  >
                                    {callAction?.loading &&
                                    callAction.callId === getGtelCallId(call) ? (
                                      <CircularProgress size={12} color="inherit" />
                                    ) : (
                                      <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                          </Stack>
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            maxWidth: 200,
                          }}
                        >
                          {dpId && dpId !== '—' ? (
                            <Typography
                              component="button"
                              onClick={() => openUserReport(call)}
                              sx={{
                                m: 0,
                                p: 0,
                                border: 0,
                                background: 'none',
                                cursor: 'pointer',
                                font: 'inherit',
                                fontSize: 12,
                                fontWeight: 700,
                                color: palette.name,
                                textAlign: 'left',
                                wordBreak: 'break-all',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                            >
                              {dpId}
                            </Typography>
                          ) : (
                            <Typography fontSize={12} color="text.secondary">
                              —
                            </Typography>
                          )}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            fontSize: 12,
                            color: 'text.secondary',
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={getGtelCallId(call)}
                        >
                          {getGtelCallId(call)}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {getGtelUsername(call)}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {status !== '—' ? (
                            <Chip
                              size="small"
                              label={status}
                              sx={gtelStatusPillSx(statusTone)}
                            />
                          ) : (
                            '—'
                          )}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                          }}
                        >
                          {disposition !== '—' ? (
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                px: 1,
                                py: 0.3,
                                borderRadius: 999,
                                bgcolor: dark
                                  ? alpha(dispPill.fg, 0.22)
                                  : dispPill.bg,
                                color: dark ? '#e2e8f0' : dispPill.fg,
                                fontSize: 11,
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {disposition}
                            </Box>
                          ) : (
                            <Typography fontSize={12} color="text.secondary">
                              —
                            </Typography>
                          )}
                        </Box>
                        {canShowSuspicious ? (
                          <Box
                            component="td"
                            sx={{
                              px: 1.25,
                              py: 1.1,
                              borderBottom: `1px solid ${border}`,
                              fontSize: 12,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {getGtelPersonalConnectIntent(call)}
                          </Box>
                        ) : null}
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            fontSize: 12,
                            color: 'text.secondary',
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={getGtelPlayedLabel(call)}
                        >
                          {getGtelPlayedLabel(call)}
                        </Box>
                        <Box
                          component="td"
                          sx={{
                            px: 1.25,
                            py: 1.1,
                            borderBottom: `1px solid ${border}`,
                            fontSize: 12,
                            color: 'text.secondary',
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={getGtelCallSource(call)}
                        >
                          {getGtelCallSource(call)}
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>
            </Box>
          ) : null}
        </Box>
      </DialogContent>
    </Dialog>

      <Dialog
        open={Boolean(callAction)}
        onClose={closeCallAction}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
          Call Actions
          <Typography component="span" color="text.secondary" fontWeight={600} sx={{ ml: 0.75 }}>
            — {callAction?.callId || '—'}
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={closeCallAction}
            size="small"
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {callAction?.loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', gap: 1, py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Loading call…
              </Typography>
            </Box>
          ) : null}
          {!callAction?.loading && callAction?.view === 'transcript' ? (
            <Stack spacing={1.5}>
              <Button
                size="small"
                onClick={() =>
                  setCallAction((prev) => (prev ? { ...prev, view: 'actions' } : prev))
                }
                sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
              >
                Back
              </Button>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 12,
                  maxHeight: 360,
                  overflow: 'auto',
                }}
              >
                {pickGtelTranscription(callAction.call) || 'No transcript available'}
              </Box>
            </Stack>
          ) : null}
          {!callAction?.loading && callAction?.view === 'actions' ? (
            <Stack spacing={1.25}>
              <Button
                variant="outlined"
                disabled={!pickGtelRecordingUrl(callAction.call)}
                onClick={() => {
                  const url = pickGtelRecordingUrl(callAction.call);
                  if (!url) {
                    toast.error('Recording not available');
                    return;
                  }
                  setRecordingUrl(url);
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Play
              </Button>
              <Button
                variant="outlined"
                disabled={!pickGtelTranscription(callAction.call)}
                onClick={() => {
                  if (!pickGtelTranscription(callAction.call)) {
                    toast.error('Transcript not available');
                    return;
                  }
                  setCallAction((prev) => (prev ? { ...prev, view: 'transcript' } : prev));
                }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Transcript
              </Button>
              {!pickGtelRecordingUrl(callAction.call) &&
              !pickGtelTranscription(callAction.call) ? (
                <Typography variant="body2" color="text.secondary">
                  No recording or transcript found for this call.
                </Typography>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>

      <RecordingPlayerDialog url={recordingUrl} onClose={() => setRecordingUrl(null)} />
    </>
  );
}
