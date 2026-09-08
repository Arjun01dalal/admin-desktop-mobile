/** Static option lists for the Withdrawal screen (desktop WithdrawalPage parity). */
import type { SearchFieldOption } from '../dashboards/details/DetailFilterBar';

export const STATUSES = [
  '',
  'Pending',
  'IN PROGRESS',
  'Processing',
  'Approved',
  'Failed',
  'Cancel',
  'Rejected',
  'Reverse',
  'on hold',
] as const;

export const SEARCH_FIELDS: readonly SearchFieldOption[] = [
  { key: 'userName', label: 'User Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'empCode', label: 'Emp Code' },
  { key: 'amount', label: 'Amount' },
  { key: 'transactionId', label: 'Transaction Id' },
  { key: 'dp_id', label: 'DP Id' },
  { key: 'accountNo', label: 'Account No' },
];

export const BOT_CHECK_HIDDEN_STATUSES = new Set(['Cancel', 'Rejected', 'Reverse', 'Failed']);

/** Desktop parity: fixed gateway list used in the Manual Approved / QR popups. */
export const GATEWAY_OPTIONS: { value: string; label: string }[] = [
  { value: 'bramhadev', label: 'Bramhadev' },
  { value: 'jk Bank', label: 'J&K Bank' },
  { value: 'personal', label: 'Personal' },
  { value: 'kotak', label: 'Kotak' },
  { value: 'OFS-HDFC', label: 'OFS-HDFC' },
  { value: 'OFS-AXIS', label: 'OFS-AXIS' },
  { value: 'axis', label: 'Axis' },
  { value: 'payok', label: 'Pay Ok' },
  { value: 'uco', label: 'Uco' },
  { value: 'ansin-ecommerce-JK', label: 'Ansin-Ecommerce-JK' },
  { value: 'OFS-ansin', label: 'OFS-ansin' },
  { value: 'digitech', label: 'Digitech' },
  { value: 'rpf', label: 'Royal Pets' },
  { value: 'shyam-trading', label: 'SHYAM-TRADING' },
];

export const TERMINAL_STATUSES = new Set(['Approved', 'Rejected', 'Reverse', 'Cancel', 'Failed']);
