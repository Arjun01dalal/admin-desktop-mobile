import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { getStoredUser, todayIST, formatAmount } from '@/utils/dates';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { CollapsibleFilterPanel } from '@/components/CollapsibleFilterPanel';
import {
  orangeBtnSx,
  fieldSx,
  unpackPayload,
} from '@/screens/panel/transactions/shared';

type StateRow = {
  state: string;
  totalAmount: number;
  count: number;
  playing: number;
};

type Bucket = { totalAmount?: number; count?: number };

function asBucketMap(value: unknown): Record<string, Bucket> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.keys(value as Record<string, unknown>).reduce(
    (acc, key) => {
      acc[key.toLowerCase()] = (value as Record<string, Bucket>)[key];
      return acc;
    },
    {} as Record<string, Bucket>,
  );
}

function normalizePlaying(data: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  Object.entries(data).forEach(([key, value]) => {
    const k = key.toLowerCase();
    out[k] = (out[k] || 0) + Number(value || 0);
  });
  return out;
}

/** Walk nested `{ payload }` until `result` / `coinResult` are found. */
function extractDepositBody(data: unknown): {
  result: Record<string, Bucket>;
  coinResult: Record<string, Bucket>;
  depositTotals: Bucket;
  coinTotals: Bucket;
} {
  let cur: unknown = data;
  for (let i = 0; i < 4; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (obj.result != null || obj.coinResult != null) {
      const depositTotals = Array.isArray(obj.depositTotals)
        ? (obj.depositTotals[0] as Bucket)
        : {};
      const coinTotals = Array.isArray(obj.coinTotals)
        ? (obj.coinTotals[0] as Bucket)
        : {};
      return {
        result: asBucketMap(obj.result),
        coinResult: asBucketMap(obj.coinResult),
        depositTotals: depositTotals || {},
        coinTotals: coinTotals || {},
      };
    }
    if (obj.payload && typeof obj.payload === 'object') {
      cur = obj.payload;
      continue;
    }
    break;
  }
  const fallback = unpackPayload(data);
  return {
    result: asBucketMap(fallback.result),
    coinResult: asBucketMap(fallback.coinResult),
    depositTotals: Array.isArray(fallback.depositTotals)
      ? ((fallback.depositTotals[0] as Bucket) || {})
      : {},
    coinTotals: Array.isArray(fallback.coinTotals)
      ? ((fallback.coinTotals[0] as Bucket) || {})
      : {},
  };
}

function extractPlayingMap(data: unknown): Record<string, number> {
  let cur: unknown = data;
  for (let i = 0; i < 4; i += 1) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    // Prefer nested payload if present (lax: payload.payload)
    if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      cur = obj.payload;
      continue;
    }
    const numeric: Record<string, number> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'success' || key === 'message' || key === 'status') continue;
      const n = Number(value);
      if (Number.isFinite(n)) numeric[key] = n;
    }
    return normalizePlaying(numeric);
  }
  return {};
}

/** State Wise Deposit — `/transaction/state-deposit` (lax StateWiseDeposit). */
export function StateWiseDepositPage() {
  const user = getStoredUser<{
    allotedApps?: string | string[];
    clientName?: string | string[];
    accessibleStates?: string[];
  }>();
  const today = todayIST();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [allData, setAllData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StateRow[]>([]);
  const [depositTotalAmt, setDepositTotalAmt] = useState(0);
  const [coinTotalAmt, setCoinTotalAmt] = useState(0);
  const [showPlaying, setShowPlaying] = useState(false);

  const allottedApps = user?.clientName || user?.allotedApps;

  const buildPayload = useCallback(
    (opts?: { allData?: boolean; start?: string; end?: string }) => {
      const useAll = opts?.allData ?? false;
      if (useAll) return {};
      const from = opts?.start ?? startDate;
      const to = opts?.end ?? endDate;
      const payload: Record<string, unknown> = {
        startDate: from || todayIST(),
        endDate: to || todayIST(),
      };
      if (allottedApps) payload.app = allottedApps;
      return payload;
    },
    [startDate, endDate, allottedApps],
  );

  const mergeRows = useCallback(
    (
      depositMap: Record<string, Bucket>,
      coinMap: Record<string, Bucket>,
      playingMap: Record<string, number>,
    ) => {
      const keys = new Set([
        ...Object.keys(depositMap),
        ...Object.keys(coinMap),
      ]);
      let combined: StateRow[] = Array.from(keys).map((key) => {
        const d = depositMap[key];
        const c = coinMap[key];
        return {
          state: key,
          totalAmount:
            (Number(d?.totalAmount ?? 0) || 0) + (Number(c?.totalAmount ?? 0) || 0),
          count: (Number(d?.count ?? 0) || 0) + (Number(c?.count ?? 0) || 0),
          playing: playingMap[key] || 0,
        };
      });

      const allowed = user?.accessibleStates;
      if (Array.isArray(allowed) && allowed.length) {
        const set = new Set(allowed.map((s) => String(s).toLowerCase()));
        combined = combined.filter((r) => set.has(r.state.toLowerCase()));
      }

      combined.sort((a, b) => b.totalAmount - a.totalAmount);
      return combined;
    },
    [user?.accessibleStates],
  );

  const load = useCallback(
    async (opts?: { allData?: boolean; start?: string; end?: string }) => {
      const useAll = opts?.allData ?? false;
      const payload = buildPayload(opts);
      setLoading(true);
      try {
        // Deposits first (do not block on playing endpoint — matches old lax flow)
        const depRes = await secureApi('deposits.stateWise', payload);
        if (!depRes.ok) {
          toast.error(depRes.message || 'Failed to load state wise deposits');
          setRows([]);
          setDepositTotalAmt(0);
          setCoinTotalAmt(0);
          return;
        }

        const body = extractDepositBody(depRes.data);
        setDepositTotalAmt(Number(body.depositTotals.totalAmount ?? 0) || 0);
        setCoinTotalAmt(Number(body.coinTotals.totalAmount ?? 0) || 0);

        let playingMap: Record<string, number> = {};
        try {
          const playRes = await secureApi('deposits.activeCustomerState', payload);
          if (playRes.ok) {
            playingMap = extractPlayingMap(playRes.data);
            setShowPlaying(true);
          } else {
            setShowPlaying(false);
          }
        } catch {
          setShowPlaying(false);
        }

        setRows(mergeRows(body.result, body.coinResult, playingMap));
        setAllData(useAll);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to load state wise deposits');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [buildPayload, mergeRows],
  );

  useEffect(() => {
    void load({ start: today, end: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = useMemo<CommonTableColumn<StateRow>[]>(() => {
    const dataColWidth = showPlaying ? '23%' : '30%';
    const cols: CommonTableColumn<StateRow>[] = [
      {
        id: 'index',
        label: 'Sr',
        width: '8%',
        render: (_row, index) => index + 1,
      },
      {
        id: 'state',
        label: 'State',
        width: dataColWidth,
        render: (row) => row.state || '—',
      },
      {
        id: 'amount',
        label: 'Amount',
        width: dataColWidth,
        render: (row) => formatAmount(row.totalAmount),
      },
      {
        id: 'count',
        label: 'User Deposit',
        width: dataColWidth,
        render: (row) => row.count,
      },
    ];
    if (showPlaying) {
      cols.push({
        id: 'playing',
        label: 'User Playing',
        width: dataColWidth,
        render: (row) => row.playing,
      });
    }
    return cols;
  }, [showPlaying]);

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, px: 1.5, py: 1.25 }}>
      <CollapsibleFilterPanel
        title="State Wise Deposit"
        summary={`${startDate} → ${endDate}`}
      >
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
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
            variant="contained"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />
            }
            disabled={loading}
            onClick={() => void load()}
            sx={orangeBtnSx}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => void load({ allData: true })}
            sx={orangeBtnSx}
          >
            All Data
          </Button>
          <Button
            variant="contained"
            disabled={loading}
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            sx={orangeBtnSx}
          >
            Clear Dates
          </Button>
          <Chip
            label={`Total Amount Sum: ${Math.floor(depositTotalAmt + coinTotalAmt)}`}
            sx={{ bgcolor: 'rgba(255,159,10,0.15)', color: '#ff9f0a', fontWeight: 700 }}
          />
          {allData ? (
            <Typography variant="caption" color="text.secondary">
              Showing all data
            </Typography>
          ) : null}
        </Stack>
      </CollapsibleFilterPanel>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.state}
          loading={loading}
          emptyMessage="No state wise deposits found"
          stickyHeader
          dense
          maxHeight="100%"
        />
      </TablePanel>
    </Box>
  );
}
