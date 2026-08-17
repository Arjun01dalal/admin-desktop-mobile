import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getSessionUser, hasPermission, Permissions } from '@/auth/permissions';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { display } from '@/screens/panel/shared';
import { canShowFundEditBtn } from '@/screens/panel/funds/constants';
import {
  FundsEditAccessModal,
  type FundsEditTarget,
} from '@/screens/panel/funds/FundsEditAccessModal';
import {
  normalizeMids,
  readFundsDates,
  roundAmt,
  saveFundsDates,
  saveFundsDrill,
} from '@/screens/panel/funds/utils';

type FundRow = {
  name: string;
  totalFinalAmount?: number;
  totalTransactionAmount?: number;
  totalCoinRemove?: number;
  mids?: unknown;
  [key: string]: unknown;
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  height: 40,
  px: 2,
  '&:hover': { bgcolor: '#e08c00' },
};

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

function formatFundRows(payload: unknown): FundRow[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.entries(payload as Record<string, unknown>).map(([name, data]) =>
    typeof data === 'object' && data !== null
      ? { name, ...(data as Record<string, unknown>) }
      : { name },
  );
}

export function FundsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getSessionUser();
  const canShowTotal = hasPermission(Permissions.show_gateway_and_total);
  const canEditAccess = canShowFundEditBtn(user?.mobile);

  const initial = readFundsDates(
    location.state as { startDate?: string; endDate?: string } | null,
  );
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<FundRow[]>([]);
  const [totalDeposit, setTotalDeposit] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FundsEditTarget | null>(null);

  const load = useCallback(
    async (from = startDate, to = endDate) => {
      if (!from || !to) {
        toast.error('Please select both start and end dates');
        return;
      }
      setLoading(true);
      try {
        const [fundsRes, depositRes] = await Promise.all([
          secureApi('funds.upiPaymentApproved', {
            startDate: from,
            endDate: to,
          }),
          secureApi('fundRequests.depositWithdrawal', {
            startDate: from,
            endDate: to,
          }),
        ]);

        if (!fundsRes.ok) {
          toast.error(fundsRes.message || 'Failed to load funds');
          setRows([]);
        } else {
          const payload = unpackPayload(fundsRes.data);
          const formatted = formatFundRows(payload);
          const canShowGateway =
            hasPermission(Permissions.show_gateway_and_total) ||
            hasPermission(Permissions.show_gateway_only);
          const gateways = Array.isArray(user?.gateway)
            ? (user!.gateway as string[])
            : [];

          let filtered = formatted;
          if (gateways.length > 0) {
            filtered = formatted.filter((item) => gateways.includes(item.name));
          } else if (!canShowGateway) {
            filtered = formatted.filter((item) => item.name !== 'gateway');
          }
          setRows(filtered);
        }

        if (depositRes.ok) {
          const dw = unpackPayload(depositRes.data);
          setTotalDeposit(Number(dw.totalDeposit ?? 0));
        }
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, user],
  );

  useLayoutEffect(() => {
    const restored = readFundsDates(
      location.state as { startDate?: string; endDate?: string } | null,
    );
    setStartDate(restored.startDate);
    setEndDate(restored.endDate);
    saveFundsDates(restored.startDate, restored.endDate);
  }, [location.key]);

  useEffect(() => {
    const restored = readFundsDates(
      location.state as { startDate?: string; endDate?: string } | null,
    );
    void load(restored.startDate, restored.endDate);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const openMid = useCallback(
    (row: FundRow) => {
      const mids = normalizeMids(row.mids);
      if (!mids.length) {
        toast.info('No MID list for this name');
        return;
      }
      saveFundsDates(startDate, endDate);
      saveFundsDrill({
        name: row.name,
        mids,
        startDate,
        endDate,
      });
      navigate('/funds/mid', {
        state: {
          name: row.name,
          mids,
          startDate,
          endDate,
        },
      });
    },
    [navigate, startDate, endDate],
  );

  const openEdit = useCallback((row: FundRow) => {
    setEditTarget({ gatewayName: row.name });
    setEditOpen(true);
  }, []);

  const columns = useMemo<CommonTableColumn<FundRow>[]>(() => {
    const cols: CommonTableColumn<FundRow>[] = [
      {
        id: '#',
        label: (
          <>
            Sr
            <br />
            No
          </>
        ),
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => (
          <Box component="span" sx={{ fontWeight: 600, color: '#ff9f0a' }}>
            {row.name === 'coinRemove' ? 'Other Removal' : display(row.name)}
          </Box>
        ),
      },
      {
        id: 'totalFinalAmount',
        label: 'Total Amount',
        render: (row) => roundAmt(row.totalFinalAmount),
      },
      {
        id: 'totalTransactionAmount',
        label: 'Automatic',
        render: (row) => roundAmt(row.totalTransactionAmount),
      },
      {
        id: 'totalCoinRemove',
        label: 'Points Remove',
        render: (row) => roundAmt(row.totalCoinRemove),
      },
    ];

    if (canEditAccess) {
      cols.push({
        id: 'updateAccess',
        label: 'Update Access',
        width: 120,
        render: (row) => (
          <Button
            size="small"
            variant="contained"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            sx={{
              ...orangeBtnSx,
              height: 32,
              fontSize: 12,
              px: 1.5,
            }}
          >
            Edit
          </Button>
        ),
      });
    }

    return cols;
  }, [canEditAccess, openEdit]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CollapsibleFilterPanel
        title="Funds"
        summary={`${startDate} → ${endDate}`}
        headerActions={
          <Button
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={(event) => {
              event.stopPropagation();
              void load();
            }}
            disabled={loading}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
        }
      >
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1.5}
          alignItems="center"
          sx={{ '& > *': { flexShrink: 0 } }}
        >
        <TextField
          fullWidth={false}
          size="small"
          type="date"
          label="From Date"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            saveFundsDates(e.target.value, endDate);
          }}
          sx={{ width: 160 }}
        />
        <TextField
          fullWidth={false}
          size="small"
          type="date"
          label="To Date"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            saveFundsDates(startDate, e.target.value);
          }}
          sx={{ width: 160 }}
        />
        <Button
          onClick={() => {
            saveFundsDates(startDate, endDate);
            void load(startDate, endDate);
          }}
          sx={orangeBtnSx}
        >
          Apply
        </Button>
        <Button onClick={() => navigate('/funds/mid-groups')} sx={orangeBtnSx}>
          MID Groups
        </Button>
        {canShowTotal && (
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'background.paper',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Typography fontWeight={700} whiteSpace="nowrap">
              Total Deposits: ₹ {roundAmt(totalDeposit)}
            </Typography>
          </Paper>
        )}
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row, i) => `${row.name}-${i}`}
          loading={loading}
          emptyMessage="No data"
          minWidth="100%"
          maxHeight="100%"
          onRowClick={(row) => openMid(row)}
        />
      </TablePanel>

      <FundsEditAccessModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditTarget(null);
        }}
        target={editTarget}
      />
    </Box>
  );
}
