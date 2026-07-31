import { getStoredUser } from '@/utils/dates';
import type { AuthUser } from '@/types/gcalc';
import {
  CALLER_HEAD_ROLE_IDS,
  CALLER_ROLE_IDS,
} from '@/screens/panel/callerResponsibility/constants';

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
  Utr_Provider: 'Utr_Provider',
  player_rtp: 'player_rtp',
  View_Users: 'View_Users',
  wallet_history: 'wallet_history',
  show_profit_loss: 'show_profit_loss',
  showCoinButton: 'showCoinButton',
  showRemoveCoin: 'showRemoveCoin',
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
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/** Role names that must not see the SOS button. */
const SOS_HIDDEN_ROLE_NAMES = new Set([
  'caller',
  'caller_new',
  'user_coin',
  'user&coin',
  'user & coin',
  'userandcoin',
]);

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

/**
 * Known Role_IDs for User & Coin (extend when backend IDs are confirmed).
 * Caller / caller_new IDs live in CALLER_ROLE_IDS.
 */
export const USER_COIN_ROLE_IDS = new Set<string>([
  // Add User & Coin Role_ID(s) here when known
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

/** Hard menu allowlists by Role_ID — when set, only these nav ids can appear. */
const ROLE_NAV_ALLOWLIST: Record<string, readonly string[]> = {
  // caller / caller_new
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

type StoredUser = AuthUser & {
  Responsibilities?: string[];
  Role_Name?: string;
  roles?: Record<string, string>;
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

export function getSessionUser(): StoredUser | null {
  return getStoredUser<StoredUser>();
}

export function getRoleId(user: StoredUser | null = getSessionUser()): string {
  return String(user?.Role_ID || localStorage.getItem('role_id') || '');
}

/** Role display/key name from login multi-role map or stored `role`. */
export function getRoleName(user: StoredUser | null = getSessionUser()): string {
  const stored = localStorage.getItem('role');
  if (stored) return stored;

  if (typeof user?.Role_Name === 'string' && user.Role_Name.trim()) {
    return user.Role_Name;
  }

  const direct = (user as { role?: unknown; roleName?: unknown } | null)?.role
    ?? (user as { roleName?: unknown } | null)?.roleName;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const roles = user?.roles;
  if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
    const roleId = getRoleId(user);
    for (const [name, id] of Object.entries(roles)) {
      if (String(id) === roleId) return name;
      // Inverted map: Role_ID → name
      if (String(name) === roleId && typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }
    const keys = Object.keys(roles);
    if (keys.length === 1) return keys[0];
  }

  return '';
}

/**
 * Persist role name after login when we can derive it.
 * Multi-role users may overwrite this later via change-role.
 */
export function persistRoleFromLogin(user: AuthUser): void {
  const roles = user.roles;
  if (roles && typeof roles === 'object' && !Array.isArray(roles)) {
    const map = roles as Record<string, string>;
    const roleId = String(user.Role_ID || '');
    const matched = Object.entries(map).find(([, id]) => String(id) === roleId);
    if (matched) {
      localStorage.setItem('role', matched[0]);
      return;
    }
    if (roleId && typeof map[roleId] === 'string' && map[roleId].trim()) {
      localStorage.setItem('role', map[roleId].trim());
      return;
    }
    const keys = Object.keys(map);
    if (keys.length === 1) {
      localStorage.setItem('role', keys[0]);
      return;
    }
  }

  const named =
    (user as StoredUser).Role_Name ||
    (user as { role?: string }).role ||
    (user as { roleName?: string }).roleName;
  if (typeof named === 'string' && named.trim()) {
    localStorage.setItem('role', named.trim());
  }
}

/** Write updated Responsibilities back into stored user (after Role_ID sync). */
export function updateStoredResponsibilities(next: string[]): void {
  const user = getSessionUser();
  if (!user) return;
  const updated = { ...user, Responsibilities: next };
  localStorage.setItem('user', JSON.stringify(updated));
  window.dispatchEvent(new Event('gcalc:user-updated'));
}

export function getResponsibilities(
  user: StoredUser | null = getSessionUser(),
): string[] {
  const raw =
    user?.Responsibilities ??
    (user as { responsibilities?: unknown } | null)?.responsibilities;

  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'name' in item) {
        return String((item as { name: unknown }).name);
      }
      return String(item ?? '');
    })
    .filter(Boolean);
}

/** True if the logged-in role may access a permission-gated nav item. */
export function hasPermission(
  permission: string | undefined,
  user: StoredUser | null = getSessionUser(),
): boolean {
  if (!permission) return true;
  const list = getResponsibilities(user);
  return list.includes(permission);
}

export function canAccessDashboard(user: StoredUser | null = getSessionUser()): boolean {
  const roleId = getRoleId(user);
  if (roleId && DASHBOARD_ROLE_IDS.has(roleId)) return true;
  if (user?._id && DASHBOARD_USER_IDS.has(String(user._id))) return true;
  if (user?.mobile && DASHBOARD_MOBILES.has(String(user.mobile))) return true;
  return false;
}

function roleAllowlist(user: StoredUser | null): readonly string[] | null {
  const roleId = getRoleId(user);
  if (roleId && ROLE_NAV_ALLOWLIST[roleId]) return ROLE_NAV_ALLOWLIST[roleId];

  // Fallback for caller Role_IDs added later in CALLER_ROLE_IDS
  if (roleId && CALLER_ROLE_IDS.has(roleId) && !CALLER_HEAD_ROLE_IDS.has(roleId)) {
    return ROLE_NAV_ALLOWLIST['6864ced73cc84c862f86c17f'];
  }

  const name = getRoleName(user);
  if (roleNameVariants(name).some((v) => v === 'caller' || v === 'caller_new')) {
    return ROLE_NAV_ALLOWLIST['6864ced73cc84c862f86c17f'];
  }

  return null;
}

/** Final nav visibility: Role_ID allowlist + Responsibilities + dashboard Role_ID gate. */
export function canAccessNavItem(
  item: { id: string; permission?: string },
  user: StoredUser | null = getSessionUser(),
): boolean {
  const allow = roleAllowlist(user);
  // Hard role allowlist is authoritative (e.g. callers only see listed pages).
  if (allow) return allow.includes(item.id);

  if (
    item.id === 'dashboard' ||
    item.id === 'vipDashboard' ||
    item.id === 'combinedDashboard'
  ) {
    if (!canAccessDashboard(user)) return false;
  }

  return hasPermission(item.permission, user);
}

function roleNameIsSosHidden(roleName: string): boolean {
  if (!roleName) return false;
  return roleNameVariants(roleName).some((v) => SOS_HIDDEN_ROLE_NAMES.has(v));
}

/** SOS is hidden for caller, caller_new, and user&coin. */
export function canShowSos(user: StoredUser | null = getSessionUser()): boolean {
  const roleId = getRoleId(user);
  if (roleId && CALLER_ROLE_IDS.has(roleId)) return false;
  if (roleId && USER_COIN_ROLE_IDS.has(roleId)) return false;
  if (roleNameIsSosHidden(getRoleName(user))) return false;
  return true;
}

/** These roles stay logged into the panel when SOS lock is active. */
export function isSosExemptRole(user: StoredUser | null = getSessionUser()): boolean {
  const roleId = getRoleId(user);
  if (roleId && SOS_EXEMPT_ROLE_IDS.has(roleId)) return true;

  for (const candidate of collectRoleNameCandidates(user)) {
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
function collectRoleNameCandidates(user: StoredUser | null): string[] {
  const out: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) out.push(value.trim());
  };

  push(localStorage.getItem('role'));
  push(getRoleName(user));
  push(user?.Role_Name);
  push((user as { role?: unknown } | null)?.role);
  push((user as { roleName?: unknown } | null)?.roleName);
  push((user as { Role?: unknown } | null)?.Role);

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
