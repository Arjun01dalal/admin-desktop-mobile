import { memo, useDeferredValue, useMemo } from 'react';
import { IconButton, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import {
  AmountFilter,
  CurrencyFilter,
  GameIdFilter,
  HumanFilter,
  IsBotFilter,
  NameFilter,
  OperatorIdFilter,
  RefTxnIdFilter,
  RoundCapacityFilter,
  RoundIdFilter,
  SessionIdFilter,
  StatusFilter,
  TxnIdFilter,
  TypeFilter,
  UserIdFilter,
} from './ColumnFilters';
import { HouseGamesFiltersProvider } from './FiltersContext';
import { TABLE_COLUMNS, type FiltersState } from './constants';
import type { HouseGameTransaction } from './types';
import { formatDateTime, getIsBotValue, getPlayerIdentity } from './utils';

type Props = {
  data: HouseGameTransaction[];
  currentPage: number;
  itemsPerPage: number;
  filters: FiltersState;
  onFilterChange: (key: keyof FiltersState, value: string) => void;
  onCheckboxChange: (key: 'isBot' | 'human', checked: boolean) => void;
  onSearch: () => void;
  onEdit: (item: HouseGameTransaction) => void;
};

const TransactionTable = ({
  data,
  currentPage,
  itemsPerPage,
  filters,
  onFilterChange,
  onCheckboxChange,
  onSearch,
  onEdit,
}: Props) => {
  const rowOffset = (currentPage - 1) * itemsPerPage;
  const deferredData = useDeferredValue(data);

  const columns = useMemo<CommonTableColumn<HouseGameTransaction>[]>(
    () => [
      {
        id: 'sr',
        label: TABLE_COLUMNS[0],
        width: 72,
        filter: null,
        render: (item, index) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <span>{index + 1 + rowOffset}</span>
            <IconButton
              size="small"
              aria-label="edit bet status"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              sx={{ color: '#ff9f0a', width: 26, height: 26 }}
            >
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ),
      },
      {
        id: 'name',
        label: TABLE_COLUMNS[1],
        filter: <NameFilter />,
        render: (item) => String(item?.name ?? '-'),
      },
      {
        id: 'userId',
        label: TABLE_COLUMNS[2],
        filter: <UserIdFilter />,
        render: (item) => <CopyText value={String(item?.userId ?? '')} />,
      },
      {
        id: 'txnId',
        label: TABLE_COLUMNS[3],
        filter: <TxnIdFilter />,
        render: (item) => String(item?.txnId ?? item?.transactionId ?? '-'),
      },
      {
        id: 'refTxnId',
        label: TABLE_COLUMNS[4],
        filter: <RefTxnIdFilter />,
        render: (item) => String(item?.refTxnId ?? '-'),
      },
      {
        id: 'roundId',
        label: TABLE_COLUMNS[5],
        filter: <RoundIdFilter />,
        render: (item) => String(item?.roundId ?? '-'),
      },
      {
        id: 'sessionId',
        label: TABLE_COLUMNS[6],
        filter: <SessionIdFilter />,
        render: (item) => String(item?.sessionId ?? '-'),
      },
      {
        id: 'gameId',
        label: TABLE_COLUMNS[7],
        filter: <GameIdFilter />,
        render: (item) => String(item?.gameId ?? '-'),
      },
      {
        id: 'operatorId',
        label: TABLE_COLUMNS[8],
        filter: <OperatorIdFilter />,
        render: (item) => String(item?.operatorId ?? '-'),
      },
      {
        id: 'type',
        label: TABLE_COLUMNS[9],
        filter: <TypeFilter />,
        render: (item) => String(item?.type ?? '-'),
      },
      {
        id: 'status',
        label: TABLE_COLUMNS[10],
        filter: <StatusFilter />,
        render: (item) => String(item?.status ?? '-'),
      },
      {
        id: 'currency',
        label: TABLE_COLUMNS[11],
        filter: <CurrencyFilter />,
        render: (item) => String(item?.currency ?? '-'),
      },
      {
        id: 'amount',
        label: TABLE_COLUMNS[12],
        filter: <AmountFilter />,
        render: (item) => String(item?.amount ?? '-'),
      },
      {
        id: 'winingPoint',
        label: TABLE_COLUMNS[13],
        filter: null,
        render: (item) => String(item?.winingPoint ?? '-'),
      },
      {
        id: 'roundCapacity',
        label: TABLE_COLUMNS[14],
        filter: <RoundCapacityFilter />,
        render: (item) => String(item?.roundCapacity ?? '-'),
      },
      {
        id: 'isBot',
        label: TABLE_COLUMNS[15],
        filter: <IsBotFilter />,
        render: (item) => getIsBotValue(item),
      },
      {
        id: 'player',
        label: TABLE_COLUMNS[16],
        filter: <HumanFilter />,
        render: (item) => getPlayerIdentity(item),
      },
      {
        id: 'created',
        label: TABLE_COLUMNS[17],
        filter: null,
        render: (item) =>
          formatDateTime(
            String(item?.createdAt ?? item?.createdOn ?? item?.updatedAt ?? ''),
          ),
      },
    ],
    [onEdit, rowOffset],
  );

  const filtersValue = useMemo(
    () => ({ filters, onFilterChange, onCheckboxChange, onSearch }),
    [filters, onFilterChange, onCheckboxChange, onSearch],
  );

  return (
    <HouseGamesFiltersProvider value={filtersValue}>
      <CommonTable
        columns={columns}
        rows={deferredData}
        getRowKey={(item, index) => String(item?._id ?? item?.txnId ?? index)}
        emptyMessage="No transactions found"
        stickyHeader
        minWidth={2100}
        dense
        virtualize
      />
    </HouseGamesFiltersProvider>
  );
};

export default memo(TransactionTable);
