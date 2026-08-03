/** Role id → display name map (ported from laxminarayan Roles_Data.json). */
export const ROLES_DATA: ReadonlyArray<{ _id: string; Name: string }> = [
  { _id: '686242053cc84c862f86c148', Name: 'checker_new' },
  { _id: '686242343cc84c862f86c149', Name: 'head_checker_new' },
  { _id: '6862429e3cc84c862f86c14a', Name: 'caller_head_new' },
  { _id: '686385ae3cc84c862f86c159', Name: 'checker_withdrawal_new' },
  { _id: '686385d83cc84c862f86c15a', Name: 'checker_callerhead_new' },
  { _id: '6864c9d33cc84c862f86c17a', Name: 'support_new' },
  { _id: '6864ced73cc84c862f86c17f', Name: 'caller_new' },
  { _id: '68677d68598bcfdd1393885b', Name: 'qa_new' },
  { _id: '686bb681aa619b0a00f8527e', Name: 'accounts_new' },
  { _id: '686bbadcaa619b0a00f85280', Name: 'banner_new' },
];

export function roleNamesMap(): Record<string, string> {
  return ROLES_DATA.reduce<Record<string, string>>((acc, role) => {
    acc[role._id] = role.Name;
    return acc;
  }, {});
}
