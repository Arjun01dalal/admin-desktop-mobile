/** Re-export shared Bot Data constants (single source in @astro/shared). */
export {
  BOT_DATA_BOT_IDS,
  BOT_ID_RANGE_OPTIONS,
  PLAY_IN_CODES,
  PLAY_IN_FILTER_OPTIONS,
  type BotDataBotId,
  type PlayInCode,
} from '@astro/shared/botIds';

/** @deprecated Prefer PLAY_IN_CODES — kept for existing Bot Data imports. */
export { PLAY_IN_CODES as PLAY_IN_OPTIONS } from '@astro/shared/botIds';
