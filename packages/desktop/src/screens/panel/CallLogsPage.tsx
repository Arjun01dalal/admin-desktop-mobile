import { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Pagination,
} from '@mui/material';
import { todayIST, getStoredUser } from '@/utils/dates';
import { CommonTable } from '@/components/CommonTable';
import { COMMENT_FILTER_OPTIONS } from './callLogs/constants';
import { CallLogsToolbar } from './callLogs/CallLogsToolbar';
import { BotStatusTable } from './callLogs/BotStatusTable';
import { CallLogsFiltersProvider } from './callLogs/FiltersContext';
import {
  CallLogsSelectionProvider,
  useCallLogsSelection,
} from './callLogs/SelectionContext';
import { useCallLogsColumns } from './callLogs/useCallLogsColumns';
import { useCallLogsQuery } from './callLogs/useCallLogsQuery';
import { useCallLogsActions } from './callLogs/useCallLogsActions';
import type { CallLogRow, CallLogsFilterState } from './callLogs/types';
import { MAX_COMMENT_LENGTH } from './callLogs/types';
import { buildCallRecordRows, isCallLogsCaller } from './callLogs/utils';

export function CallLogsPage() {
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    Role_ID?: string;
    extensionId?: string[];
    serverId?: string | number;
    botIds?: Array<string | number> | string;
    botNo?: Array<string | number> | string;
  }>();
  const isCaller = isCallLogsCaller(admin);
  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [campaignId, setCampaignId] = useState('');

  const [mobNo, setMobNo] = useState('');
  const [dpId, setDpId] = useState('');
  const [sid, setSid] = useState('');
  const [state, setState] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedBotId, setSelectedBotId] = useState('All');
  const [commentFilter, setCommentFilter] = useState('All');

  const filters: CallLogsFilterState = {
    startDate,
    endDate,
    page,
    itemsPerPage,
    mobNo,
    dpId,
    sid,
    state,
    selectedStatus,
    selectedBotId,
    commentFilter,
  };

  const { calls, total, botSummary, loading, load, filtersRef } = useCallLogsQuery(
    filters,
    admin,
  );

  return (
    <CallLogsSelectionProvider calls={calls}>
      <CallLogsPageBody
        admin={admin}
        isCaller={isCaller}
        startDate={startDate}
        endDate={endDate}
        page={page}
        itemsPerPage={itemsPerPage}
        campaignId={campaignId}
        mobNo={mobNo}
        dpId={dpId}
        sid={sid}
        state={state}
        selectedStatus={selectedStatus}
        selectedBotId={selectedBotId}
        commentFilter={commentFilter}
        calls={calls}
        total={total}
        botSummary={botSummary}
        loading={loading}
        load={load}
        filtersRef={filtersRef}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        setPage={setPage}
        setItemsPerPage={setItemsPerPage}
        setCampaignId={setCampaignId}
        setMobNo={setMobNo}
        setDpId={setDpId}
        setSid={setSid}
        setState={setState}
        setSelectedStatus={setSelectedStatus}
        setSelectedBotId={setSelectedBotId}
        setCommentFilter={setCommentFilter}
      />
    </CallLogsSelectionProvider>
  );
}

type CallLogsAdmin = {
  _id?: string;
  name?: string;
  Role_ID?: string;
  extensionId?: string[];
  serverId?: string | number;
  botIds?: Array<string | number> | string;
  botNo?: Array<string | number> | string;
} | null;

type BodyProps = {
  admin: CallLogsAdmin;
  isCaller: boolean;
  startDate: string;
  endDate: string;
  page: number;
  itemsPerPage: number;
  campaignId: string;
  mobNo: string;
  dpId: string;
  sid: string;
  state: string;
  selectedStatus: string;
  selectedBotId: string;
  commentFilter: string;
  calls: CallLogRow[];
  total: number;
  botSummary: Record<string, unknown>;
  loading: boolean;
  load: () => Promise<void>;
  filtersRef: { current: CallLogsFilterState };
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setPage: (v: number) => void;
  setItemsPerPage: (v: number) => void;
  setCampaignId: (v: string) => void;
  setMobNo: (v: string) => void;
  setDpId: (v: string) => void;
  setSid: (v: string) => void;
  setState: (v: string) => void;
  setSelectedStatus: (v: string) => void;
  setSelectedBotId: (v: string) => void;
  setCommentFilter: (v: string) => void;
};

function CallLogsPageBody({
  admin,
  isCaller,
  startDate,
  endDate,
  page,
  itemsPerPage,
  campaignId,
  mobNo,
  dpId,
  sid,
  state,
  selectedStatus,
  selectedBotId,
  commentFilter,
  calls,
  total,
  botSummary,
  loading,
  load,
  filtersRef,
  setStartDate,
  setEndDate,
  setPage,
  setItemsPerPage,
  setCampaignId,
  setMobNo,
  setDpId,
  setSid,
  setState,
  setSelectedStatus,
  setSelectedBotId,
  setCommentFilter,
}: BodyProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { selectedRows, clearSelection } = useCallLogsSelection();
  const deferredCalls = useDeferredValue(calls);

  const getSelectedRows = useCallback(() => selectedRows, [selectedRows]);
  const getDateRange = useCallback(
    () => ({
      startDate: filtersRef.current.startDate,
      endDate: filtersRef.current.endDate,
    }),
    [filtersRef],
  );

  const {
    actionLoading,
    summaryData,
    setSummaryData,
    botCall,
    dialerCall,
    connectDialer,
    endCall,
    submitComment,
    pauseBotCalls,
    viewSummary,
    onUpload,
    reinitiateStatus,
  } = useCallLogsActions({
    admin,
    load,
    getSelectedRows,
    clearSelection,
    campaignId,
    getDateRange,
  });

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseBotId, setPauseBotId] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentSid, setCommentSid] = useState('');
  const [commentDropdown, setCommentDropdown] = useState('');
  const [commentText, setCommentText] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);

  const summaryRows = useMemo(
    () => buildCallRecordRows(summaryData),
    [summaryData],
  );

  const onPageReset = useCallback(() => setPage(1), [setPage]);

  const applyFilters = useCallback(() => {
    clearSelection();
    if (page !== 1) {
      setPage(1);
      return;
    }
    void load();
  }, [clearSelection, load, page, setPage]);

  const openComment = useCallback((row: CallLogRow) => {
    setCommentSid(String(row.call_sid || ''));
    setCommentDropdown('');
    setCommentText('');
    setCommentOpen(true);
  }, []);

  const onViewSummary = useCallback(
    async (row: CallLogRow) => {
      const ok = await viewSummary(row);
      if (ok) setSummaryOpen(true);
    },
    [viewSummary],
  );

  const columns = useCallLogsColumns({
    page,
    itemsPerPage,
    onEndCall: endCall,
    onBotCall: botCall,
    onViewSummary,
    onConnectDialer: connectDialer,
    onOpenComment: openComment,
  });

  const filtersValue = useMemo(
    () => ({
      dpId,
      mobNo,
      state,
      sid,
      selectedStatus,
      selectedBotId,
      commentFilter,
      onDpIdChange: setDpId,
      onMobNoChange: setMobNo,
      onStateChange: setState,
      onSidChange: setSid,
      onSelectedStatusChange: setSelectedStatus,
      onSelectedBotIdChange: setSelectedBotId,
      onCommentFilterChange: setCommentFilter,
      onApplyFilters: applyFilters,
      onPageReset,
    }),
    [
      dpId,
      mobNo,
      state,
      sid,
      selectedStatus,
      selectedBotId,
      commentFilter,
      applyFilters,
      onPageReset,
      setDpId,
      setMobNo,
      setState,
      setSid,
      setSelectedStatus,
      setSelectedBotId,
      setCommentFilter,
    ],
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        // Fill panel viewport; bot summary stays compact, logs fill the rest.
        height: 'calc(100vh - 96px)',
        minHeight: 480,
      }}
    >
      <Typography variant="h5" fontWeight={700} mb={1.5} sx={{ flexShrink: 0 }}>
        Call Logs
      </Typography>

      <Box sx={{ flexShrink: 0 }}>
        <CallLogsToolbar
          startDate={startDate}
          endDate={endDate}
          campaignId={campaignId}
          itemsPerPage={itemsPerPage}
          total={total}
          loading={loading}
          actionLoading={actionLoading}
          fileRef={fileRef}
          isCaller={isCaller}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onCampaignChange={setCampaignId}
          onItemsPerPageChange={(value) => {
            setItemsPerPage(value);
            setPage(1);
          }}
          onApply={applyFilters}
          onBotCall={() => void botCall()}
          onDialerCall={() => void dialerCall()}
          onUpload={(file) => {
            void onUpload(file).finally(() => {
              if (fileRef.current) fileRef.current.value = '';
            });
          }}
          onPauseOpen={() => setPauseOpen(true)}
        />
      </Box>

      {!isCaller && (
        <Box sx={{ flexShrink: 0 }}>
          <BotStatusTable
            botSummary={botSummary}
            loading={loading}
            actionLoading={actionLoading}
            onReinitiate={reinitiateStatus}
          />
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          '& > *': { flex: 1, minHeight: 0 },
        }}
      >
        <CallLogsFiltersProvider value={filtersValue}>
          <CommonTable
            columns={columns}
            rows={deferredCalls}
            getRowKey={(row, i) => String(row.call_sid || row._id || i)}
            loading={loading}
            emptyMessage="No call logs"
            stickyHeader
            dense
            virtualize
            maxHeight="100%"
          />
        </CallLogsFiltersProvider>
      </Box>

      <Stack alignItems="center" mt={1.5} mb={0.5} sx={{ flexShrink: 0 }}>
        <Pagination
          count={Math.max(1, Math.ceil(total / itemsPerPage))}
          page={page}
          onChange={(_e, p) => setPage(p)}
          color="primary"
          size="small"
        />
      </Stack>

      <Dialog
        open={!isCaller && pauseOpen}
        onClose={() => setPauseOpen(false)}
      >
        <DialogTitle>Enter Bot ID (For Record Deletion)</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Bot ID (optional)"
            value={pauseBotId}
            onChange={(e) => setPauseBotId(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPauseOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              void pauseBotCalls(pauseBotId).then((ok) => {
                if (ok) {
                  setPauseOpen(false);
                  setPauseBotId('');
                }
              });
            }}
          >
            Pause
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={commentOpen} onClose={() => setCommentOpen(false)}>
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Comment"
              value={commentDropdown}
              onChange={(e) => setCommentDropdown(e.target.value)}
            >
              {COMMENT_FILTER_OPTIONS.filter((c) => c !== 'All').map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            {(commentDropdown === 'other' || !commentDropdown) && (
              <TextField
                label="Custom comment"
                value={commentText}
                onChange={(e) =>
                  setCommentText(e.target.value.slice(0, MAX_COMMENT_LENGTH))
                }
                inputProps={{ maxLength: MAX_COMMENT_LENGTH }}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const value =
                commentDropdown && commentDropdown !== 'other'
                  ? commentDropdown
                  : commentText;
              void submitComment(commentSid, value).then((ok) => {
                if (ok) setCommentOpen(false);
              });
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={summaryOpen}
        onClose={() => {
          setSummaryOpen(false);
          setSummaryData(null);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: '#fff',
            color: '#000',
            borderRadius: 2,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#000', pb: 1 }}>
          Call Record
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#fff' }}>
          {summaryRows.length === 0 ? (
            <Typography color="text.secondary">No summary data available.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table
                size="small"
                sx={{
                  border: '1px solid #9e9e9e',
                  '& td, & th': {
                    border: '1px solid #9e9e9e',
                    color: '#000',
                    verticalAlign: 'top',
                    whiteSpace: 'pre-line',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{ bgcolor: 'orange', fontWeight: 700, color: '#000 !important' }}
                    >
                      Attribute
                    </TableCell>
                    <TableCell
                      sx={{ bgcolor: 'orange', fontWeight: 700, color: '#000 !important' }}
                    >
                      Value
                    </TableCell>
                    <TableCell
                      sx={{ bgcolor: 'orange', fontWeight: 700, color: '#000 !important' }}
                    >
                      Reason / Details
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaryRows.map((item, idx) => (
                    <TableRow
                      key={item.title}
                      sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f5f5f5' }}
                    >
                      <TableCell sx={{ fontWeight: 700, width: '22%' }}>
                        {item.title}
                      </TableCell>
                      <TableCell sx={{ width: '40%' }}>{item.value}</TableCell>
                      <TableCell>{item.reason || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', py: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => {
              setSummaryOpen(false);
              setSummaryData(null);
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
