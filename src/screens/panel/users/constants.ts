import { CLIENT_NAMES } from '@/constants/clientNames';

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

/** Callers: hide Todays_Active / Active_User / LAXMI_999 (laxminarayan).
 *  Sub_Admin is gated separately via View_Subadmin_User permission. */
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

export const PLAY_IN_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'E', label: 'E' },
  { value: 'C', label: 'C' },
  { value: 'S', label: 'S' },
];

export const BLOCK_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'block', label: 'Blocked' },
  { value: 'unblock', label: 'Unblocked' },
] as const;

export const DEFAULT_EMP_CODE = '001';

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

/** Indian states used by Create User (from laxminarayan depositStates). */
export const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
  'Andaman and Nicobar Islands',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep',
] as const;

export const APP_OPTIONS = CLIENT_NAMES.map((name) => ({
  value: name,
  label: name,
}));
