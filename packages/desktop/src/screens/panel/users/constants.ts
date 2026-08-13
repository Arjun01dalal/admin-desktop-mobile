import { CLIENT_NAMES, appCodeForName } from '@/constants/clientNames';

export {
  USER_TYPES,
  type UserType,
  CALLER_HIDDEN_USER_TYPES,
  USER_TYPE_OPTIONS,
  BOT_DATA_USER_TYPE_OPTIONS,
  BLOCK_STATUS_OPTIONS,
  DEFAULT_EMP_CODE,
  SHOW_EDIT_EMP_CODE,
  BLOCK_OTP_DEFAULT_MOBILE,
  BLOCK_OTP_SELF_MOBILES,
  resolveBlockOtpMobile,
} from '@astro/shared/userTypes';

export { PLAY_IN_FILTER_OPTIONS as PLAY_IN_OPTIONS } from '@astro/shared/botIds';

export { INDIA_STATES } from '@astro/shared/states';

export { CLIENT_NAMES, appCodeForName };

export const APP_OPTIONS = CLIENT_NAMES.map((name) => ({
  value: name,
  label: appCodeForName(name),
}));
