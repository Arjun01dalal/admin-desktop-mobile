import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Pagination, Stack } from '@mui/material';
import { toast } from 'react-toastify';
import type { SecureAction } from '@/api/secureActions';
import { secureApi } from '@/api/secureClient';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { UserReportTablePanel } from './UserReportTablePanel';
import { formatAmount } from '@/utils/dates';
import { laxmiActionBtnSx } from './laxmiButtonSx';
import type { HistoryRow } from './HistoryTable';
import {
  DateSearchFilter,
  HISTORY_PAGINATION_SX,
  ItemsPerPageField,
  MATKA_STATUS_OPTIONS,
  SearchFilter,
  StatusSelectFilter,
  formatDt,
} from './historyFilters';

type Variant = 'starline' | 'king' | 'worli' | 'crazy';

const ACTION: Record<Variant, SecureAction> = {
  starline: 'userReport.starlineHistory',
  king: 'userReport.kingBazarHistory',
  worli: 'userReport.instantWorliHistory',
  crazy: 'userReport.crazyWheelHistory',
};

type Props = { userId: string; variant: Variant };

/**
 * Starline / King Bazar / Instant Worli / Crazy Wheel —
 * header filters match Laxmi (search icons + status select).
 */
export function MatkaHistoryTab({ userId, variant }: Props) {
  const showTime = variant === 'starline' || variant === 'crazy';
  const showRound = variant === 'crazy';
  /** Starline: Winning Point before Status. King/Worli: Status before Winning. */
  const winBeforeStatus = variant === 'starline' || variant === 'crazy';

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  const [transactionId, setTransactionId] = useState('');
  const [bazarName, setBazarName] = useState('');
  const [gameName, setGameName] = useState('');
  const [roundId, setRoundId] = useState('');
  const [game, setGame] = useState('');
  const [resultDate, setResultDate] = useState('');
  const [point, setPoint] = useState('');
  const [status, setStatus] = useState('');
  const [winningPoint, setWinningPoint] = useState('');
  const [commission, setCommission] = useState('');

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
      if (roundId.trim()) filter.round_id = roundId.trim();
      if (game.trim()) filter.game = game.trim();
      if (resultDate) filter.result_date = resultDate;
      if (point.trim()) filter.point = point.trim();
      if (status) filter.status = status;
      if (winningPoint.trim()) filter.winning_point = winningPoint.trim();
      if (commission.trim()) filter.commission = commission.trim();

      const res = await secureApi(ACTION[variant], {
        itemsPerPage: Number(itemsPerPage),
        pageNo: page,
        filter,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to load history');
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
    roundId,
    status,
    transactionId,
    userId,
    variant,
    winningPoint,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    if (page !== 1) setPage(1);
    else void load();
  }, [load, page]);

  const columns = useMemo<CommonTableColumn<HistoryRow>[]>(() => {
    const cols: CommonTableColumn<HistoryRow>[] = [
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
    ];

    if (showRound) {
      cols.push({
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
        render: (r) => String(r.round_id || r.roundId || '-'),
      });
    } else {
      cols.push({
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
      });
    }

    cols.push({
      id: 'game',
      label: 'Game',
      filter: (
        <SearchFilter value={game} onChange={setGame} onSearch={search} placeholder="Search game" />
      ),
      render: (r) => String(r.game || '-'),
    });

    if (showRound) {
      cols.push({
        id: 'titles',
        label: 'Titles',
        filter: null,
        render: (r) => String(r.titles || r.game_name || '-'),
      });
    }

    if (showTime && !showRound) {
      cols.push({
        id: 'time',
        label: 'Time',
        filter: null,
        render: (r) => String(r.time || '-'),
      });
    }

    cols.push({
      id: 'gameDate',
      label: 'Game Date',
      filter: <DateSearchFilter value={resultDate} onChange={setResultDate} onSearch={search} />,
      render: (r) => String(r.result_date || '-'),
    });

    cols.push({
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
    });

    const statusCol: CommonTableColumn<HistoryRow> = {
      id: 'status',
      label: 'Status',
      filter: (
        <StatusSelectFilter
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={MATKA_STATUS_OPTIONS}
        />
      ),
      render: (r) => String(r.status || '-'),
    };

    const winCol: CommonTableColumn<HistoryRow> = {
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
    };

    if (winBeforeStatus) {
      cols.push(winCol, statusCol);
    } else {
      cols.push(statusCol, winCol);
    }

    cols.push(
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
        render: (r) => formatDt(r.createdOn),
      },
      {
        id: 'walletTime',
        label: showRound ? 'Wallet Title' : 'Wallet Time',
        filter: null,
        render: (r) =>
          showRound
            ? String(r.wallet_title || r.walletTitle || formatDt(r.updatedOn))
            : formatDt(r.updatedOn),
      },
    );

    return cols;
  }, [
    bazarName,
    commission,
    game,
    gameName,
    itemsPerPage,
    page,
    point,
    resultDate,
    roundId,
    showRound,
    showTime,
    status,
    transactionId,
    winBeforeStatus,
    winningPoint,
    search,
  ]);

  return (
    <Box>
      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap mb={1.5}>
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

      <UserReportTablePanel
        footerJustify="center"
        footer={
          totalPages > 1 ? (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_e, p) => setPage(p)}
              sx={HISTORY_PAGINATION_SX}
            />
          ) : undefined
        }
      >
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(r, i) => String(r._id || i)}
          loading={loading}
          emptyMessage="No history found"
          minWidth={1400}
          dense
          maxHeight="100%"
        />
      </UserReportTablePanel>
    </Box>
  );
}
