export { ITEMS_PER_PAGE_OPTIONS, DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';

export const TABLE_COLUMNS = [
  'SR.No',
  'Name',
  'DP ID',
  'Txn ID',
  'Ref Txn ID',
  'Round ID',
  'Session ID',
  'Krida',
  'Type',
  'Status',
  'Currency',
  'Amount',
  'Jaya Point',
  'Round Capacity',
  'Is Bot',
  'Kridak',
  'Created At',
] as const;

export const TEXT_FILTER_FIELDS = [
  { key: 'userId', placeholder: 'User ID' },
  { key: 'txnId', placeholder: 'Txn ID' },
  { key: 'refTxnId', placeholder: 'Ref Txn ID' },
  { key: 'roundId', placeholder: 'Round ID' },
  { key: 'sessionId', placeholder: 'Session ID' },
  { key: 'gameId', placeholder: 'Krida' },
  { key: 'currency', placeholder: 'Currency' },
  { key: 'roundCapacity', placeholder: 'Round Capacity', type: 'number' },
] as const;

export const SELECT_FILTER_FIELDS = [
  {
    key: 'type',
    options: [
      { value: '', label: 'All' },
      { value: 'bet', label: 'Bet' },
      { value: 'win', label: 'Win' },
      { value: 'refund', label: 'Refund' },
    ],
  },
  {
    key: 'status',
    options: [
      { value: '', label: 'All' },
      { value: 'W', label: 'W' },
      { value: 'L', label: 'L' },
    ],
  },
] as const;

export const CHECKBOX_FILTER_FIELDS = [
  { key: 'isBot', label: 'Is Bot' },
  { key: 'human', label: 'Human' },
] as const;

export const INITIAL_FILTERS = {
  userId: '',
  txnId: '',
  refTxnId: '',
  roundId: '',
  sessionId: '',
  gameId: '',
  type: '',
  status: '',
  name: '',
  currency: '',
  roundCapacity: '',
  isBot: null as boolean | null,
  human: null as boolean | null,
  minAmount: '',
  maxAmount: '',
};

export type FiltersState = typeof INITIAL_FILTERS;
