import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  Pagination,
} from '@mui/material';
import {
  formatDisplayDate,
  formatDisplayTime,
  todayIST,
  getStoredUser,
} from '@/utils/dates';
import { getRoleId } from '@/auth/permissions';
import { secureApi } from '@/api/secureClient';
import { CommonTable } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CLIENT_NAMES } from '@/constants/clientNames';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';
import { campaignsForLoginUser } from './newRegisters/campaignList';
import { NewRegistersToolbar } from './newRegisters/NewRegistersToolbar';
import { NewRegistersFiltersProvider } from './newRegisters/FiltersContext';
import {
  registrationCallLogs,
  registrationComments,
  useNewRegistersColumns,
} from './newRegisters/useNewRegistersColumns';
import { useNewRegistersQuery } from './newRegisters/useNewRegistersQuery';
import { useNewRegistersActions } from './newRegisters/useNewRegistersActions';
import type {
  ActiveStatusFilter,
  NewRegistrationFilter,
  RegistrationCallLog,
  RegistrationComment,
  UserRow,
} from './newRegisters/types';

function isNewRegistersCaller(roleId?: string): boolean {
  const id = String(roleId || getRoleId() || '');
  if (id && CALLER_ROLE_IDS.has(id)) return true;
  const name = String(localStorage.getItem('role') || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return name === 'caller' || name === 'caller_new';
}

export function NewRegistersPage() {
  const admin = getStoredUser<{
    _id?: string;
    name?: string;
    empCode?: string;
    mobile?: string;
    Role_ID?: string;
    extensionId?: string[];
    serverId?: string | number;
    clientName?: string | string[];
    allotedApps?: string | string[];
    accessibleStates?: string[];
  }>();
  const isCaller = isNewRegistersCaller(admin?.Role_ID);
  const campaignOptions = useMemo(
    () => campaignsForLoginUser(admin as Record<string, unknown> | null, { assignedOnly: isCaller }),
    [admin, isCaller],
  );

  const appOptions = useMemo(() => {
    const allotted = admin?.clientName || admin?.allotedApps;
    if (Array.isArray(allotted) && allotted.length) return allotted.map(String);
    if (typeof allotted === 'string' && allotted) return [allotted];
    return [...CLIENT_NAMES];
  }, [admin?.clientName, admin?.allotedApps]);

  const [startDate, setStartDate] = useState(todayIST);
  const [endDate, setEndDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [campaignName, setCampaignName] = useState(() =>
    isCaller && campaignOptions.length === 1 ? campaignOptions[0].id.trim() : '',
  );
  const [activeStatus, setActiveStatus] = useState<ActiveStatusFilter>('All');
  const [newRegistration, setNewRegistration] =
    useState<NewRegistrationFilter>('True');
  const [otherState, setOtherState] = useState(false);
  const [nonPerforming, setNonPerforming] = useState(false);
  const [appVersions, setAppVersions] = useState<Record<string, string>>({});

  const [commentOpen, setCommentOpen] = useState(false);
  const [commentUserId, setCommentUserId] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [viewCommentsOpen, setViewCommentsOpen] = useState(false);
  const [viewComments, setViewComments] = useState<RegistrationComment[]>([]);
  const [viewCommentsName, setViewCommentsName] = useState('');
  const [viewLogsOpen, setViewLogsOpen] = useState(false);
  const [viewLogs, setViewLogs] = useState<RegistrationCallLog[]>([]);
  const [viewLogsName, setViewLogsName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await secureApi<{ clientName?: string; version?: string }[]>(
        'users.appVersions',
        {},
      );
      if (cancelled || !res.ok) return;
      const list = Array.isArray(res.data) ? res.data : [];
      const map: Record<string, string> = {};
      for (const item of list) {
        if (item?.clientName) map[item.clientName] = String(item.version ?? '');
      }
      setAppVersions(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [searchName, setSearchName] = useState('');
  const [searchDpId, setSearchDpId] = useState('');
  const [userComesFrom, setUserComesFrom] = useState('');
  const [searchBalance, setSearchBalance] = useState('');
  const [showEmptyRecord, setShowEmptyRecord] = useState(false);
  const [appClientName, setAppClientName] = useState('');
  const [searchPlayInStatus, setSearchPlayInStatus] = useState('');
  const [searchAccNo, setSearchAccNo] = useState('');
  const [searchAadharNo, setSearchAadharNo] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [selectedState, setSelectedState] = useState<string[]>([]);
  const [searchReferred, setSearchReferred] = useState('');
  const [searchReferralCodeUser, setSearchReferralCodeUser] = useState('');
  const [searchMobile, setSearchMobile] = useState('');

  const columnFilters = useMemo(
    () => ({
      searchName,
      searchDpId,
      userComesFrom,
      searchBalance,
      appClientName,
      searchPlayInStatus,
      searchAccNo,
      searchAadharNo,
      searchEmail,
      searchCity,
      selectedState,
      searchReferred,
      searchReferralCodeUser,
      searchMobile,
      showEmptyRecord,
      activeStatus,
      newRegistration,
      otherState,
      nonPerforming,
    }),
    [
      searchName,
      searchDpId,
      userComesFrom,
      searchBalance,
      appClientName,
      searchPlayInStatus,
      searchAccNo,
      searchAadharNo,
      searchEmail,
      searchCity,
      selectedState,
      searchReferred,
      searchReferralCodeUser,
      searchMobile,
      showEmptyRecord,
      activeStatus,
      newRegistration,
      otherState,
      nonPerforming,
    ],
  );

  const { rows, total, loading, load } = useNewRegistersQuery(
    admin,
    page,
    itemsPerPage,
    startDate,
    endDate,
    columnFilters,
  );
  const deferredRows = useDeferredValue(rows);

  const { dialerLoading, addComment, addToDialer, block } =
    useNewRegistersActions(admin, load, page);

  const applyFilters = useCallback(() => {
    setPage(1);
    void load(1);
  }, [load]);

  const openAddComment = useCallback((row: UserRow) => {
    setCommentUserId(String(row._id || ''));
    setCommentInput('');
    setCommentOpen(true);
  }, []);

  const openViewComments = useCallback((row: UserRow) => {
    setViewComments(registrationComments(row));
    setViewCommentsName(String(row.name || ''));
    setViewCommentsOpen(true);
  }, []);

  const openViewCallLogs = useCallback((row: UserRow) => {
    setViewLogs(registrationCallLogs(row));
    setViewLogsName(String(row.name || ''));
    setViewLogsOpen(true);
  }, []);

  const columns = useNewRegistersColumns({
    page,
    itemsPerPage,
    onBlock: (row) => void block.start(row),
    isCaller,
    appVersions,
    onAddComment: openAddComment,
    onViewComments: openViewComments,
    onViewCallLogs: openViewCallLogs,
    onCallSuccess: () => void load(page),
  });

  const filtersValue = useMemo(
    () => ({
      searchName,
      setSearchName,
      searchDpId,
      setSearchDpId,
      userComesFrom,
      setUserComesFrom,
      searchBalance,
      setSearchBalance,
      showEmptyRecord,
      setShowEmptyRecord,
      appClientName,
      setAppClientName,
      searchPlayInStatus,
      setSearchPlayInStatus,
      searchAccNo,
      setSearchAccNo,
      searchAadharNo,
      setSearchAadharNo,
      searchEmail,
      setSearchEmail,
      searchCity,
      setSearchCity,
      selectedState,
      setSelectedState,
      searchReferred,
      setSearchReferred,
      searchReferralCodeUser,
      setSearchReferralCodeUser,
      searchMobile,
      setSearchMobile,
      appOptions,
      applyFilters,
    }),
    [
      searchName,
      searchDpId,
      userComesFrom,
      searchBalance,
      showEmptyRecord,
      appClientName,
      searchPlayInStatus,
      searchAccNo,
      searchAadharNo,
      searchEmail,
      searchCity,
      selectedState,
      searchReferred,
      searchReferralCodeUser,
      searchMobile,
      appOptions,
      applyFilters,
    ],
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1.5}
        sx={{ mb: 1, flexShrink: 0 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NewRegistersToolbar
            title="New Registration"
            startDate={startDate}
            endDate={endDate}
            itemsPerPage={itemsPerPage}
            campaignName={campaignName}
            campaigns={campaignOptions}
            activeStatus={activeStatus}
            newRegistration={newRegistration}
            otherState={otherState}
            nonPerforming={nonPerforming}
            total={total}
            loading={loading}
            dialerLoading={dialerLoading}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onItemsPerPageChange={(value) => {
              setItemsPerPage(value);
              setPage(1);
            }}
            onCampaignNameChange={setCampaignName}
            onActiveStatusChange={(v) => {
              setActiveStatus(v);
              setPage(1);
            }}
            onNewRegistrationChange={(v) => {
              setNewRegistration(v);
              setPage(1);
            }}
            onOtherStateChange={(v) => {
              setOtherState(v);
              if (v) setSelectedState([]);
              setPage(1);
            }}
            onNonPerformingChange={(v) => {
              setNonPerforming(v);
              setPage(1);
            }}
            onApply={applyFilters}
            onRefresh={applyFilters}
            onAddToDialer={() => {
              void addToDialer(campaignName, rows).then((ok) => {
                if (ok) setCampaignName('');
              });
            }}
          />
        </Box>
      </Stack>

      <TablePanel
        footerJustify="center"
        footer={
          <Pagination
            count={Math.max(1, Math.ceil(total / itemsPerPage))}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
          />
        }
      >
        <NewRegistersFiltersProvider value={filtersValue}>
          <CommonTable
            columns={columns}
            rows={deferredRows}
            getRowKey={(row, i) => String(row._id || i)}
            loading={loading}
            emptyMessage="No users"
            stickyHeader
            minWidth={3600}
            dense
            virtualize
            maxHeight="100%"
            paper
          />
        </NewRegistersFiltersProvider>
      </TablePanel>

      <Dialog open={Boolean(block.target)} onClose={block.close}>
        <DialogTitle>
          {block.nextStatus ? 'Block' : 'Unblock'} user
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, mt: 0.5 }}>
            {block.otpSending
              ? 'Sending OTP to SuperAdmin…'
              : 'Enter OTP and remark to continue.'}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            required
            label="Please enter OTP"
            value={block.otp}
            onChange={(e) =>
              block.setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            inputMode="numeric"
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            label="Please enter remark"
            value={block.remark}
            onChange={(e) =>
              block.setRemark(e.target.value.slice(0, block.maxRemark))
            }
            inputProps={{ maxLength: block.maxRemark }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={block.close}>Cancel</Button>
          <Button
            variant="outlined"
            disabled={block.otpSending}
            onClick={() => void block.resendOtp()}
          >
            Resend OTP
          </Button>
          <Button
            variant="contained"
            disabled={
              block.actionBusyId === block.target?._id || block.otpSending
            }
            onClick={() => void block.confirm()}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
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
            label="Comment"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              void addComment(commentUserId, commentInput).then((ok) => {
                if (ok) {
                  setCommentOpen(false);
                  setCommentInput('');
                  setCommentUserId('');
                }
              });
            }}
          >
            Submit
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
            <Box
              sx={{
                textAlign: 'center',
                color: 'text.secondary',
                py: 3.5,
                fontSize: 14,
              }}
            >
              No Comments
            </Box>
          ) : (
            <Stack spacing={1.25} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
              {viewComments.map((c, i) => (
                <Box
                  key={i}
                  sx={{
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: '12px 14px',
                  }}
                >
                  <Typography
                    sx={{
                      m: 0,
                      mb: 1,
                      color: 'text.primary',
                      fontSize: 14,
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {c.comment || '-'}
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap="8px 14px">
                    <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {c.who?.userName || '-'}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                      {formatDisplayDate(c.createdOn || c.createdAt || c.date) || '-'}{' '}
                      {formatDisplayTime(c.createdOn || c.createdAt || c.date) || ''}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewCommentsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={viewLogsOpen}
        onClose={() => setViewLogsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Call Logs{viewLogsName ? ` — ${viewLogsName}` : ''}
        </DialogTitle>
        <DialogContent>
          {viewLogs.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                color: 'text.secondary',
                py: 3.5,
                fontSize: 14,
              }}
            >
              No Call Logs
            </Box>
          ) : (
            <Stack spacing={1.25} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
              {viewLogs.map((log, i) => (
                <Box
                  key={i}
                  sx={{
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: '12px 14px',
                  }}
                >
                  <Typography
                    sx={{
                      m: 0,
                      mb: 1,
                      color: 'text.primary',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {log.who?.userName || '-'}
                    {log.status ? ` · ${log.status}` : ''}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: 12 }}>
                    {formatDisplayDate(log.createdOn || log.createdAt || log.date) ||
                      '-'}{' '}
                    {formatDisplayTime(log.createdOn || log.createdAt || log.date) ||
                      ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewLogsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
