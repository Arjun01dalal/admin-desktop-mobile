import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Button, Chip, CircularProgress, Stack, TextField } from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getRoleName, isSosExemptRole } from '@/auth/permissions';
import { getStoredUser, todayIST } from '@/utils/dates';
import { orangeBtnSx, fieldSx, chipSx, unpackPayload } from '@/screens/panel/transactions/shared';
import { NestedFundTable } from './NestedFundTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { SheetUploadDialog } from './SheetUploadDialog';
import { EmpCodeWithdrawalModal } from './EmpCodeWithdrawalModal';
import { EmpCodePieChartModal } from './EmpCodePieChartModal';
import {
  getAgentCountRows,
  getAgentEmpCodeCountRows,
  getAgentWithdrawalSummary,
  getEmpCodeCountRows,
  getWithdrawalSummaryByEmpCode,
  type AgentEmpCountRow,
  type CountRow,
} from './getWithdrawalSummaryByEmpCode';
import {
  parseAgentSummaries,
  sumGroupedTotal,
  transformWithdrawData,
  type AgentSummary,
  type WithdrawalDoc,
} from './types';

/** Current calendar month in IST: 1st → today. */
function currentMonthRangeIst(): { start: string; end: string } {
  const end = todayIST();
  const start = `${end.slice(0, 7)}-01`;
  return { start, end };
}

/** Chart / Emp report / View Details — full_access + dev_full_access (+ allowlisted mobile). */
const WITHDRAWAL_FUND_DETAILS_MOBILES = new Set(['9608010101']);

function canShowWithdrawalFundDetails(
  user: {
    mobile?: string;
    Role_ID?: string;
    Role_Name?: string;
    roleName?: string;
    role?: string;
    roles?: Record<string, string> | unknown;
  } | null,
): boolean {
  const mobile = String(
    user?.mobile ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('mobile') : '') ||
      '',
  ).trim();
  if (WITHDRAWAL_FUND_DETAILS_MOBILES.has(mobile)) return true;

  // Shared helper: Role_ID 6a33c137… + name variants for "dev_full_access" / "Dev Full Access"
  if (isSosExemptRole(user)) return true;

  // Extra soft match on display name from getRoleName
  const role = String(getRoleName(user) || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  if (
    role === 'dev_full_access' ||
    role.includes('dev_full_access') ||
    role === 'full_access' ||
    role.endsWith('_full_access')
  ) {
    return true;
  }

  return false;
}

/** Withdrawal Fund — type/provider/mid report (laxminarayan WithdrawalFund). */
export function WithdrawalFundPage() {
  const navigate = useNavigate();
  const admin = getStoredUser<{
    mobile?: string;
    Role_ID?: string;
    Role_Name?: string;
    roleName?: string;
    role?: string;
    roles?: Record<string, string> | unknown;
  }>();
  const canViewDetails = canShowWithdrawalFundDetails(admin);

  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<unknown>(null);
  const [agentWise, setAgentWise] = useState<AgentSummary[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadGateway, setUploadGateway] = useState('');
  const [uploadMid, setUploadMid] = useState('');

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsTotal, setDetailsTotal] = useState(0);
  const [detailsAgentRows, setDetailsAgentRows] = useState<CountRow[]>([]);
  const [detailsEmpRows, setDetailsEmpRows] = useState<CountRow[]>([]);
  const [detailsAgentEmpRows, setDetailsAgentEmpRows] = useState<AgentEmpCountRow[]>([]);
  const [detailsSubtitle, setDetailsSubtitle] = useState<string | undefined>();
  /** True when modal is Current Month Emp Code Report (shows date filter). */
  const [monthReportMode, setMonthReportMode] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(() => currentMonthRangeIst().start);
  const [reportEndDate, setReportEndDate] = useState(() => currentMonthRangeIst().end);
  const [monthLoading, setMonthLoading] = useState(false);

  const formattedData = useMemo(() => transformWithdrawData(grouped), [grouped]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('withdrawalFund.report', {
        startDate,
        endDate,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load withdrawal fund report');
        setGrouped(null);
        setAgentWise([]);
        setTotalAmount(0);
        return;
      }
      const body = unpackPayload(res.data);
      const g = body.grouped ?? null;
      setGrouped(g);
      setAgentWise(parseAgentSummaries(body.agentWiseSummary));
      setTotalAmount(sumGroupedTotal(g));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial
  }, []);

  const openUpload = (gateway: string, mid: string) => {
    setUploadGateway(gateway);
    setUploadMid(mid);
    setUploadOpen(true);
  };

  const openDetailsModal = (
    title: string,
    withdrawals: WithdrawalDoc[],
    totalWithdrawals: number,
    subtitle?: string,
  ) => {
    const docs = (withdrawals || []) as Record<string, unknown>[];
    setMonthReportMode(false);
    setMonthLoading(false);
    setDetailsTitle(title);
    setDetailsTotal(totalWithdrawals);
    setDetailsAgentRows(getAgentCountRows(docs));
    setDetailsEmpRows(getEmpCodeCountRows(docs));
    setDetailsAgentEmpRows(getAgentEmpCodeCountRows(docs));
    setDetailsSubtitle(subtitle);
    setDetailsOpen(true);
  };

  const closeDetailsModal = () => {
    if (monthLoading) return;
    setDetailsOpen(false);
    setMonthReportMode(false);
    setMonthLoading(false);
    setDetailsTitle('');
    setDetailsTotal(0);
    setDetailsAgentRows([]);
    setDetailsEmpRows([]);
    setDetailsAgentEmpRows([]);
    setDetailsSubtitle(undefined);
  };

  const loadEmpCodeReport = useCallback(async (start: string, end: string) => {
    if (!start || !end) {
      toast.error('Select from and to dates');
      return;
    }
    if (start > end) {
      toast.error('From date cannot be after To date');
      return;
    }
    setMonthLoading(true);
    try {
      const res = await secureApi('withdrawalFund.report', {
        startDate: start,
        endDate: end,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load emp code data');
        return;
      }
      const body = unpackPayload(res.data) as Record<string, unknown>;
      const empRows = getWithdrawalSummaryByEmpCode(body).map((item) => ({
        name: item.empCode,
        count: item.withdrawalCount,
      }));
      const agentSummaries = getAgentWithdrawalSummary(body);
      const agentRows = agentSummaries.map((item) => ({
        name: item.agentName,
        count: item.withdrawalCount,
      }));
      const allDocs = agentSummaries.flatMap((item) => item.withdrawals);
      const agentEmpRows =
        allDocs.length > 0
          ? getAgentEmpCodeCountRows(allDocs)
          : getWithdrawalSummaryByEmpCode(body).flatMap((item) =>
              getAgentCountRows(item.withdrawals).map((a) => ({
                agentName: a.name,
                empCode: item.empCode,
                count: a.count,
              })),
            );
      const total =
        empRows.reduce((sum, r) => sum + r.count, 0) ||
        agentRows.reduce((sum, r) => sum + r.count, 0);

      setDetailsTitle('Agent / Emp Code Report');
      setDetailsSubtitle(`${start} → ${end}`);
      setDetailsTotal(total);
      setDetailsAgentRows(agentRows);
      setDetailsEmpRows(empRows);
      setDetailsAgentEmpRows(
        agentEmpRows.sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.agentName.localeCompare(b.agentName);
        }),
      );
    } catch {
      toast.error('Failed to load emp code data');
    } finally {
      setMonthLoading(false);
    }
  }, []);

  const openCurrentMonthEmpCodeReport = () => {
    const { start, end } = currentMonthRangeIst();
    setReportStartDate(start);
    setReportEndDate(end);
    setMonthReportMode(true);
    setChartOpen(false);
    setDetailsTitle('Agent / Emp Code Report');
    setDetailsSubtitle(`${start} → ${end}`);
    setDetailsTotal(0);
    setDetailsAgentRows([]);
    setDetailsEmpRows([]);
    setDetailsAgentEmpRows([]);
    setDetailsOpen(true);
    void loadEmpCodeReport(start, end);
  };

  const openCurrentMonthChart = () => {
    const { start, end } = currentMonthRangeIst();
    setReportStartDate(start);
    setReportEndDate(end);
    setDetailsOpen(false);
    setMonthReportMode(false);
    setDetailsSubtitle(`${start} → ${end}`);
    setDetailsAgentRows([]);
    setDetailsEmpRows([]);
    setDetailsAgentEmpRows([]);
    setChartOpen(true);
    void loadEmpCodeReport(start, end);
  };

  const closeChartModal = () => {
    if (monthLoading) return;
    setChartOpen(false);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <CollapsibleFilterPanel title="Withdrawal Fund" summary={`${startDate} → ${endDate}`}>
        <Stack direction="row" spacing={1.25} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            type="date"
            label="From Date"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={{ ...fieldSx, width: 180 }}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ ...fieldSx, width: 180 }}
          />
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => void load()}
            sx={orangeBtnSx}
          >
            Apply
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            disabled={loading}
            onClick={() => void load()}
          >
            Refresh
          </Button>
          {loading ? <CircularProgress size={18} sx={{ color: '#ff9f0a' }} /> : null}
        </Stack>
      </CollapsibleFilterPanel>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.5} alignItems="center">
        <Chip label={`Total Amount: ${totalAmount}`} sx={chipSx} />
        {canViewDetails ? (
          <>
            <Button
              variant="contained"
              size="small"
              color="warning"
              onClick={() => openCurrentMonthChart()}
              sx={{ ...orangeBtnSx, textTransform: 'none', fontWeight: 800 }}
            >
              Current Month Chart
            </Button>
            <Button
              variant="outlined"
              size="small"
              color="warning"
              onClick={() => openCurrentMonthEmpCodeReport()}
              sx={{ textTransform: 'none' }}
            >
              Current Month Emp Code Report
            </Button>
          </>
        ) : null}
      </Stack>

      {agentWise.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2} alignItems="center">
          {agentWise.map((agent) => (
            <Stack
              key={agent.name}
              direction="row"
              spacing={0.75}
              alignItems="center"
              sx={{ flexWrap: 'wrap' }}
            >
              <Chip
                clickable
                onClick={() =>
                  navigate('/withdraw-user-data', {
                    state: {
                      name: agent.name,
                      withdrawals: agent.withdrawals,
                      lockCount: agent.lockCount,
                      totalApprovedAmount: agent.totalApprovedAmount,
                    },
                  })
                }
                label={`${agent.name} — Count(${agent.approvedCount}) | Amount(${agent.totalApprovedAmount})`}
                sx={{
                  ...chipSx,
                  bgcolor: 'rgba(66,165,245,0.15)',
                  color: '#42a5f5',
                  height: 'auto',
                  py: 0.75,
                  '& .MuiChip-label': { whiteSpace: 'normal' },
                }}
              />
              {canViewDetails ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  sx={{ textTransform: 'none', fontSize: 11 }}
                  onClick={() =>
                    openDetailsModal(
                      `Agent: ${agent.name}`,
                      agent.withdrawals,
                      agent.approvedCount || agent.withdrawals?.length || 0,
                    )
                  }
                >
                  View Details
                </Button>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : null}

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress size={28} sx={{ color: '#ff9f0a' }} />
        </Stack>
      ) : (
        <NestedFundTable
          apiData={formattedData}
          startDate={startDate}
          endDate={endDate}
          onUpload={openUpload}
        />
      )}

      <SheetUploadDialog
        open={uploadOpen}
        startDate={startDate}
        endDate={endDate}
        gateway={uploadGateway}
        mid={uploadMid}
        onClose={() => setUploadOpen(false)}
        onDone={() => void load()}
      />

      <EmpCodePieChartModal
        open={chartOpen}
        onClose={closeChartModal}
        title="Current Month Chart"
        subtitle={detailsSubtitle}
        loading={monthLoading}
        empCodeRows={detailsEmpRows}
        agentRows={detailsAgentRows}
        dateFilter={{
          startDate: reportStartDate,
          endDate: reportEndDate,
          onStartChange: setReportStartDate,
          onEndChange: setReportEndDate,
          onApply: () => void loadEmpCodeReport(reportStartDate, reportEndDate),
        }}
      />

      {canViewDetails ? (
        <EmpCodeWithdrawalModal
          open={detailsOpen}
          onClose={closeDetailsModal}
          title={detailsTitle}
          totalWithdrawals={detailsTotal}
          agentRows={detailsAgentRows}
          empCodeRows={detailsEmpRows}
          agentEmpRows={detailsAgentEmpRows}
          subtitle={detailsSubtitle}
          loading={monthReportMode ? monthLoading : false}
          dateFilter={
            monthReportMode
              ? {
                  startDate: reportStartDate,
                  endDate: reportEndDate,
                  onStartChange: setReportStartDate,
                  onEndChange: setReportEndDate,
                  onApply: () => void loadEmpCodeReport(reportStartDate, reportEndDate),
                }
              : null
          }
        />
      ) : null}
    </Box>
  );
}
