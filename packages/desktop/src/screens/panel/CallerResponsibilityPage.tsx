import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import TuneIcon from '@mui/icons-material/Tune';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { todayIST, getStoredUser } from '@/utils/dates';
import { CALLER_HEAD_ROLE_IDS, OFFICE_LOCATIONS, type CallerRow } from './callerResponsibility/constants';
import { CsvUploadModal } from './callerResponsibility/CsvUploadModal';
import {
  canSeeTotalDeposit,
  displayName,
  ecs,
  filterCallerRows,
  minutesForDate,
  pnl,
  roleFlags,
  roundAmt,
  cellText,
  type StoredCallerUser,
} from './callerResponsibility/utils';

const viewIconBtnSx = {
  p: 0.45,
  color: '#ff9f0a',
  border: '1px solid rgba(255,159,10,0.45)',
  borderRadius: 1,
  bgcolor: 'rgba(255,159,10,0.08)',
  '&:hover': {
    bgcolor: 'rgba(255,159,10,0.18)',
    borderColor: '#ff9f0a',
  },
} as const;

/** Header labels split with `\n`: keep each line intact so it stays 2 lines. */
const twoLineHeadSx = { whiteSpace: 'nowrap', lineHeight: 1.3, py: 0.9 } as const;

export function CallerResponsibilityPage() {
  const navigate = useNavigate();
  const user = getStoredUser<StoredCallerUser>();
  const { isCaller, isCallerHead, isCallerOrHead, isFullAllotment } = roleFlags(
    user?.Role_ID,
  );
  const showTotalDeposit = canSeeTotalDeposit(user);
  const showCallerHead = !isCallerOrHead || isFullAllotment;
  const showLocation = !isCaller || isFullAllotment;

  const [startDate, setStartDate] = useState(
    () =>
      isCaller
        ? todayIST()
        : localStorage.getItem('callerResponsibilityStartDate') || todayIST(),
  );
  const [endDate, setEndDate] = useState(
    () =>
      isCaller
        ? todayIST()
        : localStorage.getItem('callerResponsibilityEndDate') || todayIST(),
  );
  const [callerHead, setCallerHead] = useState('');
  const [office, setOffice] = useState('');
  const [heads, setHeads] = useState<CallerRow[]>([]);
  const [callerRows, setCallerRows] = useState<CallerRow[]>([]);
  const [locationRows, setLocationRows] = useState<CallerRow[]>([]);
  const [payload, setPayload] = useState<CallerRow>({});
  const [botUsers, setBotUsers] = useState<CallerRow[]>([]);
  const [botCount, setBotCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('callerResponsibilityStartDate', startDate);
    localStorage.setItem('callerResponsibilityEndDate', endDate);
  }, [startDate, endDate]);

  const loadHeads = useCallback(async () => {
    const res = await secureApi<{
      byRole?: Array<{ roleId?: string; subAdmins?: CallerRow[] }>;
    }>('caller.subadminsByRole', { filter: {} });
    if (!res.ok) return;
    const merged = (res.data?.byRole ?? [])
      .filter((r) => CALLER_HEAD_ROLE_IDS.has(String(r.roleId)))
      .flatMap((r) => r.subAdmins ?? [])
      .filter((v) => !v.block);
    setHeads(merged);
  }, []);

  const loadMain = useCallback(async () => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        startDate,
        endDate,
        callerHead: isCallerHead ? user?.name || '' : callerHead,
      };
      if (office) body.officeLocation = office;

      const [depRes, botRes] = await Promise.all([
        secureApi<CallerRow>('caller.depositByEmpcodeOffice', body),
        secureApi<{ users?: CallerRow[]; total?: number }>(
          'caller.activeUsersFromCalls',
          { startDate, endDate },
        ),
      ]);

      if (!depRes.ok) {
        toast.error(depRes.message || 'Failed to load caller data');
        setCallerRows([]);
        setLocationRows([]);
        setPayload({});
      } else {
        const data = (depRes.data || {}) as CallerRow;
        const byEmp = Array.isArray(data.byEmpCode)
          ? (data.byEmpCode as CallerRow[])
          : [];
        setCallerRows(
          filterCallerRows(byEmp, user, isCaller, showTotalDeposit),
        );
        setLocationRows(
          Array.isArray(data.byOfficeLocation)
            ? (data.byOfficeLocation as CallerRow[])
            : [],
        );
        setPayload(data);
      }

      if (botRes.ok) {
        setBotUsers(botRes.data?.users || []);
        setBotCount(Number(botRes.data?.total ?? botRes.data?.users?.length ?? 0));
      }
    } finally {
      setLoading(false);
    }
  }, [
    startDate,
    endDate,
    callerHead,
    office,
    isCallerHead,
    isCaller,
    showTotalDeposit,
    user,
  ]);

  useEffect(() => {
    void loadHeads();
    void loadMain();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const displayedBotCount = isCaller ? 0 : botCount;

  const openBotUsers = useCallback(() => {
    if (isCaller || displayedBotCount <= 0) return;
    navigate('/caller-responsibility/bot-users', {
      state: { activeBotUsers: botUsers, startDate, endDate },
    });
  }, [isCaller, displayedBotCount, navigate, botUsers, startDate, endDate]);

  const summary = (payload.summary || {}) as CallerRow;
  const summaryRow = useMemo(
    () => [
      {
        totalEmpCodes: isCallerOrHead ? 0 : summary.totalEmpCodes,
        totalOfficeLocations: isCallerOrHead ? 0 : summary.totalOfficeLocations,
        totalTransactions: isCallerOrHead ? 0 : summary.totalTransactions,
        totalActiveUsers: isCallerOrHead ? 0 : payload.totalActiveUsers,
        totalTransactionCount: isCallerOrHead
          ? 0
          : roundAmt(payload.totalDeposit),
        activeByBot: displayedBotCount,
      },
    ],
    [isCallerOrHead, summary, payload, displayedBotCount],
  );

  const summaryColumns = useMemo<CommonTableColumn<(typeof summaryRow)[0]>[]>(
    () => {
      const cols: CommonTableColumn<(typeof summaryRow)[0]>[] = [
        {
          id: 'emp',
          label: "Total Employee (Caller's)",
          render: (r) => cellText(r.totalEmpCodes),
        },
      ];
      if (showLocation) {
        cols.push({
          id: 'loc',
          label: 'Total Office Location',
          render: (r) => cellText(r.totalOfficeLocations),
        });
      }
      cols.push(
        {
          id: 'txn',
          label: 'Total Transaction',
          render: (r) => cellText(r.totalTransactions),
        },
        {
          id: 'active',
          label: 'Total Active Customers',
          render: (r) => cellText(r.totalActiveUsers),
        },
        {
          id: 'txnCount',
          label: 'Total Transaction Count',
          render: (r) => cellText(r.totalTransactionCount),
        },
        {
          id: 'bot',
          label: 'Active Customers By Bot',
          render: (r) => (
            <Box
              component="span"
              onClick={openBotUsers}
              sx={{
                cursor:
                  !isCaller && displayedBotCount > 0 ? 'pointer' : 'default',
              }}
            >
              {r.activeByBot}
            </Box>
          ),
        },
      );
      return cols;
    },
    [isCaller, displayedBotCount, openBotUsers, showLocation],
  );

  const locationColumns = useMemo<CommonTableColumn<CallerRow>[]>(
    () => [
      {
        id: 'office',
        label: 'Office Location',
        render: (r) => String(r.officeLocation ?? '-'),
      },
      {
        id: 'txn',
        label: 'Transaction Count',
        render: (r) => cellText(r.transactionCount),
      },
      {
        id: 'active',
        label: 'Active Customers',
        render: (r) => cellText(r.activeUserCount),
      },
      {
        id: 'deposit',
        label: 'Total Deposit',
        render: (r) => roundAmt(r.totalDeposit),
      },
      {
        id: 'wApp',
        label: 'Total Refund\nApproved Amount',
        headSx: twoLineHeadSx,
        render: (r) => roundAmt(r.withdrawalApprovedAmount),
      },
      {
        id: 'pnl',
        label: 'PNL',
        render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount),
      },
      {
        id: 'wPend',
        label: 'Total Refund\nPending Amount',
        headSx: twoLineHeadSx,
        render: (r) => roundAmt(r.withdrawalPendingAmount),
      },
      {
        id: 'wAppC',
        label: 'Refund Approved\nCount',
        headSx: twoLineHeadSx,
        render: (r) => cellText(r.withdrawalApprovedCount),
      },
      {
        id: 'wPendC',
        label: 'Refund Pending\nCount',
        headSx: twoLineHeadSx,
        render: (r) => cellText(r.withdrawalPendingCount),
      },
    ],
    [],
  );

  const callerColumns = useMemo<CommonTableColumn<CallerRow>[]>(() => {
    const cols: CommonTableColumn<CallerRow>[] = [
      { id: '#', label: 'SR. No', width: 56, render: (_r, i) => i + 1 },
      {
        id: 'pseudo',
        label: 'Pseudo Name',
        render: (r) => String(r.subAdminName ?? 'Company'),
      },
    ];

    // Callers must not see employee real names — Pseudo Name only.
    if (!isCaller) {
      cols.push({
        id: 'real',
        label: 'Real Name',
        render: (r) => displayName(r.realName),
      });
    }

    if (showLocation) {
      cols.push({
        id: 'office',
        label: 'Office Location',
        render: (r) => String(r.officeLocation ?? '-'),
      });
    }

    cols.push(
      {
        id: 'deposit',
        label: 'Total Deposit',
        render: (r) => roundAmt(r.totalDeposit),
      },
      {
        id: 'wAppAmt',
        label: 'Total Refund\nApproved Amount',
        headSx: twoLineHeadSx,
        render: (r) => roundAmt(r.withdrawalApprovedAmount),
      },
      {
        id: 'pnl',
        label: 'PNL',
        render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount),
      },
      {
        id: 'wPendAmt',
        label: 'Total Refund\nPending Amount',
        headSx: twoLineHeadSx,
        render: (r) => roundAmt(r.withdrawalPendingAmount),
      },
      {
        id: 'wAppCnt',
        label: 'Refund Approved\nCount',
        headSx: twoLineHeadSx,
        render: (r) => cellText(r.withdrawalApprovedCount),
      },
      {
        id: 'wPendCnt',
        label: 'Refund Pending\nCount',
        headSx: twoLineHeadSx,
        render: (r) => cellText(r.withdrawalPendingCount),
      },
      {
        id: 'activeCust',
        label: 'Active Customers',
        cellSx: { whiteSpace: 'nowrap', minWidth: 120 },
        render: (r) => (
          <Stack spacing={0.5} alignItems="center">
            <span>{cellText(r.transactionCount)}</span>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="nowrap">
              <Tooltip title="View Deposit">
                <IconButton
                  size="small"
                  aria-label="View Deposit"
                  sx={viewIconBtnSx}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate('/caller-responsibility/deposit-list', {
                      state: { list: r },
                    });
                  }}
                >
                  <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="View Refund List">
                <IconButton
                  size="small"
                  aria-label="View Refund List"
                  sx={viewIconBtnSx}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate('/caller-responsibility/deposit-list', {
                      state: {
                        list: r,
                        type: 'withdrawal',
                        empCode: r.empCode,
                        startDate,
                        endDate,
                      },
                    });
                  }}
                >
                  <CurrencyExchangeOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="View Unique Pending">
                <IconButton
                  size="small"
                  aria-label="View Unique Pending"
                  sx={viewIconBtnSx}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate('/caller-responsibility/deposit-list', {
                      state: {
                        list: r,
                        type: 'uniquePending',
                        empCode: r.empCode,
                        startDate,
                        endDate,
                      },
                    });
                  }}
                >
                  <PendingActionsOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        ),
      },
    );

    cols.push(
      {
        id: 'ex',
        label: 'E',
        render: (r) => cellText(r.activeUserCount),
      },
      {
        id: 'casino',
        label: 'C',
        render: (r) => cellText(ecs(r).E),
      },
      {
        id: 'matka',
        label: 'S',
        render: (r) => cellText(ecs(r).C),
      },
      {
        id: 'daily',
        label: 'Activity Time',
        cellSx: { minWidth: 130 },
        render: (r) => (
          <Stack spacing={0.2} alignItems="flex-start">
            <Typography variant="caption" sx={{ color: '#69f0ae', whiteSpace: 'nowrap' }}>
              Active: {minutesForDate(r.activeTime, startDate)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#ff8a80', whiteSpace: 'nowrap' }}>
              Inactive: {minutesForDate(r.inactiveTime, startDate)}
            </Typography>
          </Stack>
        ),
      },
    );

    if (!isCaller) {
      cols.push({ id: 'status', label: 'Status', render: (r) => cellText(r.time) });
    }

    cols.push({
      id: 'emp',
      label: 'Emp Code',
      render: (r) => String(r.empCode ?? '-'),
    });

    if (!isCaller) {
      cols.push({
        id: 'head',
        label: 'Caller Head',
        render: (r) => displayName(r.callerHead),
      });
    }

    return cols;
  }, [navigate, startDate, endDate, isCaller, showLocation]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          mb: 1.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            onClick={() => setFiltersOpen((open) => !open)}
            sx={{
              minHeight: 44,
              px: 1.5,
              py: 0.75,
              cursor: 'pointer',
              userSelect: 'none',
              borderBottom: filtersOpen ? '1px solid' : 'none',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              sx={{ minWidth: 0 }}
            >
              <TuneIcon sx={{ color: '#ff9f0a', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={800}>
                Caller Responsibility
              </Typography>
              {!filtersOpen ? (
                <>
                  <Chip
                    size="small"
                    label={`${startDate} → ${endDate}`}
                    variant="outlined"
                    sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 24 }}
                  />
                  <Chip
                    size="small"
                    label={`Bots: ${displayedBotCount}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openBotUsers();
                    }}
                    sx={{
                      height: 24,
                      fontWeight: 700,
                      color: '#c77a18',
                      bgcolor: 'rgba(255,159,10,0.12)',
                      cursor: displayedBotCount > 0 ? 'pointer' : 'default',
                    }}
                  />
                </>
              ) : null}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Refresh"
                    disabled={loading}
                    onClick={(event) => {
                      event.stopPropagation();
                      void loadMain();
                    }}
                    sx={{
                      color: '#e8e8ea',
                      border: '1px solid',
                      borderColor: 'rgba(255,255,255,0.28)',
                      borderRadius: '8px',
                      width: 34,
                      height: 34,
                      '&:hover': {
                        borderColor: '#ff9f0a',
                        bgcolor: 'rgba(255,159,10,0.08)',
                      },
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <RefreshIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
              size="small"
              aria-label={filtersOpen ? 'Collapse filters' : 'Expand filters'}
              onClick={(event) => {
                event.stopPropagation();
                setFiltersOpen((open) => !open);
              }}
            >
              {filtersOpen ? (
                <ExpandLessIcon fontSize="small" />
              ) : (
                <ExpandMoreIcon fontSize="small" />
              )}
            </IconButton>
            </Stack>
          </Stack>

          <Collapse in={filtersOpen} timeout="auto" unmountOnExit>
            <Box sx={{ p: 1.5 }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ minWidth: 0, maxWidth: '100%' }}
              >
                <TextField
                  type="date"
                  label="From Date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  sx={{ width: 170, flexShrink: 0 }}
                />
                <TextField
                  type="date"
                  label="To Date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  sx={{ width: 170, flexShrink: 0 }}
                />
                {showCallerHead && (
                  <TextField
                    select
                    label="Caller Head"
                    size="small"
                    value={callerHead}
                    onChange={(e) => setCallerHead(e.target.value)}
                    sx={{ width: 200, flexShrink: 0 }}
                  >
                    <MenuItem value="">
                      <em>Select</em>
                    </MenuItem>
                    {heads.map((h) => (
                      <MenuItem key={String(h._id || h.name)} value={String(h.name || '')}>
                        {String(h.name || h.empCode || '-')}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {showLocation && (
                  <TextField
                    select
                    label="Location"
                    size="small"
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    sx={{ width: 180, flexShrink: 0 }}
                  >
                    <MenuItem value="">
                      <em>Select</em>
                    </MenuItem>
                    {OFFICE_LOCATIONS.map((o) => (
                      <MenuItem key={o} value={o}>
                        {o}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Button
                  variant="contained"
                  onClick={() => void loadMain()}
                  disabled={loading}
                  sx={{ flexShrink: 0, fontWeight: 700 }}
                >
                  Apply
                </Button>
                {!isCaller && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => setValidateOpen(true)}
                    sx={{ flexShrink: 0, fontWeight: 700 }}
                  >
                    Validate Data
                  </Button>
                )}
                {loading && <CircularProgress size={22} />}
              </Stack>

              <Typography
                variant="body2"
                mt={1.25}
                onClick={openBotUsers}
                sx={{
                  cursor: displayedBotCount > 0 ? 'pointer' : 'default',
                  width: 'fit-content',
                }}
              >
                <strong>Active Customer (By Bots):-</strong> {displayedBotCount}
              </Typography>
            </Box>
          </Collapse>
        </Box>

      {showTotalDeposit && (
        <Box mb={3} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} mb={1} sx={{ fontSize: '0.95rem' }}>
            Summary
          </Typography>
          <CommonTable
            columns={summaryColumns}
            rows={summaryRow}
            getRowKey={() => 'summary'}
            loading={loading}
            emptyMessage="No summary"
          />
        </Box>
      )}

      {showTotalDeposit && showLocation && (
        <Box mb={3} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} mb={1} sx={{ fontSize: '0.95rem' }}>
            By Office Location
          </Typography>
          <CommonTable
            columns={locationColumns}
            rows={locationRows}
            getRowKey={(r, i) => String(r.officeLocation || i)}
            loading={loading}
            emptyMessage="No office data"
          />
        </Box>
      )}

      <Box mb={2} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
        <Typography variant="h6" fontWeight={700} mb={1} sx={{ fontSize: '0.95rem' }}>
          Caller Data
        </Typography>
        <TablePanel>
          <CommonTable
            columns={callerColumns}
            rows={callerRows}
            getRowKey={(r, i) => String(r.empCode || r._id || i)}
            loading={loading}
            emptyMessage="No caller data"
            stickyHeader
            dense
            maxHeight="100%"
            hover
            onRowClick={(r) =>
              navigate('/caller-responsibility/details', {
                state: {
                  empCode: r.empCode,
                  deposit: r.totalDeposit,
                  activePlayersECS: r.activePlayersECS,
                },
              })
            }
          />
        </TablePanel>
      </Box>

      <CsvUploadModal open={validateOpen} onClose={() => setValidateOpen(false)} />
    </Box>
  );
}
