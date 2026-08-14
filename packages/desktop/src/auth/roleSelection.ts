import { secureApi } from '@/api/secureClient';
import type { AuthUser } from '@/types/gcalc';

export type RoleOption = {
  name: string;
  id: string;
};

export function getRoleOptions(user: AuthUser | null | undefined): RoleOption[] {
  const roles = user?.roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) return [];

  return Object.entries(roles as Record<string, unknown>)
    .map(([name, id]) => ({ name: name.trim(), id: String(id || '').trim() }))
    .filter((role) => role.name && role.id);
}

function responsibilityName(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  const value = item as Record<string, unknown>;
  const name = value.Enum ?? value.enum ?? value.name ?? value.Name ?? value.key ?? value.Key;
  return name == null ? '' : String(name).trim();
}

function extractResponsibilities(data: unknown): string[] {
  let value = data;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    value =
      object.payload ??
      object.Responsibilities ??
      object.responsibilities ??
      object.data ??
      value;
  }
  return Array.isArray(value) ? value.map(responsibilityName).filter(Boolean) : [];
}

/**
 * Apply one role from the login `roles` map, matching Laxmi's change-role flow.
 * The selected Role_ID is persisted too because this client has Role_ID-based
 * guards in addition to Responsibility checks.
 */
export async function selectActiveRole(
  user: AuthUser,
  role: RoleOption,
): Promise<AuthUser> {
  const response = await secureApi('auth.getResponsibility', {
    roleId: role.id,
    Role_ID: role.id,
  });
  if (!response.ok) {
    throw new Error(response.message || 'Failed to load role permissions');
  }

  const nextUser: AuthUser = {
    ...user,
    Role_ID: role.id,
    Role_Name: role.name,
    Responsibilities: extractResponsibilities(response.data),
  };

  localStorage.setItem('role_id', role.id);
  localStorage.setItem('role', role.name);
  localStorage.setItem('user', JSON.stringify(nextUser));
  window.dispatchEvent(new Event('gcalc:user-updated'));
  return nextUser;
}
