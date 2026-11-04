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

export const DUBAI_MYSORE_ROLE_ID = '6aa173675a27a3cd3f30fb88';

export const BOT_MANAGEMENT_ROLE_ID = '6994bc5d38a4bf7ee841daa8';

export const GTEL_ASSIGNED_CX_ROLE_IDS = new Set([BOT_MANAGEMENT_ROLE_ID]);

export const OFFICE_LOCATIONS = [
  'Ajman',
  'Dubai',
  'Nagpur',
  'Mysore',
  'Georgia',
  'Nagpur/Dubai',
] as const;

export const DUBAI_MYSORE_OFFICE_LOCATIONS = ['Dubai', 'Mysore'] as const;

export const RESP_TOTAL_DEPOSIT = 'Caller_Allotment_Total_Deposit';
export const RESP_SHOW_MOBILE = 'show_mobile';

export type CallerRow = Record<string, unknown>;

function roleIdValue(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown };
    return String(record._id || record.id || '').trim();
  }
  return String(value ?? '').trim();
}

function assignedCxRoleKey(value: unknown): boolean {
  const key = String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (
    key === 'caller_head_new_and_dialer_data' ||
    key === 'caller_head_new_and_push_notification' ||
    key === 'caller_head_new_and_coin_and_caller_dashboard' ||
    key === 'bot_management'
  );
}

/**
 * Whether this role should be treated as Gtel assigned-CX (admin-panel parity).
 * Callers typically combine with `roleId !== BOT_MANAGEMENT_ROLE_ID`.
 */
export function isGtelAssignedCxRole(
  roleId?: string | null,
  roles?: Record<string, unknown> | null,
  roleName?: unknown,
): boolean {
  const id = String(roleId || '').trim();
  if (id && GTEL_ASSIGNED_CX_ROLE_IDS.has(id)) return true;
  if (assignedCxRoleKey(roleName)) return true;

  if (roles && typeof roles === 'object') {
    for (const [name, value] of Object.entries(roles)) {
      if (!id || roleIdValue(value) === id) {
        if (assignedCxRoleKey(name)) return true;
      }
    }
  }
  return false;
}

export function isDubaiMysoreRole(roleId?: string | null): boolean {
  return String(roleId || '').trim() === DUBAI_MYSORE_ROLE_ID;
}

export function isDubaiOrMysoreOffice(location: unknown): boolean {
  const value = String(location ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  return value === 'dubai' || value === 'mysore' || value === 'myshore';
}

export function officeLocationsForRole(roleId?: string | null): readonly string[] {
  return isDubaiMysoreRole(roleId) ? DUBAI_MYSORE_OFFICE_LOCATIONS : OFFICE_LOCATIONS;
}

/** Match caller-head assignment (array or comma/pipe-separated names). */
export function matchesCallerHeadName(value: unknown, name: unknown): boolean {
  const expected = String(name ?? '')
    .trim()
    .toLowerCase();
  if (!expected || value == null) return false;
  if (String(value).trim().toLowerCase() === 'not assigned') return false;

  const assigned = Array.isArray(value) ? value : String(value).split(/[,|]/);
  return assigned.some((entry) => {
    const normalized = String(entry ?? '')
      .trim()
      .toLowerCase();
    return normalized !== 'not assigned' && normalized === expected;
  });
}

export function assignedCallerNameCandidates(user: {
  name?: unknown;
  realName?: unknown;
  chatName?: unknown;
} | null): string[] {
  return [user?.name, user?.realName, user?.chatName]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
}

export type DepositByEmpcodeOfficeBodyInput = {
  startDate: string;
  endDate: string;
  /** Selected caller-head filter from dropdown (non-head users). */
  callerHead?: string;
  officeLocation?: string;
  roleId?: string | null;
  /** When true, omit callerHead from request (assigned-CX only). */
  assignedOnly?: boolean;
  /** Login user name — used when the role is a caller head (non-assigned). */
  loginName?: string | null;
  isCallerHead?: boolean;
};

/** Build deposit-by-empcode-office request body (admin-panel parity). */
export function buildDepositByEmpcodeOfficeBody(
  input: DepositByEmpcodeOfficeBodyInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    startDate: input.startDate,
    endDate: input.endDate,
  };

  const assignedOnly = Boolean(input.assignedOnly);
  if (!assignedOnly) {
    if (input.isCallerHead) {
      const name = String(input.loginName || '').trim();
      if (name) body.callerHead = name;
    } else {
      const head = String(input.callerHead || '').trim();
      if (head) body.callerHead = head;
    }
  }

  const office = String(input.officeLocation || '').trim();
  if (office) {
    if (!isDubaiMysoreRole(input.roleId) || isDubaiOrMysoreOffice(office)) {
      body.officeLocation = office;
    }
  }

  return body;
}

export type FilterCallerResponsibilityRowsInput = {
  rows: CallerRow[];
  isCaller: boolean;
  loginEmpCode?: string | null;
  /** Hide blocked rows for non-callers. */
  hideBlocked?: boolean;
  limitToDubaiMysore?: boolean;
  assignedOnly?: boolean;
  assignedNames?: readonly string[];
  /** Hide Company office when user cannot see company totals. */
  hideCompany?: boolean;
};

export function filterCallerResponsibilityRows(
  input: FilterCallerResponsibilityRowsInput,
): CallerRow[] {
  const hideBlocked = input.hideBlocked !== false;
  const assignedNames = input.assignedNames || [];

  return input.rows.filter((row) => {
    if (hideBlocked && !input.isCaller && row.block) return false;
    if (input.limitToDubaiMysore && !isDubaiOrMysoreOffice(row.officeLocation)) return false;
    if (input.isCaller) return row.empCode === input.loginEmpCode;
    if (input.assignedOnly) {
      return assignedNames.some((name) => matchesCallerHeadName(row.callerHead, name));
    }
    if (input.hideCompany && row.officeLocation === 'Company') return false;
    return true;
  });
}

export function filterOfficeLocationRows(
  rows: CallerRow[],
  limitToDubaiMysore: boolean,
): CallerRow[] {
  if (!limitToDubaiMysore) return rows;
  return rows.filter((row) => isDubaiOrMysoreOffice(row.officeLocation));
}
