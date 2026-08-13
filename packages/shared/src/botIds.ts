/** Curated Bot IDs for Bot Data (admin-panel-domains `BOT_ID`). */
export const BOT_DATA_BOT_IDS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '31',
  '33',
  '34',
  '39',
  '46',
  '47',
  '55',
  '56',
  '63',
  '64',
  '65',
  '69',
  '73',
  '74',
  '84',
  '85',
  '86',
  '92',
  '97',
  '104',
  '105',
  '106',
  '114',
  '126',
] as const;

export type BotDataBotId = (typeof BOT_DATA_BOT_IDS)[number];

/** Bot IDs 1–150 (Call Logs / dialler pickers). */
export const BOT_ID_RANGE_OPTIONS = Array.from({ length: 150 }, (_, i) =>
  String(i + 1),
);

/** Play-in filter codes used on Bot Data / New Registers / Users. */
export const PLAY_IN_CODES = ['C', 'E', 'S'] as const;

export type PlayInCode = (typeof PLAY_IN_CODES)[number];

export const PLAY_IN_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'E', label: 'E' },
  { value: 'C', label: 'C' },
  { value: 'S', label: 'S' },
] as const;
