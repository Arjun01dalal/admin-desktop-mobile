import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { todayIST, getStoredUser } from '@/utils/dates';
import { CALLER_HEAD_ROLE_IDS, OFFICE_LOCATIONS, type CallerRow } from './callerResponsibility/constants';
import { CsvUploadModal } from './callerResponsibility/CsvUploadModal';
import {
  canSeeTotalDeposit,
  displayName,
  ecs,
  filterCallerRows,
  pnl,
  roleFlags,
  roundAmt,
  type StoredCallerUser,
} from './callerResponsibility/utils';

const viewBtnSx = {
  fontSize: 10,
  py: 0.25,
  px: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
} as const;

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
    () => localStorage.getItem('callerResponsibilityStartDate') || todayIST(),
  );
  const [endDate, setEndDate] = useState(
    () => localStorage.getItem('callerResponsibilityEndDate') || todayIST(),
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
          render: (r) => r.totalEmpCodes ?? '-',
        },
      ];
      if (showLocation) {
        cols.push({
          id: 'loc',
          label: 'Total Office Location',
          render: (r) => r.totalOfficeLocations ?? '-',
        });
      }
      cols.push(
        {
          id: 'txn',
          label: 'Total Transaction',
          render: (r) => r.totalTransactions ?? '-',
        },
        {
          id: 'active',
          label: 'Total Active Customers',
          render: (r) => r.totalActiveUsers ?? '-',
        },
        {
          id: 'txnCount',
          label: 'Total Transaction Count',
          render: (r) => r.totalTransactionCount,
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
        render: (r) => r.transactionCount ?? '-',
      },
      {
        id: 'active',
        label: 'Active Customers',
        render: (r) => r.activeUserCount ?? '-',
      },
      {
        id: 'deposit',
        label: 'Total Deposit',
        render: (r) => roundAmt(r.totalDeposit),
      },
      {
        id: 'wApp',
        label: 'Total Refund Approved Amount',
        render: (r) => roundAmt(r.withdrawalApprovedAmount),
      },
      {
        id: 'pnl',
        label: 'PNL',
        render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount),
      },
      {
        id: 'wPend',
        label: 'Total Refund Pending Amount',
        render: (r) => roundAmt(r.withdrawalPendingAmount),
      },
      {
        id: 'wAppC',
        label: 'Total Refund Approved Count',
        render: (r) => r.withdrawalApprovedCount ?? '-',
      },
      {
        id: 'wPendC',
        label: 'Total Refund Pending Count',
        render: (r) => r.withdrawalPendingCount ?? '-',
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
      {
        id: 'real',
        label: 'Real Name',
        render: (r) => displayName(r.realName),
      },
    ];

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
        label: 'Total Refund Approved Amount',
        render: (r) => roundAmt(r.withdrawalApprovedAmount),
      },
      {
        id: 'pnl',
        label: 'PNL',
        render: (r) => pnl(r.totalDeposit, r.withdrawalApprovedAmount),
      },
      {
        id: 'wPendAmt',
        label: 'Total Refund Pending Amount',
        render: (r) => roundAmt(r.withdrawalPendingAmount),
      },
      {
        id: 'wAppCnt',
        label: 'Refund Approved Count',
        render: (r) => r.withdrawalApprovedCount ?? '-',
      },
      {
        id: 'wPendCnt',
        label: 'Refund Pending Count',
        render: (r) => r.withdrawalPendingCount ?? '-',
      },
      {
        id: 'activeCust',
        label: 'Active Customers',
        cellSx: { whiteSpace: 'normal', minWidth: 140 },
        render: (r) => (
          <Stack spacing={0.75} alignItems="center">
            <span>{r.transactionCount ?? '-'}</span>
            <Button
              size="small"
              variant="outlined"
              sx={viewBtnSx}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/caller-responsibility/deposit-list', {
                  state: { list: r },
                });
              }}
            >
              View Deposit
            </Button>
            <Button
              size="small"
              variant="outlined"
              sx={viewBtnSx}
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
              View Refund List
            </Button>
            <Button
              size="small"
              variant="outlined"
              sx={viewBtnSx}
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
              View Unique Pending
            </Button>
          </Stack>
        ),
      },
    );

    if (!isCaller) {
      cols.push(
        {
          id: 'ex',
          label: 'E',
          render: (r) => r.activeUserCount ?? '-',
        },
        {
          id: 'casino',
          label: 'C',
          render: (r) => ecs(r).E ?? '-',
        },
        {
          id: 'matka',
          label: 'S',
          render: (r) => ecs(r).C ?? '-',
        },
      );
    }

    cols.push({
      id: 'daily',
      label: 'Daily Deposit',
      render: (r) => roundAmt(ecs(r).S),
    });

    if (!isCaller) {
      cols.push({ id: 'status', label: 'Status', render: (r) => r.time ?? '-' });
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
      <Typography variant="h5" fontWeight={700} mb={2}>
        Caller Responsibility
      </Typography>

      {!isCaller && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1f' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', md: 'center' }}
            flexWrap="wrap"
            useFlexGap
          >
            <TextField
              type="date"
              label="From Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              sx={{ width: { xs: '100%', md: 170 }, flexShrink: 0 }}
            />
            <TextField
              type="date"
              label="To Date"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              sx={{ width: { xs: '100%', md: 170 }, flexShrink: 0 }}
            />
            {showCallerHead && (
              <TextField
                select
                label="Caller Head"
                size="small"
                value={callerHead}
                onChange={(e) => setCallerHead(e.target.value)}
                sx={{ minWidth: { xs: '100%', md: 180 }, flex: { md: 1 } }}
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
                sx={{ minWidth: { xs: '100%', md: 160 }, flex: { md: 1 } }}
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
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setValidateOpen(true)}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            >
              Validate Data
            </Button>
            {loading && <CircularProgress size={22} />}
          </Stack>

          <Typography
            variant="body2"
            mt={1.5}
            onClick={openBotUsers}
            sx={{
              cursor: displayedBotCount > 0 ? 'pointer' : 'default',
              width: 'fit-content',
            }}
          >
            <strong>Active Customer (By Bots):-</strong> {displayedBotCount}
          </Typography>
        </Paper>
      )}

      {showTotalDeposit && (
        <Box mb={3}>
          <Typography variant="h6" fontWeight={700} mb={1}>
            Summary
          </Typography>
          <CommonTable
            columns={summaryColumns}
            rows={summaryRow}
            getRowKey={() => 'summary'}
            loading={loading}
            emptyMessage="No summary"
            minWidth={900}
          />
        </Box>
      )}

      {showTotalDeposit && showLocation && (
        <Box mb={3}>
          <Typography variant="h6" fontWeight={700} mb={1}>
            By Office Location
          </Typography>
          <CommonTable
            columns={locationColumns}
            rows={locationRows}
            getRowKey={(r, i) => String(r.officeLocation || i)}
            loading={loading}
            emptyMessage="No office data"
            minWidth={1000}
          />
        </Box>
      )}

      <Box mb={2}>
        <Typography variant="h6" fontWeight={700} mb={1}>
          Caller Data
        </Typography>
        <CommonTable
          columns={callerColumns}
          rows={callerRows}
          getRowKey={(r, i) => String(r.empCode || r._id || i)}
          loading={loading}
          emptyMessage="No caller data"
          minWidth={1600}
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
      </Box>

      <CsvUploadModal open={validateOpen} onClose={() => setValidateOpen(false)} />
    </Box>
  );
}
