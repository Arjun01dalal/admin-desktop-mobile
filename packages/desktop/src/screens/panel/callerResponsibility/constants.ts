/**
 * Caller role constants — re-exported from @astro/shared (single source of truth).
 */
export {
  CALLER_HEAD,
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
  FULL_ALLOTMENT_ROLE_IDS,
  OFFICE_LOCATIONS,
  DUBAI_MYSORE_OFFICE_LOCATIONS,
  RESP_TOTAL_DEPOSIT,
  RESP_SHOW_MOBILE,
  DUBAI_MYSORE_ROLE_ID,
  BOT_MANAGEMENT_ROLE_ID,
  officeLocationsForRole,
  isDubaiMysoreRole,
  isDubaiOrMysoreOffice,
  isGtelAssignedCxRole,
  assignedCallerNameCandidates,
  matchesCallerHeadName,
  buildDepositByEmpcodeOfficeBody,
  filterCallerResponsibilityRows,
  filterOfficeLocationRows,
  type CallerRow,
} from '@astro/shared/callerRoles';
