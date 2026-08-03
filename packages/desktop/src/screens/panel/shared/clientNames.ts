/** App / client names used across filter dropdowns (from laxminarayan Enums). */
export const CLIENT_NAMES = [
  'OSGames',
  'SMGames',
  'ABGames',
  'PSGames',
  'KSGames',
  'PMGames',
  'LSGames',
  'LMGames',
  'SGGames',
  'SBGames',
  'OMGames',
  'SB247Games',
  'FBGames',
] as const;

export const CLIENT_NAME_OPTIONS = CLIENT_NAMES.map((name) => ({
  value: name,
  label: name,
}));
