/**
 * Played today / yesterday — port of admin-panel-domains PlayedTodayYesterday.
 * KPI drilldown from Dashboard StatCards → `/played-today-yesterday`.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  CircularProgress,
  IconButton,
  Pagination,
  Stack,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  DEFAULT_PLAYED_PAGE_SIZE,
  PLAY_TYPE_LABELS,
  buildPlayedTodayYesterdayPayload,
  emptyPlaySummary,
  isPlayType,
  normalizePlayedTodayYesterday,
  rowMobile,
  rowUserId,
  type PlaySummary,
  type PlayType,
} from '@astro/shared';
import { hasPermission } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { useGtelClickToCall } from '@/screens/panel/gtel/useGtelClickToCall';
import { useReportQuery } from './shared';
import { PlayedTodayYesterdayFilters } from './playedTodayYesterday/PlayedTodayYesterdayFilters';
import { usePlayedTodayYesterdayColumns } from './playedTodayYesterday/usePlayedTodayYesterdayColumns';
import { todayIST } from '@/utils/dates';

type Row = Record<string, unknown>;

type AppliedFilters = {
  date: string;
  empCode: string;
  clientName: string;
  userState: string[];
};

type LocationState = { type?: PlayType; date?: string } | null;

export function PlayedTodayYesterdayPage() {
  const location = useLocation();
  const state = (location.state as LocationState) ?? null;
  const canShowMobile = hasPermission('show_mobile');
  const { canShowC2c, startC2c, isCalling } = useGtelClickToCall();

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

  const columns = usePlayedTodayYesterdayColumns({
    page,
    pageSize,
    canShowMobile,
    canShowC2c,
    isCalling,
    startC2c,
  });

  const title = PLAY_TYPE_LABELS[type];
  const userIds = rows.map((r) => rowUserId(r)).filter(Boolean);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, p: { xs: 1.5, md: 2 } }}>
      <CollapsibleFilterPanel
        title={title}
        summary={`Total: ${total.toLocaleString('en-IN')}`}
        defaultOpen={false}
        sx={{ mb: 2, borderRadius: 3 }}
        contentSx={{ pt: 0.5 }}
        headerActions={
          <IconButton
            size="small"
            aria-label="Refresh"
            disabled={loading}
            onClick={(event) => {
              event.stopPropagation();
              void load();
            }}
            sx={{ color: 'primary.main' }}
          >
            {loading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RefreshIcon fontSize="small" />
            )}
          </IconButton>
        }
      >
        <PlayedTodayYesterdayFilters
          type={type}
          summary={summary}
          total={total}
          loading={loading}
          draftDate={draftDate}
          draftEmpCode={draftEmpCode}
          draftClientName={draftClientName}
          draftStates={draftStates}
          pageSize={pageSize}
          userIds={userIds}
          onTypeChange={(next) => {
            setType(next);
            setPage(1);
          }}
          onDraftDateChange={setDraftDate}
          onDraftEmpCodeChange={setDraftEmpCode}
          onDraftClientNameChange={setDraftClientName}
          onDraftStatesChange={setDraftStates}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          onClearDate={() => {
            setDraftDate('');
            setPage(1);
            setApplied((prev) => ({ ...prev, date: '' }));
          }}
          onSearch={() => {
            setPage(1);
            setApplied({
              date: draftDate,
              empCode: draftEmpCode.trim(),
              clientName: draftClientName,
              userState: [...draftStates],
            });
          }}
        />
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
