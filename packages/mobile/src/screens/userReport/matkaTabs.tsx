/** User Report feature module. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { colors } from '../../theme';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { ResponsiveTable } from '../../dashboards/ui/ResponsiveTable';
import { secureApi } from '../../api/client';
import { formatDisplayDate } from '../../utils/dates';
import {
  filledFilters,
  HistoryFilterBar,
  type HistoryFilterField,
  useHistoryFilters,
} from './HistoryFilterBar';
import { Pager } from './Pager';
import {
  display,
  listOf,
  pagesOf,
  when,
  type Rec,
} from './helpers';

const GAME_STATUS: Record<string, string> = { P: 'Pending', W: 'Win', L: 'Loss' };
const MATKA_STATUS_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'P', label: 'Pending' },
  { id: 'W', label: 'Win' },
  { id: 'L', label: 'Loss' },
];
const EMPTY_GAME_FILTERS = {
  transaction_id: '',
  bazar_name: '',
  game_name: '',
  game: '',
  result_date: '',
  point: '',
  status: '',
  winning_point: '',
  commission: '',
};

/* -------------------------------- matka tab -------------------------------- */

type MatkaVariant = 'starline' | 'king' | 'worli' | 'crazy';

const MATKA_ACTION: Record<MatkaVariant, string> = {
  starline: 'userReport.starlineHistory',
  king: 'userReport.kingBazarHistory',
  worli: 'userReport.instantWorliHistory',
  crazy: 'userReport.crazyWheelHistory',
};

const MATKA_FILTER_FIELDS: HistoryFilterField[] = [
  { type: 'text', key: 'transaction_id', placeholder: 'Search transaction id' },
  { type: 'text', key: 'bazar_name', placeholder: 'Search bazar name' },
  { type: 'text', key: 'game_name', placeholder: 'Search game name' },
  { type: 'text', key: 'game', placeholder: 'Search game' },
  { type: 'date', key: 'result_date', placeholder: 'Game date' },
  { type: 'text', key: 'point', placeholder: 'Search point', keyboard: 'number-pad' },
  { type: 'status', key: 'status', options: MATKA_STATUS_OPTIONS },
  {
    type: 'text',
    key: 'winning_point',
    placeholder: 'Search winning point',
    keyboard: 'number-pad',
  },
  { type: 'text', key: 'commission', placeholder: 'Search commission', keyboard: 'number-pad' },
];

const CRAZY_FILTER_FIELDS: HistoryFilterField[] = [
  { type: 'text', key: 'transaction_id', placeholder: 'Search transaction id' },
  { type: 'text', key: 'bazar_name', placeholder: 'Search bazar name' },
  { type: 'text', key: 'round_id', placeholder: 'Search round id' },
  { type: 'text', key: 'game', placeholder: 'Search game' },
  { type: 'date', key: 'result_date', placeholder: 'Game date' },
  { type: 'text', key: 'point', placeholder: 'Search point', keyboard: 'number-pad' },
  { type: 'status', key: 'status', options: MATKA_STATUS_OPTIONS },
  {
    type: 'text',
    key: 'winning_point',
    placeholder: 'Search winning point',
    keyboard: 'number-pad',
  },
  { type: 'text', key: 'commission', placeholder: 'Search commission', keyboard: 'number-pad' },
];

const EMPTY_MATKA_FILTERS = {
  ...EMPTY_GAME_FILTERS,
  round_id: '',
};

export function MatkaTab({ userId, variant }: { userId: string; variant: MatkaVariant }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { draft, applied, page, setPage, onChange, onSearch } =
    useHistoryFilters(EMPTY_MATKA_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi(MATKA_ACTION[variant] as Parameters<typeof secureApi>[0], {
        itemsPerPage: 20,
        pageNo: page,
        filter: { customer_id: userId, ...filledFilters(applied) },
      });
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, variant, page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    const cols: DataTableColumn<Rec>[] = [
      { key: 'txn', label: 'Txn Id', width: 130, render: (r) => display(r.transaction_id) },
      { key: 'bazar', label: 'Bazar', width: 110, render: (r) => display(r.bazar_name) },
    ];
    if (variant === 'crazy') {
      cols.push(
        {
          key: 'round',
          label: 'Round',
          width: 110,
          render: (r) => display(r.round_id ?? r.roundId),
        },
        {
          key: 'titles',
          label: 'Title',
          width: 110,
          render: (r) => display(r.titles ?? r.game_name),
        },
      );
    } else {
      cols.push({
        key: 'gameName',
        label: 'Game',
        width: 110,
        render: (r) => display(r.game_name),
      });
    }
    cols.push(
      { key: 'game', label: 'Number', width: 80, render: (r) => display(r.game) },
      {
        key: 'resultDate',
        label: 'Result Date',
        width: 100,
        render: (r) => display(r.result_date),
      },
      { key: 'point', label: 'Point', width: 70, render: (r) => display(r.point) },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => GAME_STATUS[String(r.status ?? '')] ?? display(r.status),
        color: (r) =>
          String(r.status) === 'W'
            ? colors.success
            : String(r.status) === 'L'
              ? colors.destructive
              : undefined,
      },
      { key: 'win', label: 'Winning', width: 80, render: (r) => display(r.winning_point) },
      { key: 'commission', label: 'Commission', width: 90, render: (r) => display(r.commission) },
      { key: 'bet', label: 'Bet Time', width: 140, render: (r) => when(r) },
    );
    return cols;
  }, [variant]);

  return (
    <View>
      <HistoryFilterBar
        fields={variant === 'crazy' ? CRAZY_FILTER_FIELDS : MATKA_FILTER_FIELDS}
        values={draft}
        onChange={onChange}
        onSearch={onSearch}
      />
      <ResponsiveTable
        forceCards
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* -------------------------------- qtech tab -------------------------------- */

const QTECH_STATUS_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'W', label: 'Win' },
  { id: 'L', label: 'Loss' },
  { id: 'R', label: 'Rollback' },
];

const QTECH_FILTER_FIELDS: HistoryFilterField[] = [
  { type: 'text', key: 'transactionId', placeholder: 'Search transaction id' },
  { type: 'text', key: 'roundId', placeholder: 'Search round id' },
  { type: 'text', key: 'gameId', placeholder: 'Search game id' },
  { type: 'text', key: 'category', placeholder: 'Search category' },
  { type: 'text', key: 'amount', placeholder: 'Search amount', keyboard: 'number-pad' },
  { type: 'text', key: 'winning', placeholder: 'Search winning', keyboard: 'number-pad' },
  { type: 'status', key: 'status', options: QTECH_STATUS_OPTIONS },
];

const EMPTY_QTECH_FILTERS = {
  transactionId: '',
  roundId: '',
  gameId: '',
  category: '',
  amount: '',
  winning: '',
  status: '',
};

export function QtechTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { draft, applied, page, setPage, onChange, onSearch } =
    useHistoryFilters(EMPTY_QTECH_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('userReport.qtechHistory', {
        itemsPerPage: 20,
        pageNo: page,
        filter: { userId, ...filledFilters(applied) },
      });
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      { key: 'txn', label: 'Txn Id', width: 140, render: (r) => display(r.transactionId) },
      { key: 'round', label: 'Round', width: 120, render: (r) => display(r.roundId) },
      { key: 'game', label: 'Game', width: 110, render: (r) => display(r.gameId) },
      { key: 'category', label: 'Category', width: 100, render: (r) => display(r.category) },
      { key: 'amount', label: 'Amount', width: 80, render: (r) => display(r.amount) },
      { key: 'win', label: 'Winning', width: 80, render: (r) => display(r.wining ?? r.winning) },
      {
        key: 'rollback',
        label: 'Rollback',
        width: 80,
        render: (r) => display(r.rollBackAmount ?? r.rollBack),
      },
      {
        key: 'commission',
        label: 'Commission',
        width: 90,
        render: (r) => display(r.commissionAmount ?? r.commission),
      },
      {
        key: 'afterComm',
        label: 'After Comm.',
        width: 90,
        render: (r) => display(r.amountAfterCommission),
      },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => display(r.status),
        color: (r) =>
          String(r.status) === 'W'
            ? colors.success
            : String(r.status) === 'L'
              ? colors.destructive
              : undefined,
      },
      { key: 'created', label: 'Created On', width: 140, render: (r) => when(r) },
    ],
    [],
  );

  return (
    <View>
      <HistoryFilterBar
        fields={QTECH_FILTER_FIELDS}
        values={draft}
        onChange={onChange}
        onSearch={onSearch}
      />
      <ResponsiveTable
        forceCards
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No Qtech history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* ------------------------------ exchange tab ------------------------------ */

const EXCHANGE_FILTER_FIELDS: HistoryFilterField[] = [
  { type: 'text', key: 'transactionId', placeholder: 'Search transaction id' },
  { type: 'text', key: 'transactionCode', placeholder: 'Search transaction code' },
  { type: 'text', key: 'transactionType', placeholder: 'Search transaction type' },
  { type: 'text', key: 'marketId', placeholder: 'Search market id' },
  { type: 'text', key: 'marketName', placeholder: 'Search market name' },
  { type: 'text', key: 'runnerName', placeholder: 'Search runner name' },
  { type: 'text', key: 'rate', placeholder: 'Search rate', keyboard: 'number-pad' },
  { type: 'text', key: 'stake', placeholder: 'Search stake', keyboard: 'number-pad' },
  { type: 'text', key: 'betType', placeholder: 'Search bet type' },
  { type: 'text', key: 'betStatus', placeholder: 'Search bet status' },
];

const EMPTY_EXCHANGE_FILTERS = {
  transactionId: '',
  transactionCode: '',
  transactionType: '',
  marketId: '',
  marketName: '',
  runnerName: '',
  rate: '',
  stake: '',
  betType: '',
  betStatus: '',
};

function mapExchangeFilters(variant: 'jetfair' | 'falcon', applied: Record<string, string>): Rec {
  const src = filledFilters(applied);
  if (variant !== 'falcon') return src;
  const mapped: Rec = {};
  const alias: Record<string, string> = {
    transactionId: 'TransactionID',
    transactionType: 'TransactionType',
    marketId: 'MarketID',
    marketName: 'Marketname',
    runnerName: 'Runnername',
    rate: 'Rate',
    stake: 'Stake',
    betType: 'BetType',
  };
  for (const [k, v] of Object.entries(src)) {
    mapped[alias[k] ?? k] = v;
  }
  return mapped;
}

export function ExchangeTab({
  userId,
  variant,
}: {
  userId: string;
  variant: 'jetfair' | 'falcon';
}) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { draft, applied, page, setPage, onChange, onSearch } =
    useHistoryFilters(EMPTY_EXCHANGE_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base: Rec = variant === 'jetfair' ? { clientUsername: userId } : { userId };
      const res = await secureApi(
        variant === 'jetfair' ? 'userReport.jetfairHistory' : 'userReport.falconHistory',
        {
          itemsPerPage: 20,
          pageNo: page,
          filter: { ...base, ...mapExchangeFilters(variant, applied) },
        },
      );
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, variant, page, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const pick = (r: Rec, ...keys: string[]): string => {
    for (const k of keys) {
      if (r[k] !== undefined && r[k] !== null && r[k] !== '') return String(r[k]);
    }
    return '—';
  };

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      {
        key: 'txn',
        label: 'Txn Id',
        width: 140,
        render: (r) => pick(r, 'transactionId', 'TransactionID'),
      },
      {
        key: 'code',
        label: 'Txn Code',
        width: 110,
        render: (r) => pick(r, 'transactionCode', 'TransactionCode'),
      },
      {
        key: 'type',
        label: 'Type',
        width: 90,
        render: (r) => pick(r, 'transactionType', 'TransactionType'),
      },
      {
        key: 'market',
        label: 'Market',
        width: 130,
        render: (r) => pick(r, 'marketName', 'Marketname'),
      },
      {
        key: 'runner',
        label: 'Runner',
        width: 120,
        render: (r) => pick(r, 'runnerName', 'Runnername'),
      },
      {
        key: 'gameName',
        label: 'Game',
        width: 110,
        render: (r) => pick(r, 'gameName', 'GameName', 'gameMarket'),
      },
      { key: 'rate', label: 'Rate', width: 70, render: (r) => pick(r, 'rate', 'Rate') },
      { key: 'stake', label: 'Stake', width: 80, render: (r) => pick(r, 'stake', 'Stake') },
      {
        key: 'betType',
        label: 'Bet Type',
        width: 90,
        render: (r) => pick(r, 'betType', 'BetType'),
      },
      {
        key: 'betStatus',
        label: 'Bet Status',
        width: 90,
        render: (r) => pick(r, 'betStatus', 'BetStatus'),
      },
      { key: 'betPL', label: 'Bet P/L', width: 90, render: (r) => pick(r, 'betPL', 'BetPL') },
      { key: 'netPL', label: 'Net P/L', width: 90, render: (r) => pick(r, 'netPL', 'NetPL') },
      {
        key: 'commission',
        label: 'Commission',
        width: 90,
        render: (r) => pick(r, 'commission', 'commissionAmount'),
      },
      {
        key: 'created',
        label: 'Created On',
        width: 140,
        render: (r) => {
          const raw = (r.createdOn ?? r.CreatedOn ?? r.createdAt) as string | undefined;
          return raw ? formatDisplayDate(raw) : '—';
        },
      },
    ],
    [],
  );

  return (
    <View>
      <HistoryFilterBar
        fields={EXCHANGE_FILTER_FIELDS}
        values={draft}
        onChange={onChange}
        onSearch={onSearch}
      />
      <ResponsiveTable
        forceCards
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No exchange history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}
