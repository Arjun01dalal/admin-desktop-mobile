import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import PersonAddAltIcon from '@mui/icons-material/PersonAddAlt';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TuneIcon from '@mui/icons-material/Tune';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'react-toastify';
import {
  flattenActiveBotUsersPayload,
  formatAutomationBotLabel,
  getActiveBotCountByType,
  parseAutomationBotCallsSummary,
  toDdMmYyyy,
  type ActiveBotSummaryItem,
  type ActiveBotUserRow,
  type AutomationBotCallsSummary,
} from '@astro/shared';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { todayIST, getStoredUser } from '@/utils/dates';
import {
  CALLER_HEAD_ROLE_IDS,
  OFFICE_LOCATIONS,
  type CallerRow,
} from './callerResponsibility/constants';
import { CsvUploadModal } from './callerResponsibility/CsvUploadModal';
import {
  canSeeTotalDeposit,
  displayName,
  ecs,
  filterCallerRows,
  matchesCallerHeadName,
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

function botSummaryVisual(bot: string): {
  icon: ReactNode;
  accent: string;
} {
  const key = String(bot || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (key === 'new_user' || key.includes('new')) {
    return { icon: <PersonAddAltIcon sx={{ fontSize: 18 }} />, accent: '#60a5fa' };
  }
  if (key === 'non_performing' || key.includes('non_perform')) {
    return { icon: <WarningAmberIcon sx={{ fontSize: 18 }} />, accent: '#fbbf24' };
  }
  if (key === 'inactive') {
    return { icon: <PauseCircleOutlineIcon sx={{ fontSize: 18 }} />, accent: '#94a3b8' };
  }
  if (key === 'active') {
    return { icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, accent: '#34d399' };
  }
  return { icon: <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />, accent: '#ff9f0a' };
}

export function CallerResponsibilityPage() {
  const navigate = useNavigate();
  const user = getStoredUser<StoredCallerUser>();
  const { isCaller, isCallerHead, isCallerOrHead, isFullAllotment } = roleFlags(user?.Role_ID);
  const showTotalDeposit = canSeeTotalDeposit(user);
  const showCallerHead = !isCallerOrHead || isFullAllotment;
  const showLocation = !isCaller || isFullAllotment;
  const showOfficeSummary = showTotalDeposit && showLocation;
  const showAssignedCallerTotal = isCallerHead && !showOfficeSummary;
  const canShowBotAutomaticData = hasPermission(Permissions.show_bot_automatic_data, user);

  // Always open on today's IST date (Laxmi default); still persist when user changes filters.
  const [startDate, setStartDate] = useState(() => todayIST());
  const [endDate, setEndDate] = useState(() => todayIST());
  const [callerHead, setCallerHead] = useState('');
  const [office, setOffice] = useState('');
  const [heads, setHeads] = useState<CallerRow[]>([]);
  const [callerRows, setCallerRows] = useState<CallerRow[]>([]);
  const [locationRows, setLocationRows] = useState<CallerRow[]>([]);
  const [payload, setPayload] = useState<CallerRow>({});
  const [botUsers, setBotUsers] = useState<ActiveBotUserRow[]>([]);
  const [botCount, setBotCount] = useState(0);
  const [botSummary, setBotSummary] = useState<ActiveBotSummaryItem[]>([]);
  const [automationBotCallsSummary, setAutomationBotCallsSummary] =
    useState<AutomationBotCallsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const loadGenRef = useRef(0);
  const didInitialLoad = useRef(false);

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

  /** One Apply/refresh cycle — deposit + (optional) bot APIs, no duplicate in-flight runs. */
  const loadMain = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        startDate,
        endDate,
        callerHead: isCallerHead ? user?.name || '' : callerHead,
      };
      if (office) body.officeLocation = office;

      const botTasks = canShowBotAutomaticData
        ? ([
            secureApi('caller.activeUsersFromCallsByAutomationBot', { startDate, endDate }),
            secureApi('caller.automationBotCallsSummary', {
              startDate: toDdMmYyyy(startDate),
              endDate: toDdMmYyyy(endDate),
            }),
          ] as const)
        : null;

      const [depRes, botRes, summaryRes] = await Promise.all([
        secureApi<CallerRow>('caller.depositByEmpcodeOffice', body),
        botTasks ? botTasks[0] : Promise.resolve(null),
        botTasks ? botTasks[1] : Promise.resolve(null),
      ]);
      if (gen !== loadGenRef.current) return;

      if (!depRes.ok) {
        toast.error(depRes.message || 'Failed to load caller data');
        setCallerRows([]);
        setLocationRows([]);
        setPayload({});
      } else {
        const data = (depRes.data || {}) as CallerRow;
        const byEmp = Array.isArray(data.byEmpCode) ? (data.byEmpCode as CallerRow[]) : [];
        const visibleRows = filterCallerRows(byEmp, user, isCaller, showTotalDeposit).filter(
          (row) => !isCallerHead || matchesCallerHeadName(row.callerHead, user?.name),
        );
        setCallerRows(visibleRows);
        setLocationRows(
          Array.isArray(data.byOfficeLocation) ? (data.byOfficeLocation as CallerRow[]) : [],
        );
        setPayload(data);
      }

      if (botRes?.ok) {
        const flat = flattenActiveBotUsersPayload(botRes.data);
        setBotUsers(flat.users);
        setBotCount(flat.total);
        setBotSummary(flat.summary);
      } else if (canShowBotAutomaticData) {
        setBotUsers([]);
        setBotCount(0);
        setBotSummary([]);
      }

      if (summaryRes?.ok) {
        setAutomationBotCallsSummary(parseAutomationBotCallsSummary(summaryRes.data));
      } else if (canShowBotAutomaticData) {
        setAutomationBotCallsSummary(null);
      }
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
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
    canShowBotAutomaticData,
  ]);

  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    void loadHeads();
    void loadMain();
  }, [loadHeads, loadMain]);

  const displayedBotCount = isCaller ? 0 : botCount;
  const newUserBotCount = isCaller
    ? 0
    : getActiveBotCountByType(botSummary, 'new_user', 'new user');
  const activeBotTypeCount = isCaller
    ? 0
    : getActiveBotCountByType(botSummary, 'active', 'non_performing', 'non performing');
  const inactiveBotCount = isCaller ? 0 : getActiveBotCountByType(botSummary, 'inactive');

  const openBotUsers = useCallback(() => {
    if (isCaller || displayedBotCount <= 0) return;
    navigate('/caller-responsibility/bot-users', {
      state: {
        activeBotUsers: botUsers,
        activeBotUsersCount: botCount,
        botSummary,
        startDate,
        endDate,
      },
    });
  }, [isCaller, displayedBotCount, navigate, botUsers, botCount, botSummary, startDate, endDate]);

  const summaryRow = useMemo(() => {
    const summary = (payload.summary || {}) as CallerRow;
    return [
      {
        totalEmpCodes: isCallerOrHead ? 0 : summary.totalEmpCodes,
        totalOfficeLocations: isCallerOrHead ? 0 : summary.totalOfficeLocations,
        totalTransactions: isCallerOrHead ? 0 : summary.totalTransactions,
        totalActiveUsers: isCallerOrHead ? 0 : payload.totalActiveUsers,
        totalTransactionCount: isCallerOrHead ? 0 : roundAmt(payload.totalDeposit),
        activeByBot: displayedBotCount,
      },
    ];
  }, [isCallerOrHead, payload, displayedBotCount]);

  /** Caller-head totals from their assigned caller rows (when office summary is hidden). */
  const assignedCallerTotals = useMemo(() => {
    let deposit = 0;
    let refundApproved = 0;
    let refundPending = 0;
    let txnCount = 0;
    let activeCustomers = 0;
    let refundApprovedCount = 0;
    let refundPendingCount = 0;

    for (const row of callerRows) {
      deposit += Number(row.totalDeposit) || 0;
      refundApproved += Number(row.withdrawalApprovedAmount) || 0;
      refundPending += Number(row.withdrawalPendingAmount) || 0;
      txnCount += Number(row.transactionCount) || 0;
      activeCustomers += Number(row.activeUserCount) || 0;
      refundApprovedCount += Number(row.withdrawalApprovedCount) || 0;
      refundPendingCount += Number(row.withdrawalPendingCount) || 0;
    }

    return {
      assignedCallers: callerRows.length,
      totalDeposit: deposit,
      withdrawalApprovedAmount: refundApproved,
      withdrawalPendingAmount: refundPending,
      transactionCount: txnCount,
      activeUserCount: activeCustomers,
      withdrawalApprovedCount: refundApprovedCount,
      withdrawalPendingCount: refundPendingCount,
    };
  }, [callerRows]);

  const summaryColumns = useMemo<CommonTableColumn<(typeof summaryRow)[0]>[]>(() => {
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
              cursor: !isCaller && displayedBotCount > 0 ? 'pointer' : 'default',
            }}
          >
            {r.activeByBot}
          </Box>
        ),
      },
    );
    return cols;
  }, [isCaller, displayedBotCount, openBotUsers, showLocation]);

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
                      state: {
                        list: r,
                        type: 'deposit',
                        empCode: r.empCode,
                        startDate,
                        endDate,
                      },
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

    cols.push({
      id: 'head',
      label: 'Caller Head',
      render: (r) => displayName(r.callerHead),
    });

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
                {!isCaller ? (
                  <Chip
                    size="small"
                    label={`${startDate} → ${endDate}`}
                    variant="outlined"
                    sx={{ display: { xs: 'none', md: 'inline-flex' }, height: 24 }}
                  />
                ) : null}
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
              {!isCaller ? (
                <>
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
                </>
              ) : null}
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
          </Box>
        </Collapse>
      </Box>

      {canShowBotAutomaticData ? (
        <Stack spacing={1.25} mb={2.5}>
          <Box
            onClick={openBotUsers}
            sx={{
              cursor: !isCaller && displayedBotCount > 0 ? 'pointer' : 'default',
              width: 'fit-content',
              maxWidth: '100%',
            }}
          >
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.75 }}>
              Active Customer (By Bots): {displayedBotCount}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={`New User: ${newUserBotCount}`}
                sx={{ fontWeight: 700, bgcolor: 'rgba(59,130,246,0.14)', color: '#93c5fd' }}
              />
              <Chip
                size="small"
                label={`Active: ${activeBotTypeCount}`}
                sx={{ fontWeight: 700, bgcolor: 'rgba(16,185,129,0.14)', color: '#6ee7b7' }}
              />
              <Chip
                size="small"
                label={`Inactive: ${inactiveBotCount}`}
                sx={{ fontWeight: 700, bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(255,255,255,0.03)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
              <SmartToyOutlinedIcon sx={{ fontSize: 20, color: '#ff9f0a' }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  Automation Bot Calls Summary
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" color="text.secondary">
                    {automationBotCallsSummary?.startDate
                      ? `${automationBotCallsSummary.startDate} – ${automationBotCallsSummary.endDate}`
                      : `${startDate} – ${endDate}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ·
                  </Typography>
                  <PhoneInTalkOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Total {automationBotCallsSummary?.total ?? 0}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
            {(automationBotCallsSummary?.bots || []).length ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  // Fluid grid: 2+ cards per row as width allows (not stuck at 1 column).
                  gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
                }}
              >
                {(automationBotCallsSummary?.bots || []).map((item) => {
                  const visual = botSummaryVisual(item.bot);
                  return (
                    <Box
                      key={item.bot}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
                        <Box
                          sx={{
                            width: 30,
                            height: 30,
                            borderRadius: 1,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: `${visual.accent}22`,
                            color: visual.accent,
                          }}
                        >
                          {visual.icon}
                        </Box>
                        <Typography variant="body2" fontWeight={800} noWrap>
                          {formatAutomationBotLabel(item.bot)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: 15, color: '#4ade80' }} />
                        <Typography variant="caption" sx={{ color: '#4ade80' }}>
                          Successful: {item.successful}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.25 }}>
                        <HighlightOffIcon sx={{ fontSize: 15, color: '#f87171' }} />
                        <Typography variant="caption" sx={{ color: '#f87171' }}>
                          Unsuccessful: {item.unsuccessful}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <PhoneInTalkOutlinedIcon sx={{ fontSize: 15 }} />
                        <Typography variant="caption" fontWeight={700}>
                          Total: {item.total}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <SmartToyOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  No automation bot call records
                </Typography>
              </Stack>
            )}
          </Box>
        </Stack>
      ) : null}

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

      {showAssignedCallerTotal && (
        <Box mb={3} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} mb={1} sx={{ fontSize: '0.95rem' }}>
            Assigned Caller Summary
          </Typography>
          <CommonTable
            columns={[
              {
                id: 'assignedCallers',
                label: "Total Assigned Caller's",
                render: (r) => cellText(r.assignedCallers),
              },
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
            ]}
            rows={[assignedCallerTotals]}
            getRowKey={() => 'assigned-callers'}
            loading={loading}
            emptyMessage="No assigned callers"
          />
        </Box>
      )}

      {showOfficeSummary && (
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
