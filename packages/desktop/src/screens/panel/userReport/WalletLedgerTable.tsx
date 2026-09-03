import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount, formatDisplayDate, formatDisplayTime } from '@/utils/dates';
import { BetAmountBars } from './BetAmountBars';
import { UserReportTablePanel } from './UserReportTablePanel';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { WalletRow } from './types';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type Props = {
  userId: string;
  /**
   * Optional layout wrapper: `overview` = filters + bet chart, `table` = ledger + pagination.
   * Used to nest overview inside a parent collapse while keeping the table visible.
   */
  wrapOverview?: (parts: { overview: ReactNode; table: ReactNode }) => ReactNode;
};

const PAGE_SIZE_OPTIONS = ['75', '150', '250', '500'] as const;

function rowBg(action?: string): string {
  switch (action) {
    case 'Win':
    case 'Settled':
      return 'rgba(255, 0, 149, 0.22)';
    case 'Deposit':
      // Soft mint on dark table (was solid #84d184 — too harsh on dark theme)
      return 'rgba(46, 125, 50, 0.55)';
    case 'withdrawal request':
      return 'rgba(0, 225, 21, 0.31)';
    case 'Bonus Transfer':
      return 'rgba(255, 255, 0, 0.36)';
    case 'Roll Back':
      return 'rgba(255, 125, 0, 0.84)';
    default:
      return 'transparent';
  }
}

function detailLines(desc: Record<string, unknown> | undefined) {
  if (!desc || typeof desc !== 'object') return ['-'];
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    lines.push(`${label}: ${String(value)}`);
  };
  push('Round Id', desc.roundId);
  push('TransactionId', desc.transactionId);
  push('Amount', formatAmount(desc.amount));
  push('Market Name', desc.marketName);
  push('GameName', desc.gameName || desc.game);
  push('SettlementId', desc.settlementId);
  push('Category', desc.category);
  push('Payment Gateway', desc.paymentGatewayName);
  push('Payment Type', desc.paymentType);
  push('Reason', desc.reason);
  push('Remark', desc.remark);
  return lines.length ? lines : ['-'];
}

function parseChartPayload(raw: unknown): { name: string; amount: number }[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  let map = raw as Record<string, unknown>;

  // Secure bridge may still wrap once: { data: { casino: ... } } or { payload: ... }
  if (
    map.data &&
    typeof map.data === 'object' &&
    !Array.isArray(map.data) &&
    !('betAmount' in (map.data as object))
  ) {
    const inner = map.data as Record<string, unknown>;
    // Only unwrap if inner looks like a category map (not a single metric object)
    const innerKeys = Object.keys(inner);
    if (
      innerKeys.some((k) => ['casino', 'exchange', 'sattamatka'].includes(k.toLowerCase())) ||
      innerKeys.some((k) => {
        const v = inner[k];
        return v != null && typeof v === 'object' && 'betAmount' in (v as object);
      })
    ) {
      map = inner;
    }
  }
  if (map.payload && typeof map.payload === 'object' && !Array.isArray(map.payload)) {
    map = map.payload as Record<string, unknown>;
  }

  const skip = new Set(['success', 'message', 'status', 'token', 'payload', 'data']);
  const preferred = ['casino', 'exchange', 'sattamatka'];

  const entries = Object.entries(map).filter(([k, v]) => {
    if (skip.has(k)) return false;
    return v != null;
  });

  const byLower = new Map(
    entries.map(([k, v]) => [k.toLowerCase(), { key: k, value: v }] as const),
  );

  const ordered: string[] = [];
  for (const p of preferred) {
    const hit = byLower.get(p);
    if (hit) ordered.push(hit.key);
  }
  for (const [k] of entries) {
    if (!ordered.includes(k)) ordered.push(k);
  }

  return ordered.map((key) => {
    const v = byLower.get(key.toLowerCase())?.value;
    let amount = 0;
    if (typeof v === 'number') amount = v;
    else if (typeof v === 'string') amount = Number(v.replace(/,/g, '')) || 0;
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      amount = Number(o.betAmount ?? o.BetAmount ?? o.amount ?? o.Amount ?? 0) || 0;
    }
    return { name: key.toUpperCase(), amount };
  });
}

export function WalletLedgerTable({ userId, wrapOverview }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('250');
  // Match Laxmi: empty dates on load so chart returns full category totals
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [marketId, setMarketId] = useState('');
  const [provider, setProvider] = useState('');
  const [action, setAction] = useState('');
  const [amount, setAmount] = useState('');
  const [txnType, setTxnType] = useState('');
  const [chartData, setChartData] = useState<{ name: string; amount: number }[]>([]);

  const loadChart = useCallback(async () => {
    // Laxmi sends empty strings when dates are cleared ("" ?? today keeps "").
    const res = await secureApi('userReport.betAmountsByCategory', {
      userId: String(userId),
      startDate: startDate || '',
      endDate: endDate || '',
    });
    if (!res.ok) {
      setChartData([]);
      return;
    }
    setChartData(parseChartPayload(res.data));
  }, [userId, startDate, endDate]);

  // Chart loads on mount / date change independently (same as Laxmi useEffect)
  useEffect(() => {
    if (!userId) return;
    void loadChart();
  }, [userId, loadChart]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter: Record<string, unknown> = { userId };
      if (marketId.trim()) filter['description.marketId'] = Number(marketId.trim());
      if (provider.trim()) filter.providerName = provider.trim();
      if (action.trim()) filter.action = action.trim();
      if (amount.trim()) filter.amount = amount.trim();
      if (txnType) {
        filter.transactionType = txnType.toLowerCase() === 'credited' ? 'CR' : txnType;
      }

      const payload: Record<string, unknown> = {
        itemsPerPage: Number(itemsPerPage),
        pageNo: page,
        filter,
      };
      if (startDate && endDate) {
        payload.startDate = startDate;
        payload.endDate = endDate;
      }

      const [mainRes, customerRes] = await Promise.all([
        secureApi('userReport.walletHistory', payload),
        secureApi('userReport.walletHistoryCustomer', payload),
      ]);

      if (!mainRes.ok && !customerRes.ok) {
        toast.error(mainRes.message || 'Failed to load wallet history');
        setRows([]);
        return;
      }

      const useCustomer = Object.keys(filter).length > 1;
      if (useCustomer && customerRes.ok) {
        const data = (customerRes.data || {}) as {
          payload?: { items?: WalletRow[]; totalPages?: number };
          items?: WalletRow[];
          totalPages?: number;
        };
        const nested = data.payload || data;
        setRows((nested.items as WalletRow[]) || []);
        setTotalPages(Math.max(1, Number(nested.totalPages) || 1));
      } else if (mainRes.ok) {
        const data = (mainRes.data || {}) as {
          payload?: { walletHistory?: WalletRow[]; totalPages?: number };
          walletHistory?: WalletRow[];
          totalPages?: number;
        };
        const nested = data.payload || data;
        setRows((nested.walletHistory as WalletRow[]) || []);
        setTotalPages(Math.max(1, Number(nested.totalPages) || 1));
      }
    } finally {
      setLoading(false);
    }
  }, [action, amount, endDate, itemsPerPage, marketId, page, provider, startDate, txnType, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<CommonTableColumn<WalletRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        render: (_r, i) => (page - 1) * Number(itemsPerPage) + i + 1,
      },
      {
        id: 'provider',
        label: 'Provider',
        filter: (
          <TextField
            size="small"
            placeholder="Search provider name"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                void load();
              }
            }}
            fullWidth
          />
        ),
        render: (r) => toDisplayText(String(r.providerName || '-')),
      },
      {
        id: 'action',
        label: 'Action',
        filter: (
          <TextField
            size="small"
            placeholder="Search action type"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                void load();
              }
            }}
            fullWidth
          />
        ),
        render: (r) => String(r.action || '-'),
      },
      {
        id: 'detail',
        label: 'Detail',
        cellSx: { whiteSpace: 'normal', textAlign: 'left', minWidth: 220 },
        render: (r) => (
          <Stack spacing={0.25} alignItems="flex-start">
            {detailLines(r.description).map((line) => (
              <Typography key={line} variant="caption" sx={{ display: 'block' }}>
                {line}
              </Typography>
            ))}
          </Stack>
        ),
      },
      {
        id: 'commission',
        label: 'Commission Amount',
        render: (r) => formatAmount(r.commissionAmount ?? 0),
      },
      {
        id: 'type',
        label: 'Type',
        filter: (
          <TextField
            select
            size="small"
            value={txnType}
            onChange={(e) => {
              setTxnType(e.target.value);
              setPage(1);
            }}
            fullWidth
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="Credited">Credited</MenuItem>
            <MenuItem value="DR">Debited</MenuItem>
          </TextField>
        ),
        render: (r) => {
          const t = String(r.transactionType || '');
          if (t === 'CR' || t.toLowerCase() === 'credited') return 'Credited';
          if (t === 'DR' || t.toLowerCase() === 'debited') return 'Debited';
          return t || '-';
        },
      },
      {
        id: 'opening',
        label: 'Opening Balance',
        render: (r) => formatAmount(Math.round(Number(r.lastBalance) || 0)),
      },
      {
        id: 'amount',
        label: 'Amount',
        filter: (
          <TextField
            size="small"
            placeholder="Search by amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                void load();
              }
            }}
            fullWidth
          />
        ),
        render: (r) => formatAmount(r.amount ?? 0),
      },
      {
        id: 'closing',
        label: 'Closing Balance',
        render: (r) => formatAmount(Math.round(Number(r.balance) || 0)),
      },
      {
        id: 'created',
        label: 'Created On',
        render: (r) => {
          const raw = r.createdOn || r.updatedOn;
          if (!raw || typeof raw === 'object') {
            const d = formatDisplayDate(r.updatedOn || r.createdOn);
            const t = formatDisplayTime(r.updatedOn || r.createdOn);
            return d ? `${d} ${t}`.trim() : '-';
          }
          const d = formatDisplayDate(raw);
          const t = formatDisplayTime(raw);
          return d ? `${d} ${t}`.trim() : String(raw);
        },
      },
    ],
    [action, amount, itemsPerPage, load, page, provider, txnType],
  );

  /** White toolbar on dark theme — force visible outline + dark text. */
  const fieldSx = {
    bgcolor: '#fff',
    '& .MuiOutlinedInput-root': {
      bgcolor: '#fff',
      color: '#111',
      fontSize: 12,
      minHeight: 32,
      '& fieldset': { borderColor: '#c4cad3' },
      '&:hover fieldset': { borderColor: '#9aa4b2' },
      '&.Mui-focused fieldset': { borderColor: '#1976d2' },
    },
    '& .MuiInputBase-input': {
      py: 0.6,
      color: '#111 !important',
      WebkitTextFillColor: '#111 !important',
    },
    '& .MuiSelect-icon': { color: '#5c6470' },
  };

  const overview = (
    <Box>
      {/* Compact filter toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'flex-end',
          p: 1,
          mb: 1,
          bgcolor: '#fff',
          border: '1px solid #dde2e8',
          borderRadius: 1.5,
        }}
      >
        <Box sx={{ width: 110 }}>
          <Typography sx={{ fontSize: 11, mb: 0.25, color: '#475467' }}>Items Per Page</Typography>
          <TextField
            select
            size="small"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(e.target.value);
              setPage(1);
            }}
            fullWidth
            sx={fieldSx}
          >
            {PAGE_SIZE_OPTIONS.map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box sx={{ width: 140 }}>
          <Typography sx={{ fontSize: 11, mb: 0.25, color: '#475467' }}>Market ID</Typography>
          <TextField
            size="small"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            fullWidth
            sx={fieldSx}
          />
        </Box>
        <Box sx={{ width: 140 }}>
          <Typography sx={{ fontSize: 11, mb: 0.25, color: '#475467' }}>From Date</Typography>
          <TextField
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
          />
        </Box>
        <Box sx={{ width: 140 }}>
          <Typography sx={{ fontSize: 11, mb: 0.25, color: '#475467' }}>To Date</Typography>
          <TextField
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            ml: { md: 'auto' },
          }}
        >
          <Button
            variant="contained"
            color="inherit"
            disableElevation
            disableRipple
            disabled={!marketId.trim()}
            onClick={() => {
              setPage(1);
              void load();
            }}
            sx={laxmiActionBtnSx('white')}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="inherit"
            disableElevation
            disableRipple
            sx={laxmiActionBtnSx('black')}
            onClick={() => {
              setPage(1);
              void load();
              void loadChart();
            }}
          >
            Apply
          </Button>
          <Button
            variant="contained"
            color="inherit"
            disableElevation
            disableRipple
            sx={laxmiActionBtnSx('black')}
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
          >
            Clear Dates
          </Button>
        </Box>
        {loading && <CircularProgress size={22} />}
      </Box>

      <BetAmountBars data={chartData} collapsible={false} />
    </Box>
  );

  const table = (
    <UserReportTablePanel
      sx={{ mt: wrapOverview ? 1 : 2 }}
      footerJustify="center"
      footerSx={{ bgcolor: '#f4f6f8', borderColor: '#dde2e8' }}
      footer={
        totalPages > 1 ? (
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                color: '#333',
                bgcolor: 'transparent',
                borderColor: '#ccc',
                '&.Mui-selected': {
                  bgcolor: '#ff9f0a',
                  color: '#000',
                  fontWeight: 700,
                  '&:hover': { bgcolor: '#f08c00' },
                },
                '&.Mui-disabled': { color: '#bbb' },
                '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' },
              },
              '& .MuiPaginationItem-ellipsis': { color: '#666' },
            }}
          />
        ) : (
          <Typography sx={{ fontSize: 12, color: '#667085' }}>Page 1 of 1</Typography>
        )
      }
    >
      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No wallet history"
        minWidth={1400}
        dense
        virtualize
        maxHeight="100%"
        estimateRowHeight={40}
        getRowSx={(r) => ({ bgcolor: rowBg(r.action) })}
      />
    </UserReportTablePanel>
  );

  if (wrapOverview) {
    return <>{wrapOverview({ overview, table })}</>;
  }

  return (
    <Box>
      {overview}
      {table}
    </Box>
  );
}
