/** Call Logs status filter options. */
export const CALL_STATUS_OPTIONS = [
  'All',
  'completed',
  'no-answer',
  'Not Received',
] as const;

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

/** Call Logs comment filter / dialler comment chips. */
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

export const CALL_LOGS_POLL_INTERVAL_MS = 20_000;
