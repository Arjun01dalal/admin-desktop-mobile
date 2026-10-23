/**
 * Gtel Calls — desktop parity with admin-panel-domains GtelCalls.
 * List: GET /dialer/calls · Dashboard→Calls: GET /dialer/caller-dashboard?includeCalls=true
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import { toast } from 'react-toastify';
import {
  DEFAULT_GTEL_PAGE_SIZE,
  GTEL_PAGE_SIZE_OPTIONS,
  GTEL_STATUS_FILTER_CARDS,
  emptyGtelFilters,
  extractGtelDispositions,
  extractGtelExtensions,
  formatGtelDuration,
  getGtelAppName,
  getGtelCallId,
  getGtelCallerEmpCode,
  getGtelCity,
  getGtelDpiId,
  getGtelLastActivityRaw,
  getGtelPersonalConnect,
  getGtelState,
  getGtelUserEmpCode,
  getGtelUsername,
  gtelCallMatchesStatus,
  gtelStatusTone,
  gtelSummaryCountForStatus,
  maskGtelPhone,
  pickGtelRecordingUrl,
  pickGtelTranscription,
  type GtelCall,
  type GtelFilters,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { RecordingPlayerDialog } from '@/components/RecordingPlayerDialog';
import { TablePanel } from '@/components/TablePanel';
import { fieldSx } from '@/screens/panel/transactions/shared';
import { todayIST } from '@/utils/dates';
import {
  buildGtelCallerDashQuery,
  formatGtelStamp,
  getGtelBalance,
  getGtelCallbackDue,
  getGtelNote,
} from '@/screens/panel/gtel/helpers';
import { GtelHeroActions } from '@/screens/panel/gtel/GtelHeroActions';
import { GtelKpiCards } from '@/screens/panel/gtel/GtelKpiCards';
import { GtelManualCallModals } from '@/screens/panel/gtel/GtelManualCallModals';
import { CampaignCallStartModal } from '@/screens/panel/gtel/CampaignCallStartModal';
import {
  gtelFilterFieldSx,
  gtelIconBtnSx,
  gtelSearchIconBtnSx,
  gtelStatusPillSx,
} from '@/screens/panel/gtel/styles';
import { PanelAccessDenied } from '@/components/PanelAccessDenied';
import { useGtelAuth } from '@/screens/panel/gtel/useGtelAuth';
import { useGtelClickToCall } from '@/screens/panel/gtel/useGtelClickToCall';
import { useGtelCallsListQuery } from '@/screens/panel/gtel/useGtelCallsListQuery';

export function GtelCallsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    canShowMobile,
    canShowGtelCalls,
    canShowGtelDashboard,
    canShowSuspiciousCall,
    canShowRecording,
    loginEmpCode,
    loginExtensionId,
    isCaller,
    shouldLockEmpCode,
  } = useGtelAuth();

  const routeFrom = searchParams.get('from')?.trim() || '';
  const routeTo = searchParams.get('to')?.trim() || '';
  const routeEmp = searchParams.get('empCode')?.trim() || '';
  const hideHeroActions = searchParams.get('hideHeroActions') === '1';

  const today = todayIST();
  const initialEmp = shouldLockEmpCode ? loginEmpCode : routeEmp;
  const [draft, setDraft] = useState<GtelFilters>(() => ({
    ...emptyGtelFilters(routeFrom || today, initialEmp),
    from: routeFrom || today,
    to: routeTo || today,
    empCode: initialEmp,
  }));
  const [applied, setApplied] = useState<GtelFilters>(() => ({
    ...emptyGtelFilters(routeFrom || today, initialEmp),
    from: routeFrom || today,
    to: routeTo || today,
    empCode: initialEmp,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_GTEL_PAGE_SIZE);
  const [dispositions, setDispositions] = useState<string[]>([]);
  const [extensions, setExtensions] = useState<string[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsCallId, setDetailsCallId] = useState('');
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [manualCallOpen, setManualCallOpen] = useState(false);
  const [callStartOpen, setCallStartOpen] = useState(false);

  const listQuery = useGtelCallsListQuery({
    page,
    pageSize,
    filters: applied,
    canShowMobile,
    shouldLockEmpCode,
    loginEmpCode,
    isCaller,
    loginExtensionId,
    hideHeroActions,
    routeEmp,
    routeFrom,
    routeTo,
    enabled: canShowGtelCalls,
  });
  const { rows, total, totalPages, summaryCards, summary: summaryRaw, loading, error } = listQuery;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tasks: Promise<unknown>[] = [secureApi('gtel.dispositions', {})];
      if (!hideHeroActions) {
        tasks.push(secureApi('caller.subadminsByRole', { filter: {} }));
      }
      const results = await Promise.all(tasks);
      if (cancelled) return;
      const dispRes = results[0] as Awaited<ReturnType<typeof secureApi>>;
      setDispositions(dispRes.ok ? extractGtelDispositions(dispRes.data) : []);
      if (!hideHeroActions) {
        const extRes = results[1] as Awaited<ReturnType<typeof secureApi>>;
        setExtensions(extRes.ok ? extractGtelExtensions(extRes.data) : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hideHeroActions]);

  const handleSearch = () => {
    const next = shouldLockEmpCode
      ? { ...draft, empCode: loginEmpCode, status: '' as const }
      : { ...draft, status: '' as const };
    setPage(1);
    setApplied(next);
  };

  const handleReset = () => {
    const next = emptyGtelFilters(todayIST(), shouldLockEmpCode ? loginEmpCode : '');
    setDraft(next);
    setPage(1);
    setApplied(next);
  };

  const handleRefresh = () => {
    void listQuery.refetch();
  };

  const statusCards = useMemo(
    () =>
      GTEL_STATUS_FILTER_CARDS.map((card) => {
        const fromSummary = gtelSummaryCountForStatus(summaryRaw, summaryCards, card.key);
        const fromPage = rows.filter((r) => gtelCallMatchesStatus(r, card.key)).length;
        return { ...card, count: fromSummary > 0 ? fromSummary : fromPage };
      }),
    [rows, summaryCards, summaryRaw],
  );

  const totalCallsCount = useMemo(() => {
    const fromSummary = summaryCards.find((c) =>
      ['total', 'totalcalls', 'totalcount', 'count'].includes(
        c.key.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ),
    );
    return fromSummary ? fromSummary.value : total;
  }, [summaryCards, total]);

  const pagerPages = totalPages;
  const pagerTotal = total;
  const tableRows = rows;

  const openDetails = useCallback(async (call: GtelCall) => {
    const callId = getGtelCallId(call);
    if (!callId || callId === '—') {
      toast.error('Call id missing');
      return;
    }
    setDetailsCallId(callId);
    setDetails(null);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const res = await secureApi('gtel.callDetails', { callId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load call details');
        setDetailsOpen(false);
        return;
      }
      const body =
        res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>) : {};
      const nested =
        body.data && typeof body.data === 'object'
          ? (body.data as Record<string, unknown>)
          : body;
      setDetails(nested);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const openRecording = useCallback(
    (call: GtelCall) => {
      if (!canShowRecording) return;
      const url = pickGtelRecordingUrl(call);
      if (!url) {
        toast.info('No recording for this call');
        return;
      }
      setRecordingUrl(url);
    },
    [canShowRecording],
  );

  const reload = listQuery.refetch;
  const { canShowC2c, startC2c, isCalling } = useGtelClickToCall({
    onSuccess: () => void reload(),
  });

  const openUserReport = useCallback(
    (call: GtelCall) => {
      const id = getGtelDpiId(call);
      if (id === '—') return;
      const name = getGtelUsername(call);
      navigate(
        `/users/report/${encodeURIComponent(id)}/${encodeURIComponent(name === '—' ? id : name)}`,
      );
    },
    [navigate],
  );

  const columns = useMemo<CommonTableColumn<GtelCall>[]>(
    () => [
      {
        id: 'sr',
        label: 'Sr No',
        width: 64,
        align: 'center',
        stickyLeft: true,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'callId',
        label: 'Call ID',
        width: 190,
        stickyLeft: true,
        render: (row) => (
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }} noWrap>
            {getGtelCallId(row)}
          </Typography>
        ),
      },
      {
        id: 'username',
        label: 'Username',
        width: 130,
        stickyLeft: true,
        render: (row) => getGtelUsername(row),
      },
      { id: 'note', label: 'Note', width: 90, render: (row) => getGtelNote(row) },
      {
        id: 'callbackDue',
        label: 'Callback Due At (IST)',
        width: 150,
        render: (row) => {
          const due = getGtelCallbackDue(row);
          return formatGtelStamp(due === '—' ? null : due);
        },
      },
      {
        id: 'balance',
        label: 'Balance',
        width: 90,
        align: 'right',
        render: (row) => getGtelBalance(row),
      },
      {
        id: 'lastActivity',
        label: 'Last Activity',
        width: 150,
        render: (row) => {
          const raw = getGtelLastActivityRaw(row);
          return formatGtelStamp(raw === '—' ? null : raw);
        },
      },
      { id: 'app', label: 'App Name', width: 90, render: (row) => getGtelAppName(row) },
      {
        id: 'dpId',
        label: 'DP ID',
        width: 140,
        render: (row) => {
          const dpi = getGtelDpiId(row);
          if (dpi === '—') return '—';
          return (
            <Button
              size="small"
              variant="text"
              sx={{ textTransform: 'none', p: 0, minWidth: 0, fontSize: 12 }}
              onClick={() => openUserReport(row)}
            >
              {dpi}
            </Button>
          );
        },
      },
      {
        id: 'callerEmp',
        label: 'Caller Emp Code',
        width: 110,
        render: (row) => getGtelCallerEmpCode(row),
      },
      {
        id: 'empCode',
        label: 'Emp Code',
        width: 90,
        render: (row) => getGtelUserEmpCode(row),
      },
      { id: 'state', label: 'State', width: 120, render: (row) => getGtelState(row) },
      { id: 'city', label: 'City', width: 120, render: (row) => getGtelCity(row) },
      {
        id: 'callDate',
        label: 'Call Date (IST)',
        width: 150,
        render: (row) => formatGtelStamp(row.callDate || row.createdOn),
      },
      {
        id: 'clickedAt',
        label: 'Clicked At',
        width: 150,
        render: (row) => formatGtelStamp(row.clickedAt),
      },
      {
        id: 'hangupAt',
        label: 'Hangup Requested At',
        width: 150,
        render: (row) => formatGtelStamp(row.hangupRequestedAt),
      },
      {
        id: 'phone',
        label: 'Phone',
        width: 180,
        render: (row) => (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent="space-between"
            sx={{ width: '100%' }}
          >
            <Typography variant="body2" noWrap>
              {maskGtelPhone(String(row.phoneNumber || ''), canShowMobile)}
            </Typography>
            {canShowC2c && row.phoneNumber ? (
              <Tooltip title="C2C Call">
                <span>
                  <IconButton
                    size="small"
                    aria-label="C2C Call"
                    disabled={isCalling(String(row.phoneNumber || ''))}
                    sx={gtelIconBtnSx}
                    onClick={() => {
                      const dpi = getGtelDpiId(row);
                      void startC2c(
                        String(row.phoneNumber || ''),
                        dpi !== '—' ? dpi : undefined,
                      );
                    }}
                  >
                    {isCalling(String(row.phoneNumber || '')) ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <PhoneInTalkOutlinedIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </Stack>
        ),
      },
      {
        id: 'extension',
        label: 'Extension',
        width: 90,
        render: (row) => String(row.extension || '—'),
      },
      {
        id: 'status',
        label: 'Status',
        width: 120,
        render: (row) => {
          const label = String(row.statusByDialer || row.status || '—');
          if (!label || label === '—') {
            return (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            );
          }
          return (
            <Chip size="small" label={label} sx={gtelStatusPillSx(gtelStatusTone(label))} />
          );
        },
      },
      {
        id: 'disposition',
        label: 'Disposition',
        width: 140,
        render: (row) => String(row.disposition || '—'),
      },
      {
        id: 'dispositionUpdatedAt',
        label: 'Disposition Updated At',
        width: 160,
        render: (row) => formatGtelStamp(row.dispositionUpdatedAt),
      },
      ...(canShowSuspiciousCall
        ? [
            {
              id: 'personalConnect',
              label: 'Personal Connect Categories',
              width: 180,
              render: (row: GtelCall) => getGtelPersonalConnect(row).text,
            } satisfies CommonTableColumn<GtelCall>,
          ]
        : []),
      {
        id: 'duration',
        label: 'Duration',
        width: 90,
        render: (row) => formatGtelDuration(Number(row.duration)),
      },
      {
        id: 'server',
        label: 'Server',
        width: 100,
        render: (row) => String(row.server || '—'),
      },
      {
        id: 'actions',
        label: 'Actions',
        width: 120,
        align: 'center',
        cellSx: { py: 0.5, whiteSpace: 'nowrap' },
        render: (row) => {
          const dpi = getGtelDpiId(row);
          return (
            <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ flexWrap: 'nowrap' }}>
              <Tooltip title="Details">
                <IconButton size="small" sx={gtelIconBtnSx} onClick={() => void openDetails(row)}>
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {canShowRecording ? (
                <Tooltip title="Recording">
                  <IconButton size="small" sx={gtelIconBtnSx} onClick={() => openRecording(row)}>
                    <PlayArrowOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
              {dpi !== '—' ? (
                <Tooltip title="User report">
                  <IconButton size="small" sx={gtelIconBtnSx} onClick={() => openUserReport(row)}>
                    <AssessmentOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          );
        },
      },
    ],
    [
      canShowC2c,
      canShowMobile,
      canShowRecording,
      canShowSuspiciousCall,
      isCalling,
      openDetails,
      openRecording,
      openUserReport,
      page,
      pageSize,
      startC2c,
    ],
  );

  const kpiCards = [
    {
      key: 'total',
      label: 'Total Calls',
      count: totalCallsCount,
    },
    ...statusCards.map((card) => ({
      key: card.key,
      label: card.label,
      count: card.count,
    })),
  ];

  const openManualCall = (mode: 'call' | 'callStart') => {
    if (mode === 'callStart') setCallStartOpen(true);
    else setManualCallOpen(true);
  };

  if (!canShowGtelCalls) {
    return <PanelAccessDenied title="Gtel Calls" />;
  }

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            {hideHeroActions
              ? `Caller Calls${routeEmp || applied.empCode ? ` · ${routeEmp || applied.empCode}` : ''}`
              : 'Gtel Calls'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hideHeroActions
              ? `${routeFrom || applied.from || '—'} → ${routeTo || applied.to || '—'}`
              : 'Search dialer call history by date, extension, phone number, or disposition.'}
          </Typography>
        </Box>
        {!hideHeroActions ? (
          <GtelHeroActions
            showDashboard={canShowGtelDashboard}
            showCall={canShowC2c}
            onDashboard={() =>
              navigate(
                buildGtelCallerDashQuery({
                  from: applied.from || draft.from,
                  to: applied.to || draft.to,
                  empCode: shouldLockEmpCode
                    ? loginEmpCode
                    : applied.empCode || draft.empCode,
                }),
              )
            }
            onCall={() => openManualCall('call')}
            onCallStart={() => openManualCall('callStart')}
          />
        ) : (
          <Button variant="outlined" size="small" onClick={() => navigate(-1)}>
            ‹ Dashboard
          </Button>
        )}
      </Stack>

      <GtelKpiCards cards={kpiCards} />

      <Paper
        variant="outlined"
        sx={{
          px: 1.5,
          py: 1.5,
          borderRadius: 2,
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          borderColor: 'divider',
        }}
      >
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1.25}
            useFlexGap
            alignItems="center"
            flexWrap="nowrap"
            sx={{ overflowX: 'auto', pt: 0.5, pb: 0.25 }}
          >
            <Stack direction="row" spacing={1} useFlexGap alignItems="center" sx={{ flexShrink: 0 }}>
              <TextField
                label="From"
                type="date"
                size="small"
                value={draft.from}
                onChange={(e) => setDraft((p) => ({ ...p, from: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 138 }}
              />
              <TextField
                label="To"
                type="date"
                size="small"
                value={draft.to}
                onChange={(e) => setDraft((p) => ({ ...p, to: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 138 }}
              />
            </Stack>

            {!hideHeroActions ? (
              <TextField
                select
                label="Extension"
                size="small"
                value={draft.extension}
                onChange={(e) => setDraft((p) => ({ ...p, extension: e.target.value }))}
                sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 118 }}
              >
                <MenuItem value="">All</MenuItem>
                {extensions.map((ext) => (
                  <MenuItem key={ext} value={ext}>
                    {ext}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            {canShowMobile && !hideHeroActions ? (
              <TextField
                label="Phone"
                size="small"
                value={draft.phoneNumber}
                onChange={(e) => setDraft((p) => ({ ...p, phoneNumber: e.target.value }))}
                sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 128 }}
              />
            ) : null}
            <TextField
              label="Emp Code"
              size="small"
              value={draft.empCode}
              disabled={shouldLockEmpCode || hideHeroActions}
              onChange={(e) => setDraft((p) => ({ ...p, empCode: e.target.value }))}
              sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 108 }}
            />
            {!hideHeroActions ? (
              <TextField
                select
                label="Disposition"
                size="small"
                value={draft.disposition}
                onChange={(e) => setDraft((p) => ({ ...p, disposition: e.target.value }))}
                sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 140 }}
              >
                <MenuItem value="">All</MenuItem>
                {dispositions.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              select
              label="Per page"
              size="small"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              sx={{ ...fieldSx, ...gtelFilterFieldSx, width: 96 }}
            >
              {GTEL_PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>

            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{
                ml: 'auto',
                pl: 1.25,
                flexShrink: 0,
                borderLeft: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Tooltip title="Search">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Search"
                    sx={gtelSearchIconBtnSx}
                    onClick={handleSearch}
                    disabled={loading}
                  >
                    <SearchOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Reset">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Reset"
                    sx={gtelIconBtnSx}
                    onClick={handleReset}
                    disabled={loading || hideHeroActions}
                  >
                    <RestartAltOutlinedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Refresh list">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Refresh list"
                    sx={gtelIconBtnSx}
                    onClick={handleRefresh}
                    disabled={loading}
                  >
                    <RefreshOutlinedIcon
                      sx={{
                        fontSize: 18,
                        animation: loading ? 'gtelSpin 0.8s linear infinite' : 'none',
                        '@keyframes gtelSpin': {
                          to: { transform: 'rotate(360deg)' },
                        },
                      }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          {error ? (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      <TablePanel
        footer={
          <>
            <Typography variant="caption" color="text.secondary">
              {pagerTotal.toLocaleString('en-IN')} total
            </Typography>
            <Pagination
              color="primary"
              size="small"
              page={page}
              count={pagerPages}
              onChange={(_, next) => setPage(next)}
              disabled={loading}
            />
          </>
        }
      >
        <CommonTable
          columns={columns}
          rows={tableRows}
          getRowKey={(row, index) => String(row.callId || row._id || index)}
          loading={loading}
          emptyMessage={
            hideHeroActions
              ? 'No calls found for this caller in the selected date range.'
              : 'No Gtel calls for the selected filters.'
          }
          dense
          maxHeight="100%"
          minWidth={2600}
        />
      </TablePanel>

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Call details · {detailsCallId || '—'}</DialogTitle>
        <DialogContent dividers>
          {detailsLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : details ? (
            <Stack spacing={0.75}>
              {(
                [
                  ['Status', details.statusByDialer || details.status],
                  ['Disposition', details.disposition],
                  ['Phone', maskGtelPhone(String(details.phoneNumber || ''), canShowMobile)],
                  ['Duration', formatGtelDuration(Number(details.duration))],
                  ['Extension', details.extension],
                  ['Recording', pickGtelRecordingUrl(details as GtelCall) || '—'],
                  ['Transcript', pickGtelTranscription(details as GtelCall) || '—'],
                ] as Array<[string, unknown]>
              ).map(([label, value]) => (
                <Typography key={label} variant="body2">
                  <Box component="span" sx={{ fontWeight: 600, mr: 0.5 }}>
                    {label}:
                  </Box>
                  {value == null || value === '' ? '—' : String(value)}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">No details.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          {canShowRecording && details && pickGtelRecordingUrl(details as GtelCall) ? (
            <Button onClick={() => setRecordingUrl(pickGtelRecordingUrl(details as GtelCall))}>
              Play recording
            </Button>
          ) : null}
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <GtelManualCallModals
        open={manualCallOpen}
        onClose={() => setManualCallOpen(false)}
        onCalled={() => void reload()}
      />
      <CampaignCallStartModal
        open={callStartOpen}
        onClose={() => setCallStartOpen(false)}
        canShowMobile={canShowMobile}
        onCalled={() => void reload()}
      />

      <RecordingPlayerDialog url={recordingUrl} onClose={() => setRecordingUrl(null)} />
    </Box>
  );
}
