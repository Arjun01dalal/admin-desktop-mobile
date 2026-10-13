/**
 * Played today / yesterday — port of admin-panel-domains PlayedTodayYesterday.
 * KPI drilldown from Dashboard StatCards → `/played-today-yesterday`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  ListItemText,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import {
  BREAKDOWN_COUNTS,
  CAMPAIGN_LIST,
  CLIENT_NAMES,
  COUNT_BY_TYPE,
  DEFAULT_PLAYED_PAGE_SIZE,
  INDIA_STATES,
  PLAYED_PAGE_SIZE_OPTIONS,
  PLAY_FILTERS,
  PLAY_SUMMARY_META,
  PLAY_TYPE_LABELS,
  appCodeForName,
  buildPlayedTodayYesterdayPayload,
  emptyPlaySummary,
  isPlayType,
  normalizePlayedTodayYesterday,
  rowDisplayName,
  rowMobile,
  rowUserId,
  type PlaySummary,
  type PlayType,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { hasPermission } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';
import { formatDisplayDate, formatDisplayTime, getStoredUser, todayIST } from '@/utils/dates';
import { useReportQuery, display, maskMobile } from './shared';

type Row = Record<string, unknown>;

type AppliedFilters = {
  date: string;
  empCode: string;
  clientName: string;
  userState: string[];
};

type LocationState = { type?: PlayType; date?: string } | null;

function formatCell(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return `${formatDisplayDate(value)} ${formatDisplayTime(value)}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}-${m}-${y}`;
  }
  return String(value);
}

const filterFieldSx = {
  ...fieldSx,
  width: 160,
  flexShrink: 0,
};

export function PlayedTodayYesterdayPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const admin = getStoredUser<Record<string, unknown>>();
  const canShowMobile = hasPermission('show_mobile');
  const canAddToDialer = hasPermission('add_to_dilaler');

  const [type, setType] = useState<PlayType>(
    isPlayType(state?.type) ? state.type : 'today_not_yesterday',
  );
  const [draftDate, setDraftDate] = useState(state?.date || todayIST());
  const [draftEmpCode, setDraftEmpCode] = useState('');
  const [draftClientName, setDraftClientName] = useState('');
  const [draftStates, setDraftStates] = useState<string[]>([]);
  const [applied, setApplied] = useState<AppliedFilters>({
    date: state?.date || todayIST(),
    empCode: '',
    clientName: '',
    userState: [],
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PLAYED_PAGE_SIZE);
  const [summary, setSummary] = useState<PlaySummary>(emptyPlaySummary);
  const [campaignId, setCampaignId] = useState('');
  const [dialerLoading, setDialerLoading] = useState(false);

  useEffect(() => {
    if (isPlayType(state?.type) && state.type !== type) {
      setType(state.type);
      setPage(1);
    }
    if (state?.date && state.date !== applied.date) {
      setDraftDate(state.date);
      setApplied((prev) => ({ ...prev, date: state.date as string }));
      setPage(1);
    }
    // Sync from dashboard KPI navigation only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.type, state?.date]);

  const { rows, total, totalPages, loading, error, load } = useReportQuery<Row>({
    action: 'dashboard.playedTodayYesterday',
    buildPayload: () =>
      buildPlayedTodayYesterdayPayload({
        type,
        pageNo: page,
        itemsPerPage: pageSize,
        date: applied.date || undefined,
        empCode: applied.empCode,
        clientName: applied.clientName,
        state: applied.userState,
      }),
    unpack: (res) => {
      const parsed = normalizePlayedTodayYesterday(res.data, pageSize);
      setSummary(parsed.summary);
      return {
        rows: parsed.rows,
        total: parsed.total,
        totalPages: parsed.totalPages,
      };
    },
    autoDeps: [type, applied, page, pageSize],
    errorMessage: 'Failed to fetch played users',
    cacheTtlMs: 0,
  });

  const handleSearch = () => {
    setPage(1);
    setApplied({
      date: draftDate,
      empCode: draftEmpCode.trim(),
      clientName: draftClientName,
      userState: [...draftStates],
    });
  };

  const clearDate = () => {
    setDraftDate('');
    setPage(1);
    setApplied((prev) => ({ ...prev, date: '' }));
  };

  const handleAddToDialer = useCallback(async () => {
    if (!campaignId.trim()) {
      toast.error('Campaign should not be empty');
      return;
    }
    if (!rows.length) {
      toast.error('No users to add to dialer');
      return;
    }
    const campaign = CAMPAIGN_LIST.find((c) => c.id.trim() === campaignId.trim());
    setDialerLoading(true);
    try {
      const res = await secureApi('callLogs.externalDialerBatch', {
        campaignId: campaignId.trim(),
        leads: rows.map((r) => ({
          first_name: rowDisplayName(r),
          last_name: '',
          phone_number: rowMobile(r),
          city: String(r.city ?? ''),
          state: String(r.state ?? ''),
          email: String(r.clientName ?? ''),
          comments: String(r.clientName ?? ''),
          province: rowUserId(r),
        })),
        serverId: campaign?.serverId,
      });
      if (!res.ok) {
        toast.error(res.message || 'Dialer call failed');
        return;
      }
      await secureApi('ops.savePerformanceData', {
        subAdminId: admin?._id,
        dialledUserIds: rows.map((r) => rowUserId(r)).filter(Boolean),
        extensionId: campaignId.trim(),
      });
      toast.success(res.message || `Dialer call queued (${rows.length} leads)`);
    } finally {
      setDialerLoading(false);
    }
  }, [admin?._id, campaignId, rows]);

  const columns = useMemo<CommonTableColumn<Row>[]>(
    () => [
      {
        id: 'sr',
        label: 'Sr No',
        width: 70,
        render: (_row, index) => (page - 1) * pageSize + index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        width: 140,
        render: (row) => {
          const id = rowUserId(row);
          const name = rowDisplayName(row) || '—';
          if (!id) return display(name);
          return (
            <Typography
              component="span"
              sx={{ color: 'primary.main', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => navigate(`/user-report/${id}/${encodeURIComponent(name)}`)}
            >
              {name}
            </Typography>
          );
        },
      },
      {
        id: 'mobile',
        label: 'Mobile',
        width: 150,
        render: (row) => maskMobile(rowMobile(row), canShowMobile),
      },
      {
        id: 'state',
        label: 'State',
        width: 120,
        render: (row) => formatCell(row.state),
      },
      {
        id: 'city',
        label: 'City',
        width: 110,
        render: (row) => formatCell(row.city),
      },
      {
        id: 'clientName',
        label: 'App Name',
        width: 110,
        render: (row) => appCodeForName(String(row.clientName ?? '')) || formatCell(row.clientName),
      },
      {
        id: 'empCode',
        label: 'Employee Code',
        width: 120,
        render: (row) => formatCell(row.empCode),
      },
      {
        id: 'createdOn',
        label: 'Created On',
        width: 150,
        render: (row) => formatCell(row.createdOn),
      },
      {
        id: 'activeUser',
        label: 'Last Activity',
        width: 150,
        render: (row) => formatCell(row.activeUser),
      },
      {
        id: 'secondLastActiveDate',
        label: 'Second Last Active',
        width: 150,
        render: (row) => formatCell(row.secondLastActiveDate),
      },
    ],
    [canShowMobile, navigate, page, pageSize],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: 2 }}>
      <CollapsibleFilterPanel
        title={PLAY_TYPE_LABELS[type]}
        summary={`Total: ${total.toLocaleString('en-IN')}`}
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
        defaultOpen
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {PLAY_FILTERS.map(({ type: value, label }) => {
            const active = type === value;
            const count = summary[COUNT_BY_TYPE[value]];
            return (
              <Box
                key={value}
                component="button"
                type="button"
                onClick={() => {
                  if (value === type) return;
                  setType(value);
                  setPage(1);
                }}
                sx={{
                  border: active ? '1px solid #f1a144' : '1px solid',
                  borderColor: active ? '#f1a144' : 'divider',
                  borderRadius: 2,
                  bgcolor: active ? 'rgba(241,161,68,0.12)' : 'background.paper',
                  color: 'text.primary',
                  textAlign: 'left',
                  flex: '1 1 220px',
                  p: 1.25,
                  cursor: 'pointer',
                }}
              >
                <Typography
                  sx={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: active ? '#f1a144' : 'text.secondary',
                    lineHeight: 1.25,
                  }}
                >
                  {label}
                </Typography>
                <Typography sx={{ mt: 0.25, fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                  {count != null && count !== '' ? Number(count).toLocaleString('en-IN') : '—'}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {BREAKDOWN_COUNTS.map(({ key, label }) => (
            <Box
              key={key}
              sx={{
                minWidth: 160,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                bgcolor: 'background.paper',
                px: 1.5,
                py: 1,
              }}
            >
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                {label}
              </Typography>
              <Typography sx={{ mt: 0.25, fontSize: 18, fontWeight: 700 }}>
                {summary[key] != null && summary[key] !== ''
                  ? Number(summary[key]).toLocaleString('en-IN')
                  : '—'}
              </Typography>
            </Box>
          ))}
          <Box
            sx={{
              minWidth: 160,
              border: '1px solid #f1a144',
              borderRadius: 2,
              bgcolor: 'rgba(241,161,68,0.12)',
              px: 1.5,
              py: 1,
            }}
          >
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
              Total
            </Typography>
            <Typography sx={{ mt: 0.25, fontSize: 18, fontWeight: 700 }}>
              {total.toLocaleString('en-IN')}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" flexWrap="wrap" spacing={2} useFlexGap sx={{ mb: 2 }}>
          {PLAY_SUMMARY_META.map(({ key, label }) => (
            <Typography key={key} variant="body2" color="text.secondary">
              {label}:{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                {formatCell(summary[key])}
              </Box>
            </Typography>
          ))}
        </Stack>

        <Stack direction="row" flexWrap="wrap" spacing={1.5} useFlexGap alignItems="flex-end">
          <TextField
            label="Date"
            type="date"
            size="small"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={filterFieldSx}
          />
          <Button onClick={clearDate} disabled={!draftDate} sx={{ ...orangeBtnSx, minWidth: 90 }}>
            Clear
          </Button>
          <TextField
            label="Employee Code"
            size="small"
            value={draftEmpCode}
            onChange={(e) => setDraftEmpCode(e.target.value)}
            sx={filterFieldSx}
          />
          <TextField
            select
            label="App Name"
            size="small"
            value={draftClientName}
            onChange={(e) => setDraftClientName(e.target.value)}
            sx={filterFieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="State"
            size="small"
            value={draftStates}
            onChange={(e) => {
              const value = e.target.value;
              setDraftStates(typeof value === 'string' ? value.split(',') : (value as string[]));
            }}
            SelectProps={{
              multiple: true,
              displayEmpty: true,
              renderValue: (selected) =>
                Array.isArray(selected) && selected.length ? selected.join(', ') : 'All',
            }}
            sx={{ ...filterFieldSx, width: 200 }}
          >
            {INDIA_STATES.map((name) => (
              <MenuItem key={name} value={name}>
                <Checkbox size="small" checked={draftStates.includes(name)} sx={{ p: 0.5, mr: 1 }} />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            sx={{ ...filterFieldSx, width: 130 }}
          >
            {PLAYED_PAGE_SIZE_OPTIONS.map((size) => (
              <MenuItem key={size} value={String(size)}>
                {size}
              </MenuItem>
            ))}
          </TextField>
          <Button onClick={handleSearch} sx={orangeBtnSx}>
            Search
          </Button>
          {canAddToDialer ? (
            <>
              <TextField
                select
                label="Campaign List"
                size="small"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                sx={{ ...filterFieldSx, width: 180 }}
              >
                {CAMPAIGN_LIST.map((c) => (
                  <MenuItem key={c.id} value={c.id.trim()}>
                    {c.id.trim()}
                  </MenuItem>
                ))}
              </TextField>
              {dialerLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Button onClick={() => void handleAddToDialer()} sx={orangeBtnSx}>
                  Add to dialer
                </Button>
              )}
            </>
          ) : null}
        </Stack>
      </CollapsibleFilterPanel>

      {error ? (
        <Typography color="error" sx={{ mb: 1.5 }}>
          {error}
        </Typography>
      ) : null}

      <TablePanel
        footer={
          totalPages > 1 ? (
            <Stack alignItems="center" sx={{ width: '100%' }}>
              <Pagination
                count={totalPages}
                page={page}
                color="secondary"
                onChange={(_, next) => setPage(next)}
              />
            </Stack>
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyMessage="No users found"
          maxHeight="100%"
          getRowKey={(row, index) => rowUserId(row) || rowMobile(row) || index}
        />
      </TablePanel>
    </Box>
  );
}
