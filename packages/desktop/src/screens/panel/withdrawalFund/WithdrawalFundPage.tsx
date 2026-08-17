import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { todayIST } from '@/utils/dates';
import {
  orangeBtnSx,
  fieldSx,
  chipSx,
  unpackPayload,
} from '@/screens/panel/transactions/shared';
import { NestedFundTable } from './NestedFundTable';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { SheetUploadDialog } from './SheetUploadDialog';
import {
  parseAgentSummaries,
  sumGroupedTotal,
  transformWithdrawData,
  type AgentSummary,
} from './types';

/** Withdrawal Fund — type/provider/mid report (laxminarayan WithdrawalFund). */
export function WithdrawalFundPage() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState<unknown>(null);
  const [agentWise, setAgentWise] = useState<AgentSummary[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadGateway, setUploadGateway] = useState('');
  const [uploadMid, setUploadMid] = useState('');

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

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <CollapsibleFilterPanel
        title="Withdrawal Fund"
        summary={`${startDate} → ${endDate}`}
      >
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
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
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
      </Stack>

      {agentWise.length > 0 ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
          {agentWise.map((agent) => (
            <Chip
              key={agent.name}
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
    </Box>
  );
}
