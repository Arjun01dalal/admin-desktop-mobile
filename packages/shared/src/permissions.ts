/**
 * Shared permissions / role / nav-access logic for desktop + mobile.
 * No DOM / localStorage here — platforms pass session user (+ optional storage).
 */
import { CALLER_HEAD_ROLE_IDS, CALLER_ROLE_IDS } from './callerRoles';

/** Minimal user shape used by permission helpers (AuthUser-compatible). */
export type PermissionUser = {
  _id?: string;
  mobile?: string;
  Role_ID?: string;
  Role_Name?: string;
  Responsibilities?: unknown;
  responsibilities?: unknown;
  role?: unknown;
  roleName?: unknown;
  roles?: unknown;
  Role?: unknown;
  officeLocation?: unknown;
  location?: unknown;
  [key: string]: unknown;
};

/** Optional platform storage for persisted role keys (localStorage / AsyncStorage shim). */
export type PermissionStorage = {
  getRoleId?: () => string | null | undefined;
  getRoleName?: () => string | null | undefined;
};

/** Permission strings assigned to a Role_ID on the backend (login `Responsibilities`). */
export const Permissions = {
  View_Dashboard: 'View_Dashboard',
  risk_management_analysis: 'risk_management_analysis',
  analytics_tab: 'analytics_tab',
  master_flow: 'master_flow',
  View_Profit_and_Loss: 'View_Profit_and_Loss',
  caller_responsibility: 'caller_responsibility',
  player_activity: 'player_activity',
  game_activity: 'game_activity',
  call_logs: 'call_logs',
  new_registrations: 'new_registrations',
  Login_Report: 'Login_Report',
  login_logout_report: 'login_logout_report',
  /** Show SOS Blocked Users page in side nav. */
  sos_blocked_users: 'sos_blocked_users',
  Checkers_Report: 'Checkers_Report',
  sheet_downlaod_report: 'sheet_downlaod_report',
  coin_report: 'coin_report',
  Coin_Removal: 'Coin_Removal',
  Mobile_App: 'Mobile_App',
  My_Customers: 'My_Customers',
  customer_allotment: 'customer_allotment',
  Non_Performing_User: 'Non_Performing_User',
  todays_active: 'todays_active',
  View_Feedback: 'View_Feedback',
  Edit_Feedback: 'Edit_Feedback',
  View_Games: 'View_Games',
  View_KYCs: 'View_KYCs',
  View_Banners: 'View_Banners',
  Add_Banner: 'Add_Banner',
  Toggle_Banner: 'Toggle_Banner',
  Delete_Banner: 'Delete_Banner',
  View_UPIs: 'View_UPIs',
  Add_UPI: 'Add_UPI',
  Toggle_UPI: 'Toggle_UPI',
  View_PayIn_Accounts: 'View_PayIn_Accounts',
  Add_PayIn_Account: 'Add_PayIn_Account',
  Toggle_PayIn_Account: 'Toggle_PayIn_Account',
  Delete_PayIn_Account: 'Delete_PayIn_Account',
  Disable_Deposit_Provider_Edit: 'Disable_Deposit_Provider_Edit',
  Update_Deposit_Amount_Edit: 'Update_Deposit_Amount_Edit',
  Deposit_Config: 'Deposit_Config',
  show_gateway_and_total: 'show_gateway_and_total',
  show_gateway_only: 'show_gateway_only',
  show_whatsapp_messages: 'show_whatsapp_messages',
  View_PayOut_Accounts: 'View_PayOut_Accounts',
  Add_PayOut_Account: 'Add_PayOut_Account',
  Toggle_PayOut_Account: 'Toggle_PayOut_Account',
  Delete_PayOut_Account: 'Delete_PayOut_Account',
  bot_data_upload: 'bot_data_upload',
  bot_performance: 'bot_performance',
  show_incoming_bot: 'show_incoming_bot',
  View_Roles_and_Responsibilities: 'View_Roles_and_Responsibilities',
  Edit_Role: 'Edit_Role',
  Delete_Role: 'Delete_Role',
  add_new_role_responsibility: 'add_new_role_responsibility',
  casino_switch: 'casino_switch',
  casino_delete_button: 'casino_delete_button',
  view_casino_balance: 'view_casino_balance',
  hide_show_games: 'hide_show_games',
  house_game: 'house_game',
  View_Deposit_List: 'View_Deposit_List',
  Bonus_Wallet_Fund_Request: 'Bonus_Wallet_Fund_Request',
  Bonus_Wallet_Request: 'Bonus_Wallet_Request',
  View_Deposits_Approved_Report: 'View_Deposits_Approved_Report',
  Unique_Deposit_Pending_User: 'Unique_Deposit_Pending_User',
  View_Deposits: 'View_Deposits',
  View_Withdrawals: 'View_Withdrawals',
  withdrawal_fund: 'withdrawal_fund',
  Fund_Request: 'Fund_Request',
  View_Fund_Deposit: 'View_Fund_Deposit',
  Excel: 'Excel',
  State_Wise_Deposit: 'State_Wise_Deposit',
  update_deposit_mid: 'update_deposit_mid',
  withdrawals_button: 'withdrawals_button',
  View_Reject: 'View_Reject',
  View_Reverse: 'View_Reverse',
  Download_Withdrawal: 'Download_Withdrawal',
  show_all_withdrawal: 'show_all_withdrawal',
  View_Delay_Reason: 'View_Delay_Reason',
  Disable_Withdrawals_Check: 'Disable_Withdrawals_Check',
  change_status: 'change_status',
  show_mobile: 'show_mobile',
  contact_visibility_none: 'contact_visibility_none',
  show_download_botton: 'show_download_botton',
  whatsapp_icon: 'whatsapp_icon',
  UPI_Payment: 'UPI_Payment',
  Deposit_Pensil: 'Deposit_Pensil',
  Utr_Provider: 'Utr_Provider',
  player_rtp: 'player_rtp',
  View_Users: 'View_Users',
  wallet_history: 'wallet_history',
  show_profit_loss: 'show_profit_loss',
  showCoinButton: 'showCoinButton',
  showRemoveCoin: 'showRemoveCoin',
  show_back_date: 'show_back_date',
  Register_New_User: 'Register_New_User',
  create_new_user: 'create_new_user',
  user_table: 'user_table',
  All_user_table: 'All_user_table',
  user_tab_with_search_only: 'user_tab_with_search_only',
  View_Subadmin_User: 'View_Subadmin_User',
  add_to_bot: 'add_to_bot',
  /** Backend typo — must match Responsibilities string */
  add_to_dilaler: 'add_to_dilaler',
  show_user_upload_data: 'show_user_upload_data',
  caller_allotment: 'caller_allotment',
  Percentage: 'Percentage',
  New_Deposits: 'New_Deposits',
  Social_Media: 'Social_Media',
  /** Set Whatsapp Mid page (admin-panel WhatsappMid). */
  set_whatsapp_limit: 'set_whatsapp_limit',
  /** AAA Fraud Bet Report (external nodeadmin). */
  show_aaa_fraud_bets: 'show_aaa_fraud_bets',
  /** AAA Black Listed Users (external nodeadmin). */
  show_aaa_blacklist_user: 'show_aaa_blacklist_user',
  caller_leaderboard_tab: 'caller_leaderboard_tab',
  /** Backend typo — must match Responsibilities string */
  state_wise_registartion: 'state_wise_registartion',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/** Roles that stay in the panel when SOS is active (can unblock). */
const SOS_EXEMPT_ROLE_NAMES = new Set([
  'full_access',
  'fullaccess',
  'dev_full_access',
  'devfullaccess',
  'qa_new',
  'qanew',
]);

/** Known Role_IDs for SOS-exempt roles — panel stays logged in when SOS locks. */
const SOS_EXEMPT_ROLE_IDS = new Set<string>([
  '64f710d9a2ab78980020c5fb',
  '68677d68598bcfdd1393885b', // qa_new
  '6a33c137a6558491e0d20464',
]);

/** SOS payload `type` values expected by `/SubAdmin/sos-flag`. */
export type SosFlagType = 'individual' | 'office-based' | 'all';

/** Role_IDs that send SOS as `type: "all"`. */
const SOS_TYPE_ALL_ROLE_IDS = new Set<string>([
  '64f710d9a2ab78980020c5fb',
  '6a33c137a6558491e0d20464',
  '68677d68598bcfdd1393885b',
  '658a877056138bb0bc4eba35',
]);

/** Role_IDs that send SOS as `type: "office-based"` (+ location). */
const SOS_TYPE_OFFICE_ROLE_IDS = new Set<string>([
  '6862429e3cc84c862f86c14a',
  '686385ae3cc84c862f86c159',
  '686385d83cc84c862f86c15a',
  '687e3a0729c8faf0071a89ed',
  '68809af929c8faf0071a8a20',
  '68ad566d752033c0eb673b95',
  '68cec78a752033c0eb673e56',
  '6905e23abc805e57b6855913',
  '6972104ee8e409d797e793c3',
  '6994bc5d38a4bf7ee841daa8',
  '69f34657f096f799a6e5dda7',
]);

/**
 * Legacy dashboard Role_ID allowlist — Dashboard / VIP / Combined only for these roles
 * (plus a few hardcoded admin mobiles / user ids below).
 */
export const DASHBOARD_ROLE_IDS = new Set([
  '64f710d9a2ab78980020c5fb',
  '658a877056138bb0bc4eba35',
  '6573276a7c03a8bc31bbd73a',
  '6a33c137a6558491e0d20464',
]);

const DASHBOARD_USER_IDS = new Set([
  '6731ad174135e8451278cc2d',
  '65a2bbfdb8f4709a49533cfe',
  '673393092672286809771eca',
  '673dda1a7f3d4038f7c2d7ab',
]);

const DASHBOARD_MOBILES = new Set([
  '9536952171',
  '9536952170',
  '9990099909',
]);

/** Hard menu allowlists by Role_ID — when set, only these nav ids can appear
 *  (plus any item whose Responsibility is granted — see canAccessNavItem). */
const ROLE_NAV_ALLOWLIST: Record<string, readonly string[]> = {
  // caller / caller_new — Bot Performance + State wise Registration hidden
  '68945961c99bca8bbc8b61ed': [
    'welcome',
    'callerResponsibility',
    'callLogs',
    'newRegisters',
    'users',
    'mobileApp',
  ],
  '6864ced73cc84c862f86c17f': [
    'welcome',
    'callerResponsibility',
    'callLogs',
    'newRegisters',
    'users',
    'mobileApp',
  ],
  '694c2f99a8b2fd753572f671': [
    'welcome',
    'callerResponsibility',
    'callLogs',
    'newRegisters',
    'users',
    'mobileApp',
  ],
};

function normalizeRoleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, '&')
    .replace(/[-\s]+/g, '_')
    .replace(/_+/g, '_');
}

function roleNameVariants(value: string): string[] {
  const raw = value.trim().toLowerCase();
  const underscored = raw.replace(/[\s-]+/g, '_');
  const spaced = raw.replace(/[_-]/g, ' ');
  const compact = raw.replace(/[\s_-]+/g, '');
  const ampersand = raw.replace(/\s*&\s*/g, '&');
  return Array.from(
    new Set([raw, underscored, spaced, compact, ampersand, normalizeRoleName(value)]),
  );
}

export function getRoleId(
  user: { Role_ID?: string } | null | undefined = null,
  storage?: PermissionStorage | null,
): string {
  return String(user?.Role_ID || storage?.getRoleId?.() || '');
}

/** Role display/key name from login multi-role map or stored `role`. */
export function getRoleName(
  user:
    | {
        Role_ID?: string;
        Role_Name?: string;
        role?: unknown;
        roleName?: unknown;
        roles?: unknown;
      }
    | null
    | undefined = null,
  storage?: PermissionStorage | null,
): string {
  const stored = storage?.getRoleName?.();
  if (stored) return stored;

  if (typeof user?.Role_Name === 'string' && user.Role_Name.trim()) {
    return user.Role_Name;
  }

  const direct = user?.role ?? user?.roleName;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const roles = user?.roles;
  if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
    const roleId = getRoleId(user, storage);
    for (const [name, id] of Object.entries(roles as Record<string, unknown>)) {
      if (String(id) === roleId) return name;
      // Inverted map: Role_ID → name
      if (String(name) === roleId && typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }
    const keys = Object.keys(roles as object);
    if (keys.length === 1) return keys[0];
  }

  return '';
}

/**
 * Derive role name from a login user payload (for platforms to persist).
 * Returns '' when no name can be derived.
 */
export function deriveRoleNameFromLogin(user: PermissionUser): string {
  const roles = user.roles;
  if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
    const map = roles as Record<string, string>;
    const roleId = String(user.Role_ID || '');
    const matched = Object.entries(map).find(([, id]) => String(id) === roleId);
    if (matched) return matched[0];
    if (roleId && typeof map[roleId] === 'string' && map[roleId].trim()) {
      return map[roleId].trim();
    }
    const keys = Object.keys(map);
    if (keys.length === 1) return keys[0];
  }

  const named = user.Role_Name || user.role || user.roleName;
  if (typeof named === 'string' && named.trim()) return named.trim();
  return '';
}

export function getResponsibilities(user: PermissionUser | null = null): string[] {
  const raw =
    user?.Responsibilities ??
    (user as { responsibilities?: unknown } | null)?.responsibilities;

  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        // Prefer Enum (Permissions.*) over display Name.
        const named =
          obj.Enum ?? obj.enum ?? obj.name ?? obj.Name ?? obj.key ?? obj.Key;
        if (named != null && String(named).trim()) return String(named).trim();
      }
      return '';
    })
    .filter(Boolean);
}

/** Backend Name/Enum typos that should still unlock matching menus. */
const PERMISSION_ALIASES: Record<string, string[]> = {
  state_wise_registartion: [
    'state_wise_registartion',
    'state_wise_registration',
    'state_wise_registtration',
    'State wise Registration',
    'State Wise Registration',
  ],
  bot_performance: [
    'bot_performance',
    'botPerformance',
    'Bot Performance',
    'Bot_Performance',
  ],
  bot_data_upload: [
    'bot_data_upload',
    'botData',
    'Bot Data',
    'bot_data',
  ],
  hide_show_games: [
    'hide_show_games',
    'Hide_Show_Games',
    'top_games',
    'Top Games',
    'Top_Games',
    // Same audience as Casino Games — unlock when View_Games is granted.
    'View_Games',
  ],
  View_Deposit_List: [
    'View_Deposit_List',
    'view_deposit_list',
    'Deposit_List',
    'Deposit List',
    // Same audience as Deposit — unlock when View_Deposits is granted.
    'View_Deposits',
  ],
  casino_switch: [
    'casino_switch',
    'Casino_Switch',
    'Casino Switch',
    'View_Games',
  ],
  show_whatsapp_messages: [
    'show_whatsapp_messages',
    'Show_Whatsapp_Messages',
    'whatsapp',
    'Whatsapp',
  ],
  view_casino_balance: [
    'view_casino_balance',
    'View_Casino_Balance',
    'casino_topup',
    'Casino Top-up Balance',
  ],
  show_profit_loss: [
    'show_profit_loss',
    'Show_Profit_Loss',
    'showProfitLoss',
    'Show Profit Loss',
    'profit_loss',
    'Profit_Loss',
    'Profit Loss',
  ],
};

function normalizeResponsibility(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isStateWiseRegistrationKey(value?: string): boolean {
  if (!value) return false;
  const normalized = normalizeResponsibility(value);
  return (
    normalized.includes('statewise') &&
    (normalized.includes('regist') || normalized.includes('register'))
  );
}

function permissionMatches(required: string, list: string[]): boolean {
  // Match laxminarayan Private_Route: unlock despite Enum typos / ObjectId mismatch.
  if (isStateWiseRegistrationKey(required)) return true;

  // Bot Performance: laxminarayan route is ungated; unlock for nav consistently.
  if (normalizeResponsibility(required) === 'botperformance') return true;

  if (list.includes(required)) return true;

  const requiredNormalized = normalizeResponsibility(required);
  if (list.some((item) => normalizeResponsibility(item) === requiredNormalized)) {
    return true;
  }

  const aliases = PERMISSION_ALIASES[required];
  if (
    aliases?.some(
      (name) =>
        list.includes(name) ||
        list.some((item) => normalizeResponsibility(item) === normalizeResponsibility(name)),
    )
  ) {
    return true;
  }

  return false;
}

/** True if the role may access a permission-gated nav item. */
export function hasPermission(
  permission: string | undefined,
  user: PermissionUser | null = null,
): boolean {
  if (!permission) return true;
  return permissionMatches(permission, getResponsibilities(user));
}

export function canAccessDashboard(
  user: PermissionUser | null = null,
  storage?: PermissionStorage | null,
): boolean {
  const roleId = getRoleId(user, storage);
  if (roleId && DASHBOARD_ROLE_IDS.has(roleId)) return true;
  if (user?._id && DASHBOARD_USER_IDS.has(String(user._id))) return true;
  if (user?.mobile && DASHBOARD_MOBILES.has(String(user.mobile))) return true;
  return false;
}

function roleAllowlist(
  user: PermissionUser | null,
  storage?: PermissionStorage | null,
): readonly string[] | null {
  const roleId = getRoleId(user, storage);
  if (roleId && ROLE_NAV_ALLOWLIST[roleId]) return ROLE_NAV_ALLOWLIST[roleId];

  // Fallback for caller Role_IDs added later in CALLER_ROLE_IDS
  if (roleId && CALLER_ROLE_IDS.has(roleId) && !CALLER_HEAD_ROLE_IDS.has(roleId)) {
    return ROLE_NAV_ALLOWLIST['6864ced73cc84c862f86c17f'];
  }

  const name = getRoleName(user, storage);
  if (roleNameVariants(name).some((v) => v === 'caller' || v === 'caller_new')) {
    return ROLE_NAV_ALLOWLIST['6864ced73cc84c862f86c17f'];
  }

  return null;
}

/** Full-access admins should see every nav item (backend role may omit newly added Responsibilities). */
function isFullAccessNavRole(
  user: PermissionUser | null,
  storage?: PermissionStorage | null,
): boolean {
  const roleId = getRoleId(user, storage);
  if (
    roleId === '64f710d9a2ab78980020c5fb' ||
    roleId === '6a33c137a6558491e0d20464' ||
    roleId === '68677d68598bcfdd1393885b' // qa_new
  ) {
    return true;
  }

  for (const candidate of collectRoleNameCandidates(user, storage)) {
    const normalized = normalizeRoleName(candidate);
    if (
      normalized === 'full_access' ||
      normalized === 'dev_full_access' ||
      normalized === 'qa_new' ||
      normalized.endsWith('_full_access') ||
      normalized.includes('dev_full_access')
    ) {
      return true;
    }
  }
  return false;
}

/** True for plain Caller roles (not Caller Head). */
export function isCallerRole(
  user: PermissionUser | null = null,
  storage?: PermissionStorage | null,
): boolean {
  const roleId = getRoleId(user, storage);
  if (roleId && CALLER_HEAD_ROLE_IDS.has(roleId)) return false;
  if (roleId && CALLER_ROLE_IDS.has(roleId)) return true;
  const name = getRoleName(user, storage);
  return roleNameVariants(name).some((v) => v === 'caller' || v === 'caller_new');
}

/** Final nav visibility: Role_ID allowlist + Responsibilities + dashboard Role_ID gate. */
export function canAccessNavItem(
  item: { id: string; permission?: string },
  user: PermissionUser | null = null,
  storage?: PermissionStorage | null,
): boolean {
  // Callers must not see these tabs (even if Responsibilities / legacy unlocks say otherwise).
  if (
    isCallerRole(user, storage) &&
    (item.id === 'botPerformance' || item.id === 'stateWiseRegistration')
  ) {
    return false;
  }

  // Ungated items (Welcome) — always in the drawer for every role except caller-hidden ids above.
  if (!item.permission && item.id !== 'botPerformance') return true;

  // Always show Bot Performance for non-callers (laxminarayan App.tsx mounts it without Responsibility).
  if (item.id === 'botPerformance') return true;

  // Full / dev / QA access — show the complete menu without waiting on new Responsibility rows.
  if (isFullAccessNavRole(user, storage)) return true;

  const allow = roleAllowlist(user, storage);
  // Hard role allowlist is the base set (e.g. callers). Also honor Responsibilities
  // so pages unlock when the backend grants the permission.
  if (allow) {
    if (allow.includes(item.id)) return true;
    if (item.permission && hasPermission(item.permission, user)) return true;
    return false;
  }

  if (
    item.id === 'dashboard' ||
    item.id === 'vipDashboard' ||
    item.id === 'combinedDashboard'
  ) {
    if (!canAccessDashboard(user, storage)) return false;
  }

  return hasPermission(item.permission, user);
}

/** SOS button is available for every logged-in role. */
export function canShowSos(_user: PermissionUser | null = null): boolean {
  return true;
}

/** Resolve SOS type from the logged-in Role_ID (default: individual). */
export function getSosTypeForRole(
  user: PermissionUser | null = null,
  storage?: PermissionStorage | null,
): SosFlagType {
  const roleId = getRoleId(user, storage);
  if (roleId && SOS_TYPE_ALL_ROLE_IDS.has(roleId)) return 'all';
  if (roleId && SOS_TYPE_OFFICE_ROLE_IDS.has(roleId)) return 'office-based';
  return 'individual';
}

/**
 * Build `/SubAdmin/sos-flag` enable payload from Role_ID.
 * - all → `{ enabled, type: "all" }`
 * - office-based → `{ enabled, type, location }` (from user.officeLocation)
 * - individual → `{ enabled, type, targetCallerId }` (user._id)
 */
export function buildSosEnablePayload(
  user: PermissionUser | null = null,
  storage?: PermissionStorage | null,
): { ok: true; payload: Record<string, unknown> } | { ok: false; message: string } {
  const type = getSosTypeForRole(user, storage);
  const payload: Record<string, unknown> = {
    enabled: true,
    type,
  };

  if (type === 'individual') {
    const targetCallerId = String(user?._id || '').trim();
    if (!targetCallerId) {
      return { ok: false, message: 'Missing user id for individual SOS' };
    }
    payload.targetCallerId = targetCallerId;
  } else if (type === 'office-based') {
    const location = String(
      user?.officeLocation || user?.location || '',
    ).trim();
    if (!location) {
      return { ok: false, message: 'Office location is required for office-based SOS' };
    }
    payload.location = location;
  }

  return { ok: true, payload };
}

/** These roles stay logged into the panel when SOS lock is active. */
export function isSosExemptRole(
  user: PermissionUser | null = null,
  storage?: PermissionStorage | null,
): boolean {
  const roleId = getRoleId(user, storage);
  if (roleId && SOS_EXEMPT_ROLE_IDS.has(roleId)) return true;

  for (const candidate of collectRoleNameCandidates(user, storage)) {
    if (roleNameVariants(candidate).some((v) => SOS_EXEMPT_ROLE_NAMES.has(v))) {
      return true;
    }
    // Soft match: "Dev Full Access", "dev-full-access", etc.
    const normalized = normalizeRoleName(candidate);
    if (
      normalized === 'full_access' ||
      normalized === 'dev_full_access' ||
      normalized === 'qa_new' ||
      normalized.endsWith('_full_access') ||
      normalized.includes('dev_full_access')
    ) {
      return true;
    }
  }

  return false;
}

/** Gather every place the app may store the active role name. */
function collectRoleNameCandidates(
  user: PermissionUser | null,
  storage?: PermissionStorage | null,
): string[] {
  const out: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) out.push(value.trim());
  };

  push(storage?.getRoleName?.());
  push(getRoleName(user, storage));
  push(user?.Role_Name);
  push(user?.role);
  push(user?.roleName);
  push(user?.Role);

  const roles = user?.roles;
  if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
    for (const [key, value] of Object.entries(roles)) {
      push(key);
      push(value);
    }
  }

  return Array.from(new Set(out));
}

export function isPathAllowed(
  pathname: string,
  allowedPaths: readonly string[],
): boolean {
  if (pathname === '/welcome' || pathname === '/') return true;
  return allowedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
