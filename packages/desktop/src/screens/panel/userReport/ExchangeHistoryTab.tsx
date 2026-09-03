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
import { HISTORY_PAGINATION_SX, ItemsPerPageField, SearchFilter, formatDt } from './historyFilters';

type Props = { userId: string; variant: 'jetfair' | 'falcon' };

const ACTION: Record<Props['variant'], SecureAction> = {
  jetfair: 'userReport.jetfairHistory',
  falcon: 'userReport.falconHistory',
};

/** JetFair / Falcon history with Laxmi column search headers. */
export function ExchangeHistoryTab({ userId, variant }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('20');

  const [transactionId, setTransactionId] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [marketId, setMarketId] = useState('');
  const [marketName, setMarketName] = useState('');
  const [runnerName, setRunnerName] = useState('');
  const [rate, setRate] = useState('');
  const [stake, setStake] = useState('');
  const [betType, setBetType] = useState('');
  const [betStatus, setBetStatus] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const filter: Record<string, string> =
        variant === 'jetfair' ? { clientUsername: String(userId) } : { userId: String(userId) };

      if (transactionId.trim()) {
        filter[variant === 'falcon' ? 'TransactionID' : 'transactionId'] = transactionId.trim();
      }
      if (transactionCode.trim()) {
        filter.transactionCode = transactionCode.trim();
      }
      if (transactionType.trim()) {
        filter[variant === 'falcon' ? 'TransactionType' : 'transactionType'] =
          transactionType.trim();
      }
      if (marketId.trim()) {
        filter[variant === 'falcon' ? 'MarketID' : 'marketId'] = marketId.trim();
      }
      if (marketName.trim()) {
        filter[variant === 'falcon' ? 'Marketname' : 'marketName'] = marketName.trim();
      }
      if (runnerName.trim()) {
        filter[variant === 'falcon' ? 'Runnername' : 'runnerName'] = runnerName.trim();
      }
      if (rate.trim()) {
        filter[variant === 'falcon' ? 'Rate' : 'rate'] = rate.trim();
      }
      if (stake.trim()) {
        filter[variant === 'falcon' ? 'Stake' : 'stake'] = stake.trim();
      }
      if (betType.trim()) {
        filter[variant === 'falcon' ? 'BetType' : 'betType'] = betType.trim();
      }
      if (betStatus.trim()) {
        filter[variant === 'falcon' ? 'betStatus' : 'betStatus'] = betStatus.trim();
      }

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
    betStatus,
    betType,
    itemsPerPage,
    marketId,
    marketName,
    page,
    rate,
    runnerName,
    stake,
    transactionCode,
    transactionId,
    transactionType,
    userId,
    variant,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const search = useCallback(() => {
    if (page !== 1) setPage(1);
    else void load();
  }, [load, page]);

  const pick = (r: HistoryRow, ...keys: string[]) => {
    for (const k of keys) {
      if (r[k] != null && r[k] !== '') return r[k];
    }
    return '-';
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
        render: (r) => String(pick(r, 'transactionId', 'TransactionID')),
      },
      {
        id: 'code',
        label: 'Transaction Code',
        filter: (
          <SearchFilter
            value={transactionCode}
            onChange={setTransactionCode}
            onSearch={search}
            placeholder="Search transaction code"
          />
        ),
        render: (r) => String(pick(r, 'transactionCode', 'TransactionCode')),
      },
      {
        id: 'type',
        label: 'Transaction Type',
        filter: (
          <SearchFilter
            value={transactionType}
            onChange={setTransactionType}
            onSearch={search}
            placeholder="Search transaction type"
          />
        ),
        render: (r) => String(pick(r, 'transactionType', 'TransactionType')),
      },
      {
        id: 'marketId',
        label: 'Market Id',
        filter: (
          <SearchFilter
            value={marketId}
            onChange={setMarketId}
            onSearch={search}
            placeholder="Search market id"
          />
        ),
        render: (r) => String(pick(r, 'marketId', 'MarketID')),
      },
      {
        id: 'market',
        label: 'Market Name',
        filter: (
          <SearchFilter
            value={marketName}
            onChange={setMarketName}
            onSearch={search}
            placeholder="Search market name"
          />
        ),
        render: (r) => String(pick(r, 'marketName', 'Marketname')),
      },
      {
        id: 'runner',
        label: 'Runner Name',
        filter: (
          <SearchFilter
            value={runnerName}
            onChange={setRunnerName}
            onSearch={search}
            placeholder="Search runner name"
          />
        ),
        render: (r) => String(pick(r, 'runnerName', 'Runnername')),
      },
      {
        id: 'game',
        label: variant === 'falcon' ? 'Game Market' : 'Game Name',
        filter: null,
        render: (r) => String(pick(r, 'gameName', 'GameName', 'gameMarket')),
      },
      {
        id: 'rate',
        label: 'Rate',
        filter: (
          <SearchFilter
            value={rate}
            onChange={setRate}
            onSearch={search}
            placeholder="Search rate"
          />
        ),
        render: (r) => formatAmount(pick(r, 'rate', 'Rate') === '-' ? 0 : pick(r, 'rate', 'Rate')),
      },
      {
        id: 'stake',
        label: 'Stake',
        filter: (
          <SearchFilter
            value={stake}
            onChange={setStake}
            onSearch={search}
            placeholder="Search stake"
          />
        ),
        render: (r) =>
          formatAmount(pick(r, 'stake', 'Stake') === '-' ? 0 : pick(r, 'stake', 'Stake')),
      },
      {
        id: 'run',
        label: variant === 'falcon' ? 'Res' : 'Run',
        filter: null,
        render: (r) => String(pick(r, 'run', 'Run', 'result', 'Res')),
      },
      {
        id: 'betType',
        label: 'Bet Type',
        filter: (
          <SearchFilter
            value={betType}
            onChange={setBetType}
            onSearch={search}
            placeholder="Search bet type"
          />
        ),
        render: (r) => String(pick(r, 'betType', 'BetType')),
      },
      {
        id: 'betStatus',
        label: 'Bet Status',
        filter: (
          <SearchFilter
            value={betStatus}
            onChange={setBetStatus}
            onSearch={search}
            placeholder="Search bet status"
          />
        ),
        render: (r) => String(pick(r, 'betStatus', 'BetStatus')),
      },
      {
        id: 'site',
        label: 'Site Code',
        filter: null,
        render: (r) => String(pick(r, 'siteCode', 'SiteCode')),
      },
      {
        id: 'currency',
        label: 'Currency',
        filter: null,
        render: (r) => String(pick(r, 'currency', 'Currency')),
      },
      {
        id: 'desc',
        label: 'Description',
        filter: null,
        render: (r) => String(pick(r, 'description', 'Description')),
      },
      {
        id: 'commission',
        label: 'Commission Amount',
        filter: null,
        // Falcon API uses PascalCase `CommissionAmount` (Laxmi: Math.round).
        render: (r) => {
          const raw = pick(r, 'CommissionAmount', 'commissionAmount', 'commission');
          const n = Number(raw === '-' || raw == null ? 0 : raw);
          return formatAmount(Number.isFinite(n) ? Math.round(n) : 0);
        },
      },
      {
        id: 'pl',
        label: 'Bet PL',
        filter: null,
        render: (r) =>
          formatAmount(pick(r, 'betPL', 'BetPL') === '-' ? 0 : pick(r, 'betPL', 'BetPL')),
      },
      {
        id: 'net',
        label: 'Net PL',
        filter: null,
        render: (r) =>
          formatAmount(pick(r, 'netPL', 'NetPL') === '-' ? 0 : pick(r, 'netPL', 'NetPL')),
      },
      {
        id: 'time',
        label: 'Time',
        filter: null,
        render: (r) => formatDt(pick(r, 'createdOn', 'CreatedOn', 'createdAt')),
      },
    ],
    [
      betStatus,
      betType,
      itemsPerPage,
      marketId,
      marketName,
      page,
      rate,
      runnerName,
      stake,
      transactionCode,
      transactionId,
      transactionType,
      variant,
      search,
    ],
  );

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
          emptyMessage={`No ${variant === 'jetfair' ? 'JetFair' : 'Falcon'} history`}
          minWidth={1800}
          dense
          maxHeight="100%"
        />
      </UserReportTablePanel>
    </Box>
  );
}
