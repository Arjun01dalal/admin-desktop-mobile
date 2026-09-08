/** User Report feature module. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme';
import { floorNum } from '../../dashboards/mergeMetrics';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { ResponsiveTable } from '../../dashboards/ui/ResponsiveTable';
import { secureApi } from '../../api/client';
import {
  filledFilters,
  HistoryFilterBar,
  type HistoryFilterField,
  useHistoryFilters,
} from './HistoryFilterBar';
import { Pager } from './Pager';
import { styles } from '../UserReportScreen.styles';
import {
  display,
  listOf,
  num,
  pagesOf,
  stamp,
  when,
  type Rec,
} from './helpers';

/* -------------------------------- game tab -------------------------------- */

const GAME_STATUS: Record<string, string> = { P: 'Pending', W: 'Win', L: 'Loss' };

const MATKA_STATUS_OPTIONS = [
  { id: '', label: 'All' },
  { id: 'P', label: 'Pending' },
  { id: 'W', label: 'Win' },
  { id: 'L', label: 'Loss' },
];

const GAME_FILTER_FIELDS: HistoryFilterField[] = [
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

export function GameTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { draft, applied, page, setPage, onChange, onSearch } =
    useHistoryFilters(EMPTY_GAME_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('userReport.gameHistory', {
        itemsPerPage: 20,
        pageNo: page,
        filter: { customer_id: userId, ...filledFilters(applied) },
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
      { key: 'txn', label: 'Txn Id', width: 130, render: (r) => display(r.transaction_id) },
      { key: 'bazar', label: 'Bazar', width: 110, render: (r) => display(r.bazar_name) },
      { key: 'gameType', label: 'Game Type', width: 100, render: (r) => display(r.game_type) },
      { key: 'gameName', label: 'Game', width: 110, render: (r) => display(r.game_name) },
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
    ],
    [],
  );

  return (
    <View>
      <HistoryFilterBar
        fields={GAME_FILTER_FIELDS}
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
        emptyMessage="No game history"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}

/* -------------------------------- fund tab -------------------------------- */

type FundType = 'deposit' | 'withdrawal' | 'coin';

const FUND_FILTER_FIELDS: HistoryFilterField[] = [
  { type: 'text', key: 'paymentType', placeholder: 'Payment type' },
  { type: 'text', key: 'amount', placeholder: 'Search amount', keyboard: 'number-pad' },
  { type: 'text', key: 'orderId', placeholder: 'Order id' },
  { type: 'text', key: 'orderKeyId', placeholder: 'Order key id' },
  { type: 'text', key: 'paymentGatewayName', placeholder: 'Gateway' },
  { type: 'text', key: 'mid', placeholder: 'Mid' },
];

const EMPTY_FUND_FILTERS = {
  paymentType: '',
  amount: '',
  orderId: '',
  orderKeyId: '',
  paymentGatewayName: '',
  mid: '',
};

export function FundTab({ userId }: { userId: string }) {
  const [type, setType] = useState<FundType>('deposit');
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const { draft, applied, page, setPage, onChange, onSearch } =
    useHistoryFilters(EMPTY_FUND_FILTERS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Rec = { itemsPerPage: 20, pageNo: page, type };
      if (type === 'deposit') {
        payload.filterDeposit = { userId, ...filledFilters(applied) };
      } else if (type === 'withdrawal') {
        payload.filterWithdrawal = { dp_id: userId };
      } else {
        payload.filterCoin = { userId };
      }
      const res = await secureApi('userReport.transactionHistory', payload);
      setRows(res.ok ? listOf(res.data, 'items') : []);
      setTotalPages(res.ok ? pagesOf(res.data) : 1);
    } finally {
      setLoading(false);
    }
  }, [userId, page, type, applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<DataTableColumn<Rec>[]>(() => {
    const updatedByName = (r: Rec) => {
      const u = r.updatedBy;
      return u && typeof u === 'object' ? display((u as Rec).name) : display(u);
    };
    const createdStamp = (r: Rec) => {
      const action = r.action;
      const actionDate =
        action && typeof action === 'object' && !Array.isArray(action)
          ? (action as Rec).date
          : undefined;
      return stamp(r.createdOn ?? r.createdAt ?? r.CreatedOn ?? r.date ?? actionDate);
    };
    const updatedStamp = (r: Rec) =>
      stamp(r.updatedOn ?? r.updatedAt ?? r.UpdatedOn ?? r.updated_at ?? r.UpdatedAt);

    if (type === 'withdrawal') {
      return [
        {
          key: 'ptype',
          label: 'Payment Type',
          width: 100,
          render: (r) => display(r.paymentType ?? r.type),
        },
        {
          key: 'amount',
          label: 'Amount',
          width: 90,
          render: (r) => floorNum(num(r.amount)).toLocaleString('en-IN'),
        },
        { key: 'createdAt', label: 'Created At', width: 160, render: createdStamp },
        { key: 'updatedAt', label: 'Updated At', width: 160, render: updatedStamp },
        { key: 'dp', label: 'DP Id', width: 110, render: (r) => display(r.dp_id ?? r.userId) },
        { key: 'status', label: 'Status', width: 90, render: (r) => display(r.status) },
        {
          key: 'txn',
          label: 'Transaction Id',
          width: 140,
          render: (r) => display(r.transactionId ?? r.orderId),
        },
        { key: 'mobile', label: 'Mobile', width: 110, render: (r) => display(r.mobile) },
        { key: 'account', label: 'Account No', width: 130, render: (r) => display(r.accountNo) },
        {
          key: 'holder',
          label: 'Account Holder',
          width: 130,
          render: (r) => display(r.accountHolderName),
        },
        { key: 'orderId', label: 'Order Id', width: 140, render: (r) => display(r.orderId) },
        { key: 'ifsc', label: 'IFSC', width: 100, render: (r) => display(r.ifsc ?? r.IfscCode) },
        { key: 'ubank', label: 'User Bank', width: 110, render: (r) => display(r.userBankName) },
        { key: 'bank', label: 'Bank', width: 110, render: (r) => display(r.bankName) },
        {
          key: 'provider',
          label: 'Provider',
          width: 120,
          render: (r) => display(r.withdrewalProviderName),
        },
        {
          key: 'commission',
          label: 'Commission',
          width: 90,
          render: (r) => floorNum(num(r.CommissionAmount ?? r.commission)).toLocaleString('en-IN'),
        },
      ];
    }
    if (type === 'coin') {
      return [
        {
          key: 'ptype',
          label: 'Payment Type',
          width: 100,
          render: (r) => display(r.paymentType ?? r.type),
        },
        {
          key: 'amount',
          label: 'Balance',
          width: 90,
          render: (r) => floorNum(num(r.balance ?? r.amount)).toLocaleString('en-IN'),
        },
        { key: 'createdAt', label: 'Created At', width: 160, render: createdStamp },
        { key: 'updatedAt', label: 'Updated At', width: 160, render: updatedStamp },
        { key: 'uid', label: 'User Id', width: 110, render: (r) => display(r.userId) },
        { key: 'updatedBy', label: 'Updated By', width: 120, render: updatedByName },
        { key: 'reason', label: 'Reason', width: 130, render: (r) => display(r.reason) },
        { key: 'tag', label: 'Tag', width: 90, render: (r) => display(r.tag) },
        { key: 'remark', label: 'Remark', width: 140, render: (r) => display(r.remark) },
      ];
    }
    return [
      {
        key: 'ptype',
        label: 'Payment Type',
        width: 100,
        render: (r) => display(r.paymentType ?? r.type),
      },
      {
        key: 'amount',
        label: 'Amount',
        width: 90,
        render: (r) => floorNum(num(r.amount)).toLocaleString('en-IN'),
      },
      { key: 'createdAt', label: 'Created At', width: 160, render: createdStamp },
      { key: 'updatedAt', label: 'Updated At', width: 160, render: updatedStamp },
      {
        key: 'orderKey',
        label: 'Order Key Id',
        width: 150,
        render: (r) => display(r.orderKeyId ?? r.order_key_id ?? r.orderKey ?? r.orderkeyid),
      },
      {
        key: 'orderId',
        label: 'Order Id',
        width: 150,
        render: (r) => display(r.orderId ?? r.order_id),
      },
      {
        key: 'gateway',
        label: 'Gateway',
        width: 110,
        render: (r) => display(r.paymentGatewayName ?? r.gateway),
      },
      { key: 'mid', label: 'MID', width: 100, render: (r) => display(r.mid) },
      { key: 'name', label: 'User Name', width: 120, render: (r) => display(r.userName ?? r.name) },
      { key: 'status', label: 'Status', width: 90, render: (r) => display(r.status) },
      { key: 'email', label: 'Email', width: 150, render: (r) => display(r.email ?? r.userEmail) },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => display(r.mobile ?? r.userMobile),
      },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city ?? r.userCity) },
      { key: 'state', label: 'State', width: 100, render: (r) => display(r.state ?? r.userState) },
      { key: 'lat', label: 'Latitude', width: 90, render: (r) => display(r.latitude) },
      { key: 'lng', label: 'Longitude', width: 90, render: (r) => display(r.longitude) },
      { key: 'updatedBy', label: 'Updated By', width: 120, render: updatedByName },
    ];
  }, [type]);

  return (
    <View>
      <View style={styles.chipRowPlain}>
        {(
          [
            ['deposit', 'Deposit'],
            ['withdrawal', 'Withdrawal'],
            ['coin', 'Coins'],
          ] as const
        ).map(([v, label]) => (
          <TouchableOpacity
            key={v}
            style={[styles.chip, type === v && styles.chipActive]}
            onPress={() => {
              setType(v);
              setPage(1);
            }}
          >
            <Text style={[styles.chipText, type === v && styles.chipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {type === 'deposit' ? (
        <HistoryFilterBar
          fields={FUND_FILTER_FIELDS}
          values={draft}
          onChange={onChange}
          onSearch={onSearch}
        />
      ) : null}
      <ResponsiveTable
        forceCards
        previewFieldCount={4}
        columns={columns}
        rows={rows}
        keyFor={(r, i) => String(r._id ?? i)}
        loading={loading}
        emptyMessage="No transactions"
      />
      <Pager page={page} totalPages={totalPages} onPage={setPage} />
    </View>
  );
}
