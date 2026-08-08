import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { formatAmount } from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { HistoryRow } from './HistoryTable';
import {
  HISTORY_PAGINATION_SX,
  QTECH_STATUS_OPTIONS,
  SearchFilter,
  StatusSelectFilter,
  formatDt,
} from './historyFilters';
import { toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';

type Props = { userId: string };

function statusLabel(s: unknown) {
  const v = String(s || '').toUpperCase();
  if (v === 'W') return toDisplayText('Win');
  if (v === 'L') return toDisplayText('Loss');
  if (v === 'R') return toDisplayText('Roll Back');
  return v || '-';
}

function rowBg(status: unknown): string {
  const v = String(status || '').toUpperCase();
  if (v === 'W') return 'rgba(255, 0, 149, 0.12)';
  if (v === 'L') return 'transparent';
  if (v === 'R') return 'rgba(255, 125, 0, 0.35)';
  return 'transparent';
}

/** Qtech History — column filters match Laxmi header. */
export function QtechHistoryTab({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  const [transactionId, setTransactionId] = useState('');
  const [roundId, setRoundId] = useState('');
  const [gameId, setGameId] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [winning, setWinning] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const filter: Record<string, string> = { userId: String(userId) };
      if (transactionId.trim()) filter.transactionId = transactionId.trim();
      if (roundId.trim()) filter.roundId = roundId.trim();
      if (gameId.trim()) filter.gameId = gameId.trim();
      if (category.trim()) filter.category = category.trim();
      if (amount.trim()) filter.amount = amount.trim();
      if (winning.trim()) filter.winning = winning.trim();
      if (status) filter.status = status;

      const res = await secureApi('userReport.qtechHistory', {
        itemsPerPage: Number(itemsPerPage),
        pageNo: page,
        filter,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load Qtech history');
        setRows([]);
        return;
      }
      const data = (res.data || {}) as {
        payload?: { items?: HistoryRow[]; totalPages?: number };
        items?: HistoryRow[];
        totalPages?: number;
      };
      const nested = data.payload || data;
      setRows((nested.items as HistoryRow[]) || []);
      setTotalPages(Math.max(1, Number(nested.totalPages) || 1));
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    category,
    gameId,
    itemsPerPage,
    page,
    roundId,
    status,
    transactionId,
    userId,
    winning,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = () => {
    if (page !== 1) setPage(1);
    else void load();
  };

  const columns = useMemo<CommonTableColumn<HistoryRow>[]>(
    () => [
      {
        id: '#',
        label: '#',
        width: 48,
        filter: null,
        render: (_r, i) => (page - 1) * Number(itemsPerPage) + i + 1,
      },
      {
        id: 'txn',
        label: 'Transaction Id',
        filter: (
          <SearchFilter
            value={transactionId}
            onChange={setTransactionId}
            onSearch={search}
            placeholder="Search transaction id"
          />
        ),
        render: (r) => String(r.transactionId || '-'),
      },
      {
        id: 'round',
        label: 'Round Id',
        filter: (
          <SearchFilter
            value={roundId}
            onChange={setRoundId}
            onSearch={search}
            placeholder="Search round id"
          />
        ),
        render: (r) => String(r.roundId || '-'),
      },
      {
        id: 'game',
        label: 'Game Id',
        filter: (
          <SearchFilter
            value={gameId}
            onChange={setGameId}
            onSearch={search}
            placeholder="Search game id"
          />
        ),
        render: (r) => String(r.gameId || '-'),
      },
      {
        id: 'cat',
        label: 'Category',
        filter: (
          <SearchFilter
            value={category}
            onChange={setCategory}
            onSearch={search}
            placeholder="Search category"
          />
        ),
        render: (r) => toDisplayText(String(r.category || '-')),
      },
      {
        id: 'amount',
        label: 'Amount',
        filter: (
          <SearchFilter
            value={amount}
            onChange={setAmount}
            onSearch={search}
            placeholder="Search amount"
          />
        ),
        render: (r) => formatAmount(Math.round(Number(r.amount) || 0)),
      },
      {
        id: 'win',
        label: 'Winning',
        filter: (
          <SearchFilter
            value={winning}
            onChange={setWinning}
            onSearch={search}
            placeholder="Search winning"
          />
        ),
        render: (r) =>
          formatAmount(Math.round(Number(r.wining ?? r.winning ?? 0) || 0)),
      },
      {
        id: 'rollback',
        label: 'Roll Back Amount',
        filter: null,
        render: (r) =>
          formatAmount(
            Math.round(Number(r.rollBackAmount ?? r.rollBack ?? 0) || 0),
          ),
      },
      {
        id: 'commission',
        label: 'Commission Amount',
        filter: null,
        render: (r) =>
          formatAmount(
            Math.round(Number(r.commissionAmount ?? r.commission ?? 0) || 0),
          ),
      },
      {
        id: 'after',
        label: 'Amount After Commission',
        filter: null,
        render: (r) =>
          formatAmount(Math.round(Number(r.amountAfterCommission) || 0)),
      },
      {
        id: 'time',
        label: 'Bet Time',
        filter: null,
        render: (r) => formatDt(r.createdOn),
      },
      {
        id: 'status',
        label: 'Status',
        filter: (
          <StatusSelectFilter
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={QTECH_STATUS_OPTIONS}
          />
        ),
        render: (r) => statusLabel(r.status),
      },
    ],
    [
      amount,
      category,
      gameId,
      itemsPerPage,
      page,
      roundId,
      status,
      transactionId,
      winning,
    ],
  );

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="flex-end" mb={2}>
        <Box sx={{ minWidth: 120 }}>
          <Typography sx={{ fontSize: 13, mb: 0.5, color: '#333' }}>
            Items Per Page
          </Typography>
          <TextField
            select
            size="small"
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(e.target.value);
              setPage(1);
            }}
            sx={{ bgcolor: '#fff', minWidth: 120 }}
          >
            {['20', '50', '100', '250'].map((o) => (
              <MenuItem key={o} value={o}>
                {o}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Button
          variant="contained"
          color="inherit"
          disableElevation
          disableRipple
          sx={laxmiActionBtnSx('white')}
          onClick={search}
        >
          Search
        </Button>
        {loading && <CircularProgress size={22} />}
      </Stack>

      <CommonTable
        columns={columns}
        rows={rows}
        getRowKey={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No Qtech history"
        minWidth={1500}
        dense
        getRowSx={(r) => ({ bgcolor: rowBg(r.status) })}
      />

      {totalPages > 1 && (
        <Stack alignItems="center" mt={2}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            sx={HISTORY_PAGINATION_SX}
          />
        </Stack>
      )}
    </Box>
  );
}
