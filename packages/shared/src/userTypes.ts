/** User-type filter values (Users / Bot Data / New Registers). */
export const USER_TYPES = [
  'User',
  'Sub_Admin',
  'Todays_Active',
  'Active_User',
  'Non_Performing_User',
  'In_Active_Deposit',
  'Non_Performing_Active_User',
  'LAXMI_999_Users',
] as const;

export type UserType = (typeof USER_TYPES)[number];

/** Callers: hide Todays_Active / Active_User / LAXMI_999 (laxminarayan). */
export const CALLER_HIDDEN_USER_TYPES: UserType[] = [
  'Todays_Active',
  'Active_User',
  'LAXMI_999_Users',
];

/** Keep enum-style labels (underscores) like laxminarayan Select User Type. */
export const USER_TYPE_OPTIONS = USER_TYPES.map((value) => ({
  value,
  label: value,
}));

/** Bot Data filter — subset with friendlier labels. */
export const BOT_DATA_USER_TYPE_OPTIONS = [
  { value: 'User', label: 'User' },
  { value: 'Todays_Active', label: "Today's Active" },
  { value: 'Active_User', label: 'Active User' },
  { value: 'Non_Performing_User', label: 'Non Performing User' },
  { value: 'In_Active_Deposit', label: 'Inactive Deposit' },
] as const;

export const BLOCK_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'block', label: 'Blocked' },
  { value: 'unblock', label: 'Unblocked' },
] as const;

/**
 * Users balance filter — admin-panel-domains "Select Balance Range".
 * Value is `min-max`; API filter gets numeric `min` / `max`.
 */
export const BALANCE_RANGE_OPTIONS = [
  { value: '', label: 'All' },
  { value: '0-1000', label: '0 - 1000' },
  { value: '1000-10000', label: '1,000 - 10,000' },
  { value: '10000-50000', label: '10,000 - 50,000' },
  { value: '50000-100000', label: '50,000 - 100,000' },
  { value: '100000-1000000', label: '100,000 - 100,0000' },
] as const;

export type BalanceRangeValue = (typeof BALANCE_RANGE_OPTIONS)[number]['value'];

/** Parse `min-max` range into API filter fields. */
export function balanceRangeToFilter(range: string | null | undefined): {
  min?: number;
  max?: number;
} {
  const raw = String(range || '').trim();
  if (!raw || !raw.includes('-')) return {};
  const [minRaw, maxRaw] = raw.split('-');
  const min = Number(minRaw);
  const max = Number(maxRaw);
  const out: { min?: number; max?: number } = {};
  if (Number.isFinite(min)) out.min = min;
  if (Number.isFinite(max)) out.max = max;
  return out;
}

export const DEFAULT_EMP_CODE = '001';

/** Mobiles allowed to edit user empCode. */
export const SHOW_EDIT_EMP_CODE = ['9373114572', '9561139951', '9806010101'] as const;

/**
 * Block/unblock OTP target (laxminarayan Users sendOTP).
 * SuperAdmin default; allowlisted mobiles receive OTP on their own number.
 */
export const BLOCK_OTP_DEFAULT_MOBILE = '9373114572';
export const BLOCK_OTP_SELF_MOBILES = new Set(['9608010101', '9561139951']);

export function resolveBlockOtpMobile(loginMobile?: string): string {
  const mobile = String(loginMobile || '').trim();
  if (BLOCK_OTP_SELF_MOBILES.has(mobile)) return mobile;
  return BLOCK_OTP_DEFAULT_MOBILE;
}
