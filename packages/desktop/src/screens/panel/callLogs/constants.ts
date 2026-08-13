export {
  CALL_STATUS_OPTIONS,
  BOT_STATUS_KEYS,
  BOT_STATUS_LABELS,
  COMMENT_FILTER_OPTIONS,
  CALL_LOGS_POLL_INTERVAL_MS as POLL_INTERVAL_MS,
} from '@astro/shared/callLogs';

export { BOT_ID_RANGE_OPTIONS as BOT_ID_OPTIONS } from '@astro/shared/botIds';

/** Title-case language labels used by Call Logs UI (not dialler lowercase map). */
export const STATE_LANGUAGE_MAP: Record<string, string> = {
  Maharashtra: 'Marathi',
  Gujarat: 'Gujarati',
  'Tamil Nadu': 'Tamil',
  Karnataka: 'Kannada',
  'Andhra Pradesh': 'Telugu',
  Telangana: 'Telugu',
  Kerala: 'Malayalam',
  Punjab: 'Punjabi',
  'West Bengal': 'Bengali',
};
