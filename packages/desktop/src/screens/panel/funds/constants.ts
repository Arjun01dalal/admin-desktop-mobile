/** Mobiles that see Funds "Update Access" / Edit (laxminarayan SHOW_FUND_EDIT_BTN). */
export const SHOW_FUND_EDIT_BTN = [
  '9561139951',
  '7477022767',
  '9608010101',
  '9373114572',
  '8208684855',
] as const;

/** Role names included when picking users for gateway access (Laxmi FUND_EDIT_ACCESS). */
export const FUND_EDIT_ACCESS = [
  'Full Access',
  'checker_new',
  'head_checker_new',
  'qa_new',
  'accounts_new',
  'checker_new + checker_report',
  'caller_head_new',
  'checker_new + checker_report + withd',
  'caller_head_new_&_deposit_sum',
  'caller_head_new_and_download_funds',
] as const;

export function canShowFundEditBtn(mobile?: string | null): boolean {
  const m = String(mobile || '').trim();
  return (SHOW_FUND_EDIT_BTN as readonly string[]).includes(m);
}
