export const CALL_STATUS_OPTIONS = ['All', 'completed', 'no-answer', 'Not Received'] as const;

export const BOT_STATUS_KEYS = [
  'no-answer',
  'completed',
  'in-progress',
  'failed',
  'busy',
  'queued',
  'deleted',
] as const;

export const BOT_STATUS_LABELS: Record<(typeof BOT_STATUS_KEYS)[number], string> = {
  'no-answer': 'No-Answer',
  completed: 'Completed',
  'in-progress': 'In-Progress',
  failed: 'Failed',
  busy: 'Busy',
  queued: 'Queued',
  deleted: 'Deleted',
};

export const COMMENT_FILTER_OPTIONS = [
  'All',
  'Call Back',
  'Call Disconnect',
  'Do Not Call',
  'Finance Issue',
  'Interested',
  'Link Send',
  'Not Getting Time',
  'Not Interested',
  'Not Responding',
  'Call Received By Another Person',
  'Number Busy',
  'Out of Network',
  'Out of Service',
  'Play After Some Time',
  'Player Busy',
  'Player Not Avaliable',
  'Playing Customer',
  'Playing in Another App',
  'Switch Off',
  'Invalid Number',
  'Not Answer',
  'Money Issue',
  'Demo User',
  'User Block',
  'Call Transfer',
] as const;

/** Bot IDs 1–150 */
export const BOT_ID_OPTIONS = Array.from({ length: 150 }, (_, i) => String(i + 1));

export const POLL_INTERVAL_MS = 20_000;

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
