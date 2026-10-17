/**
 * Caller / caller-head Role_IDs and related constants.
 * Shared by desktop + mobile permission / nav logic.
 *
 * Store Role_IDs only — never role display names in these collections.
 */

/** Global caller-head Role_ID list (IDs only). */
export const CALLER_HEAD = [
  '6aa555b6719a326039062bb2',
  '6aa173675a27a3cd3f30fb88',
  '6ad2439374fc2149f8121ccd',
  '6972104ee8e409d797e793c3',
  '68cec78a752033c0eb673e56',
  '6862429e3cc84c862f86c14a',
] as const;

/** Set view of {@link CALLER_HEAD} for O(1) membership checks. */
export const CALLER_HEAD_ROLE_IDS = new Set<string>(CALLER_HEAD);

export const CALLER_ROLE_IDS = new Set([
  '68945961c99bca8bbc8b61ed',
  '6864ced73cc84c862f86c17f',
  '694c2f99a8b2fd753572f671',
]);

/** Only this role's lists are auto-filtered by login empCode (admin-panel-domains). */
export const EMPCODE_LIST_FILTER_ROLE_ID = '6864ced73cc84c862f86c17f';

export const FULL_ALLOTMENT_ROLE_IDS = new Set(['68c29196001c4b3d02b1aa32']);

export const OFFICE_LOCATIONS = ['Dubai', 'Nagpur', 'Nagpur/Dubai'] as const;

export const RESP_TOTAL_DEPOSIT = 'Caller_Allotment_Total_Deposit';
export const RESP_SHOW_MOBILE = 'show_mobile';

export type CallerRow = Record<string, unknown>;
