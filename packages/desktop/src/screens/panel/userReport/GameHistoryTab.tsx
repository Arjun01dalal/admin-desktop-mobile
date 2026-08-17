import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import {
  formatAmount,
  formatDisplayDate,
  formatDisplayTime,
} from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { HistoryRow } from './HistoryTable';
import { ItemsPerPageField } from './historyFilters';

type Props = { userId: string };

const STATUS_OPTIONS = [
  { id: '', label: 'Select' },
  { id: 'P', label: 'Pending' },
  { id: 'W', label: 'Win' },
  { id: 'L', label: 'Loss' },
];

const PAGINATION_SX = {
  '& .MuiPaginationItem-root': {
    color: '#333',
    '&.Mui-selected': {
      bgcolor: '#9c27b0',
      color: '#fff',
      fontWeight: 700,
      '&:hover': { bgcolor: '#7b1fa2' },
    },
    '&.Mui-disabled': { color: '#bbb' },
    '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' },
  },
};

function dt(raw: unknown) {
  const d = formatDisplayDate(raw);
  const t = formatDisplayTime(raw);
  return d ? `${d} ${t}`.trim() : '-';
}

function SearchFilter({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={onSearch} edge="end">
              <SearchIcon sx={{ fontSize: 18, color: '#555' }} />
            </IconButton>
          </InputAdornment>
        ),
      }}
      sx={{
        minWidth: 120,
        '& .MuiInputBase-root': {
          bgcolor: '#fff',
          color: '#111',
          fontSize: 12,
          pr: 0.5,
        },
      }}
    />
  );
}

/** Game History — matches Laxmi columns, filters, and settle pencil. */
export function GameHistoryTab({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  const [transactionId, setTransactionId] = useState('');
  const [bazarName, setBazarName] = useState('');
  const [gameName, setGameName] = useState('');
  const [game, setGame] = useState('');
  const [resultDate, setResultDate] = useState('');
  const [point, setPoint] = useState('');
  const [status, setStatus] = useState('');
  const [winningPoint, setWinningPoint] = useState('');
  const [commission, setCommission] = useState('');

  const [settleId, setSettleId] = useState<string | null>(null);
  const [settleBusy, setSettleBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const filter: Record<string, string> = {
        customer_id: String(userId),
      };
      if (transactionId.trim()) filter.transaction_id = transactionId.trim();
      if (bazarName.trim()) filter.bazar_name = bazarName.trim();
      if (gameName.trim()) filter.game_name = gameName.trim();
      if (game.trim()) filter.game = game.trim();
      if (resultDate) filter.result_date = resultDate;
      if (point.trim()) filter.point = point.trim();
      if (status && status !== 'Select') filter.status = status;
      if (winningPoint.trim()) filter.winning_point = winningPoint.trim();
      if (commission.trim()) filter.commission = commission.trim();

      const res = await secureApi('userReport.gameHistory', {
        itemsPerPage: Number(itemsPerPage),
        pageNo: page,
        filter,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load game history');
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
    bazarName,
    commission,
    game,
    gameName,
    itemsPerPage,
    page,
    point,
    resultDate,
    status,
    transactionId,
    userId,
    winningPoint,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = () => {
    if (page !== 1) setPage(1);
    else void load();
  };

  const settle = async () => {
    if (!settleId) return;
    setSettleBusy(true);
    try {
      const res = await secureApi('userReport.settleGameBet', { _id: settleId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to settle bet');
        return;
      }
      toast.success(res.message || 'Bet settled');
      setSettleId(null);
      void load();
    } finally {
      setSettleBusy(false);
    }
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
        label: 'Transaction ID',
        filter: (
          <SearchFilter
            value={transactionId}
            onChange={setTransactionId}
            onSearch={search}
            placeholder="Search transaction id"
          />
        ),
        render: (r) => String(r.transaction_id || '-'),
      },
      {
        id: 'bazar',
        label: 'Bazar Name',
        filter: (
          <SearchFilter
            value={bazarName}
            onChange={setBazarName}
            onSearch={search}
            placeholder="Search bazar name"
          />
        ),
        render: (r) => String(r.bazar_name || '-'),
      },
      {
        id: 'gameType',
        label: 'Game Type',
        filter: null,
        render: (r) => String(r.game_type || '-'),
      },
      {
        id: 'gameName',
        label: 'Game Name',
        filter: (
          <SearchFilter
            value={gameName}
            onChange={setGameName}
            onSearch={search}
            placeholder="Search game name"
          />
        ),
        render: (r) => String(r.game_name || '-'),
      },
      {
        id: 'game',
        label: 'Game',
        filter: (
          <SearchFilter
            value={game}
            onChange={setGame}
            onSearch={search}
            placeholder="Search game"
          />
        ),
        render: (r) => String(r.game || '-'),
      },
      {
        id: 'gameDate',
        label: 'Game Date',
        filter: (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField
              type="date"
              size="small"
              value={resultDate}
              onChange={(e) => setResultDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                minWidth: 140,
                '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
              }}
            />
            <IconButton size="small" onClick={search}>
              <SearchIcon sx={{ fontSize: 18, color: '#555' }} />
            </IconButton>
          </Stack>
        ),
        render: (r) => String(r.result_date || formatDisplayDate(r.result_date) || '-'),
      },
      {
        id: 'point',
        label: 'Point',
        filter: (
          <SearchFilter
            value={point}
            onChange={setPoint}
            onSearch={search}
            placeholder="Search point"
          />
        ),
        render: (r) => formatAmount(r.point ?? 0),
      },
      {
        id: 'status',
        label: 'Status',
        filter: (
          <TextField
            select
            size="small"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            sx={{
              minWidth: 100,
              '& .MuiInputBase-root': { bgcolor: '#fff', color: '#111', fontSize: 12 },
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.id || 'all'} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        ),
        render: (r) => (
          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
            <Typography component="span" sx={{ fontSize: 13 }}>
              {String(r.status || '-')}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setSettleId(String(r._id || ''))}
              sx={{
                bgcolor: '#ff9f0a',
                color: '#111',
                borderRadius: 0.5,
                width: 26,
                height: 26,
                '&:hover': { bgcolor: '#e08c00' },
              }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'win',
        label: 'Winning Point',
        filter: (
          <SearchFilter
            value={winningPoint}
            onChange={setWinningPoint}
            onSearch={search}
            placeholder="Search winning point"
          />
        ),
        render: (r) => formatAmount(r.winning_point ?? 0),
      },
      {
        id: 'commission',
        label: 'Commission',
        filter: (
          <SearchFilter
            value={commission}
            onChange={setCommission}
            onSearch={search}
            placeholder="Search commission"
          />
        ),
        render: (r) => formatAmount(r.commission ?? 0),
      },
      {
        id: 'betTime',
        label: 'Betting Time',
        filter: null,
        render: (r) => dt(r.createdOn),
      },
      {
        id: 'walletTime',
        label: 'Wallet Time',
        filter: null,
        render: (r) => dt(r.updatedOn),
      },
    ],
    [
      bazarName,
      commission,
      game,
      gameName,
      itemsPerPage,
      page,
      point,
      resultDate,
      status,
      transactionId,
      winningPoint,
    ],
  );

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
        mb={1.5}
      >
        <ItemsPerPageField
          value={itemsPerPage}
          onChange={(v) => {
            setItemsPerPage(v);
            setPage(1);
          }}
        />
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

      <TablePanel
        footerJustify="center"
        footer={
          totalPages > 1 ? (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_e, p) => setPage(p)}
              sx={PAGINATION_SX}
            />
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(r, i) => String(r._id || i)}
          loading={loading}
          emptyMessage="No game history"
          minWidth={1500}
          dense
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog open={Boolean(settleId)} onClose={() => setSettleId(null)}>
        <DialogTitle>Settle Bet</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to settle this bet?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettleId(null)} disabled={settleBusy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="inherit"
            disableElevation
            disabled={settleBusy}
            onClick={() => void settle()}
          >
            {settleBusy ? 'Processing…' : 'Yes, Settle'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
