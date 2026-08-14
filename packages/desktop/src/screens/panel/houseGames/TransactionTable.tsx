import { memo, useDeferredValue, useMemo } from 'react';
import { IconButton, Stack } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { CopyText, CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { formatAmount } from '@/utils/dates';
import {
  AmountFilter,
  CurrencyFilter,
  GameIdFilter,
  HumanFilter,
  IsBotFilter,
  NameFilter,
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
import { houseGameIdLabel, toDisplayText } from '@/screens/panel/dashboards/ops/jyotishMapping';
import { useRevealCodes } from '@/context/useRevealCodes';

type Props = {
  data: HouseGameTransaction[];
  currentPage: number;
  itemsPerPage: number;
  filters: FiltersState;
  loading?: boolean;
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
  loading = false,
  onFilterChange,
  onCheckboxChange,
  onSearch,
  onEdit,
}: Props) => {
  const rowOffset = (currentPage - 1) * itemsPerPage;
  const deferredData = useDeferredValue(data);
  const { active: revealActive } = useRevealCodes();

  const columns = useMemo<CommonTableColumn<HouseGameTransaction>[]>(
    () => [
      {
        id: 'sr',
        label: toDisplayText(TABLE_COLUMNS[0]),
        width: 72,
        filter: null,
        render: (item, index) => (
          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
            <span>{index + 1 + rowOffset}</span>
            <IconButton
              size="small"
              aria-label={toDisplayText('Update Bet Status')}
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
        label: toDisplayText(TABLE_COLUMNS[1]),
        filter: <NameFilter />,
        render: (item) => String(item?.name ?? '-'),
      },
      {
        id: 'userId',
        label: toDisplayText(TABLE_COLUMNS[2]),
        filter: <UserIdFilter />,
        render: (item) => <CopyText value={String(item?.userId ?? '')} />,
      },
      {
        id: 'txnId',
        label: toDisplayText(TABLE_COLUMNS[3]),
        filter: <TxnIdFilter />,
        render: (item) => String(item?.txnId ?? item?.transactionId ?? '-'),
      },
      {
        id: 'refTxnId',
        label: toDisplayText(TABLE_COLUMNS[4]),
        filter: <RefTxnIdFilter />,
        render: (item) => String(item?.refTxnId ?? '-'),
      },
      {
        id: 'roundId',
        label: toDisplayText(TABLE_COLUMNS[5]),
        filter: <RoundIdFilter />,
        render: (item) => String(item?.roundId ?? '-'),
      },
      {
        id: 'sessionId',
        label: toDisplayText(TABLE_COLUMNS[6]),
        filter: <SessionIdFilter />,
        render: (item) => String(item?.sessionId ?? '-'),
      },
      {
        id: 'gameId',
        label: toDisplayText(TABLE_COLUMNS[7]),
        filter: <GameIdFilter />,
        render: (item) => houseGameIdLabel(item?.gameId),
      },
      {
        id: 'type',
        label: toDisplayText(TABLE_COLUMNS[8]),
        filter: <TypeFilter />,
        render: (item) => toDisplayText(String(item?.type ?? '-')),
      },
      {
        id: 'status',
        label: toDisplayText(TABLE_COLUMNS[9]),
        filter: <StatusFilter />,
        render: (item) => String(item?.status ?? '-'),
      },
      {
        id: 'currency',
        label: toDisplayText(TABLE_COLUMNS[10]),
        filter: <CurrencyFilter />,
        render: (item) => String(item?.currency ?? '-'),
      },
      {
        id: 'amount',
        label: toDisplayText(TABLE_COLUMNS[11]),
        filter: <AmountFilter />,
        render: (item) => formatAmount(item?.amount ?? 0),
      },
      {
        id: 'winingPoint',
        label: toDisplayText(TABLE_COLUMNS[12]),
        filter: null,
        render: (item) => String(item?.winingPoint ?? '-'),
      },
      {
        id: 'roundCapacity',
        label: toDisplayText(TABLE_COLUMNS[13]),
        filter: <RoundCapacityFilter />,
        render: (item) => String(item?.roundCapacity ?? '-'),
      },
      {
        id: 'isBot',
        label: toDisplayText(TABLE_COLUMNS[14]),
        filter: <IsBotFilter />,
        render: (item) => getIsBotValue(item),
      },
      {
        id: 'player',
        label: toDisplayText(TABLE_COLUMNS[15]),
        filter: <HumanFilter />,
        render: (item) => getPlayerIdentity(item),
      },
      {
        id: 'created',
        label: toDisplayText(TABLE_COLUMNS[16]),
        filter: null,
        render: (item) =>
          formatDateTime(
            String(item?.createdAt ?? item?.createdOn ?? item?.updatedAt ?? ''),
          ),
      },
    ],
    [onEdit, rowOffset, revealActive],
  );

  const gameIdOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of deferredData) {
      const id = String(row?.gameId ?? '').trim();
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [deferredData]);

  const filtersValue = useMemo(
    () => ({
      filters,
      onFilterChange,
      onCheckboxChange,
      onSearch,
      gameIdOptions,
    }),
    [filters, onFilterChange, onCheckboxChange, onSearch, gameIdOptions],
  );

  return (
    <HouseGamesFiltersProvider value={filtersValue}>
      <CommonTable
        columns={columns}
        rows={deferredData}
        getRowKey={(item, index) => String(item?._id ?? item?.txnId ?? index)}
        loading={loading}
        emptyMessage="No transactions found"
        stickyHeader
        minWidth={2100}
        dense
        virtualize
        maxHeight="calc(100vh - 285px)"
      />
    </HouseGamesFiltersProvider>
  );
};

export default memo(TransactionTable);
