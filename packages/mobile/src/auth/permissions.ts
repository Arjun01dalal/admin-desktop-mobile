/**
 * Mobile permissions adapter — session storage + re-exports from @astro/shared.
 * Edit permission rules in packages/shared/src/permissions.ts (shared with desktop).
 */
import { appStorage, getStoredUser } from '../lib/webShim';
import { persistUser } from '../lib/secureStorage';
import type { AuthUser } from '../types/auth';
import {
  Permissions,
  type Permission,
  type PermissionStorage,
  type PermissionUser,
  type SosFlagType,
  DASHBOARD_ROLE_IDS,
  buildSosEnablePayload as sharedBuildSosEnablePayload,
  canAccessDashboard as sharedCanAccessDashboard,
  canAccessNavItem as sharedCanAccessNavItem,
  canEditMidLimits as sharedCanEditMidLimits,
  canShowSos as sharedCanShowSos,
  canViewMidLimits as sharedCanViewMidLimits,
  deriveRoleNameFromLogin,
  getResponsibilities as sharedGetResponsibilities,
  getRoleId as sharedGetRoleId,
  getRoleName as sharedGetRoleName,
  getSosTypeForRole as sharedGetSosTypeForRole,
  hasPermission as sharedHasPermission,
  isCallerRole as sharedIsCallerRole,
  isPathAllowed,
  isSosExemptRole as sharedIsSosExemptRole,
  canShowUniqueDepositEmpCode as sharedCanShowUniqueDepositEmpCode,
} from '@astro/shared/permissions';

export {
  Permissions,
  type Permission,
  type PermissionUser,
  type SosFlagType,
  DASHBOARD_ROLE_IDS,
  isPathAllowed,
  deriveRoleNameFromLogin,
};

type StoredUser = AuthUser & PermissionUser;

const storage: PermissionStorage = {
  getRoleId: () => appStorage.getItem('role_id'),
  getRoleName: () => appStorage.getItem('role'),
};

export function getSessionUser(): StoredUser | null {
  return getStoredUser<StoredUser>();
}

export function getRoleId(
  user: { Role_ID?: string } | null | undefined = getSessionUser(),
): string {
  return sharedGetRoleId(user, storage);
}

export function getRoleName(
  user: Parameters<typeof sharedGetRoleName>[0] = getSessionUser(),
): string {
  return sharedGetRoleName(user, storage);
}

export function persistRoleFromLogin(user: AuthUser): void {
  const name = deriveRoleNameFromLogin(user as PermissionUser);
  if (name) appStorage.setItem('role', name);
}

export function updateStoredResponsibilities(next: string[]): void {
  const user = getSessionUser();
  if (!user) return;
  const updated = { ...user, Responsibilities: next };
  const userJson = JSON.stringify(updated);
  appStorage.setItem('user', userJson);
  void persistUser(userJson);
}

export function getResponsibilities(
  user: StoredUser | null = getSessionUser(),
): string[] {
  return sharedGetResponsibilities(user);
}

export function hasPermission(
  permission: string | undefined,
  user: StoredUser | null = getSessionUser(),
): boolean {
  return sharedHasPermission(permission, user);
}

export function canAccessDashboard(
  user: StoredUser | null = getSessionUser(),
): boolean {
  return sharedCanAccessDashboard(user, storage);
}

export function isCallerRole(user: StoredUser | null = getSessionUser()): boolean {
  return sharedIsCallerRole(user, storage);
}

export function canAccessNavItem(
  item: { id: string; permission?: string },
  user: StoredUser | null = getSessionUser(),
): boolean {
  return sharedCanAccessNavItem(item, user, storage);
}

export function canViewMidLimits(user: StoredUser | null = getSessionUser()): boolean {
  return sharedCanViewMidLimits(user, storage);
}

export function canEditMidLimits(user: StoredUser | null = getSessionUser()): boolean {
  return sharedCanEditMidLimits(user, storage);
}

export function canShowSos(user: StoredUser | null = getSessionUser()): boolean {
  return sharedCanShowSos(user);
}

export function getSosTypeForRole(
  user: StoredUser | null = getSessionUser(),
): SosFlagType {
  return sharedGetSosTypeForRole(user, storage);
}

export function buildSosEnablePayload(
  user: StoredUser | null = getSessionUser(),
): ReturnType<typeof sharedBuildSosEnablePayload> {
  return sharedBuildSosEnablePayload(user, storage);
}

export function isSosExemptRole(
  user: StoredUser | null = getSessionUser(),
): boolean {
  return sharedIsSosExemptRole(user, storage);
}

export function canShowUniqueDepositEmpCode(
  user: StoredUser | null = getSessionUser(),
): boolean {
  return sharedCanShowUniqueDepositEmpCode(user, storage);
}
