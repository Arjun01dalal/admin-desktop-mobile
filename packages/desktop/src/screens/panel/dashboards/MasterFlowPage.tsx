import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
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
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';
import { hasPermission } from '@/auth/permissions';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { RESP_SHOW_MOBILE } from '@/screens/panel/callerResponsibility/constants';
import { maskMobile } from '@/screens/panel/shared';
import { todayIST } from '@/utils/dates';

type ListType = 'Master' | 'Super Master' | 'Super Admin';

type MasterFlowPnl = {
  totalVolume?: number;
  totalClientWin?: number;
  totalClient?: number;
  totalCommission?: number;
  totalWinLossWithoutCommission?: number;
  finalWinLoss?: number;
};

type MasterFlowRow = {
  _id?: string;
  name?: string;
  mobile?: string | number;
  ownShare?: string | number;
  initialWalletBalance?: number;
  pnl?: MasterFlowPnl;
  liveRiskManage?: unknown[];
  previousRiskmanagement?: unknown[];
};

const LIST_OPTIONS: { label: ListType; action: SecureAction }[] = [
  { label: 'Master', action: 'masterFlow.masters' },
  { label: 'Super Master', action: 'masterFlow.superMasters' },
  { label: 'Super Admin', action: 'masterFlow.superAdmins' },
];

function actionFor(type: ListType): SecureAction {
  return LIST_OPTIONS.find((o) => o.label === type)?.action ?? 'masterFlow.masters';
}

function asRows(raw: unknown): MasterFlowRow[] {
  if (Array.isArray(raw)) return raw as MasterFlowRow[];
  if (raw && typeof raw === 'object') {
    const obj = raw as { payload?: unknown; data?: unknown };
    if (Array.isArray(obj.payload)) return obj.payload as MasterFlowRow[];
    if (Array.isArray(obj.data)) return obj.data as MasterFlowRow[];
    if (obj.data && typeof obj.data === 'object') {
      const nested = obj.data as { payload?: unknown };
      if (Array.isArray(nested.payload)) return nested.payload as MasterFlowRow[];
    }
  }
  return [];
}

function fmt2(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

/** Master Flow — AAA hierarchy list (Master / Super Master / Super Admin). */
export function MasterFlowPage() {
  const [selectType, setSelectType] = useState<ListType>('Master');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<MasterFlowRow[]>([]);
  const [loading, setLoading] = useState(false);
  const canShowMobile = hasPermission(RESP_SHOW_MOBILE);
  const { next, isCurrent, begin, end } = useRequestGeneration();
  const deferredRows = useDeferredValue(rows);

  const load = useCallback(
    async (opts?: { start?: string; end?: string; type?: ListType }) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const today = todayIST();
        const from = opts?.start || startDate || today;
        const to = opts?.end || endDate || today;
        const type = opts?.type ?? selectType;

        const res = await secureApi<unknown>(actionFor(type), {
          startDate: from,
          endDate: to,
        });

        if (!isCurrent(gen)) return;

        if (!res.ok) {
          toast.error(res.message || 'Failed to load master flow');
          setRows([]);
          return;
        }

        setRows(asRows(res.data));
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [startDate, endDate, selectType, next, begin, end, isCurrent],
  );

  useEffect(() => {
    void load({ type: selectType });
    // Reload when list type changes (same as laxminarayan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectType]);

  const applyFilters = useCallback(() => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end Date!');
      return;
    }
    void load();
  }, [startDate, endDate, load]);

  const clearFilters = useCallback(() => {
    const today = todayIST();
    setStartDate('');
    setEndDate('');
    void load({ start: today, end: today });
  }, [load]);

  const onRowClick = useCallback((row: MasterFlowRow) => {
    const live = row.liveRiskManage || [];
    const prev = row.previousRiskmanagement || [];
    if (!live.length && !prev.length) {
      toast.error('No Risk Management Data Available');
    }
  }, []);

  const columns = useMemo<CommonTableColumn<MasterFlowRow>[]>(
    () => [
      { id: 'id', label: 'Id', render: (row) => row._id || '—' },
      { id: 'name', label: 'Name', render: (row) => row.name || '—' },
      {
        id: 'mobile',
        label: 'Mobile',
        render: (row) => maskMobile(row.mobile, canShowMobile),
      },
      { id: 'ownShare', label: 'OwnShare', render: (row) => row.ownShare ?? '—' },
      {
        id: 'balance',
        label: 'Balance',
        render: (row) => fmt2(row.initialWalletBalance),
      },
      {
        id: 'volume',
        label: 'Total Volume',
        render: (row) => fmt2(row.pnl?.totalVolume),
      },
      {
        id: 'clientWin',
        label: 'Total Client Win',
        render: (row) => fmt2(row.pnl?.totalClientWin),
      },
      {
        id: 'client',
        label: 'Total Client',
        render: (row) => fmt2(row.pnl?.totalClient),
      },
      {
        id: 'commission',
        label: 'Total Commission',
        render: (row) => fmt2(row.pnl?.totalCommission),
      },
      {
        id: 'winLossNoComm',
        label: 'Total WinLoss Without Commission',
        render: (row) => fmt2(row.pnl?.totalWinLossWithoutCommission),
      },
      {
        id: 'finalWinLoss',
        label: 'Final WinLoss',
        render: (row) => fmt2(row.pnl?.finalWinLoss),
      },
    ],
    [canShowMobile],
  );

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        Master Flow
      </Typography>

      <Paper
        sx={{
          p: 2,
          mb: 2,
          bgcolor: '#1a1a1f',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0, maxWidth: '100%' }}
        >
          <TextField
            select
            label="Select List"
            size="small"
            value={selectType}
            onChange={(e) => setSelectType(e.target.value as ListType)}
            sx={{ width: 180, flexShrink: 0 }}
          >
            {LIST_OPTIONS.map((opt) => (
              <MenuItem key={opt.label} value={opt.label}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
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
          <Button
            variant="contained"
            color="warning"
            onClick={applyFilters}
            disabled={loading}
            sx={{ flexShrink: 0, fontWeight: 700 }}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={clearFilters}
            disabled={loading}
            sx={{ flexShrink: 0, fontWeight: 700 }}
          >
            Clear
          </Button>
          {loading && <CircularProgress size={22} />}
        </Stack>
      </Paper>

      <CommonTable
        columns={columns}
        rows={deferredRows}
        getRowKey={(row, index) => row._id || index}
        loading={loading}
        emptyMessage="No Data Found"
        stickyHeader
        dense
        hover
        onRowClick={onRowClick}
        maxHeight="calc(100vh - 280px)"
      />
    </Box>
  );
}
