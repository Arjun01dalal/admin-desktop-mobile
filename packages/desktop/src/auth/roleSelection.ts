import { secureApi } from '@/api/secureClient';
import type { AuthUser } from '@/types/gcalc';

export type RoleOption = {
  name: string;
  id: string;
};

const isMongoObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

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
  const name =
    value.Enum ?? value.enum ?? value.name ?? value.Name ?? value.key ?? value.Key ?? value._id;
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

/** Map Mongo ObjectIds → Enum/Name (Laxmi change-role parity). */
async function resolveResponsibilityEnums(keys: string[]): Promise<string[]> {
  if (!keys.length) return [];
  if (!keys.some(isMongoObjectId)) return keys;

  try {
    const res = await secureApi('responsibilities.list', {});
    if (!res.ok) return keys;
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray((res.data as { payload?: unknown } | null)?.payload)
        ? ((res.data as { payload: unknown[] }).payload)
        : [];
    const idToEnum: Record<string, string> = {};
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = row._id != null ? String(row._id) : '';
      if (!id) continue;
      const enumKey =
        (typeof row.Enum === 'string' && row.Enum) ||
        (typeof row.enum === 'string' && row.enum) ||
        (typeof row.Name === 'string' && row.Name) ||
        (typeof row.name === 'string' && row.name);
      if (enumKey) idToEnum[id] = enumKey;
    }
    return keys
      .map((key) => (isMongoObjectId(key) ? idToEnum[key] || key : key))
      .filter(Boolean);
  } catch {
    return keys;
  }
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

  const existing = Array.isArray(user.Responsibilities)
    ? user.Responsibilities.map(String).filter(Boolean)
    : [];
  const existingHasEnums = existing.some((item) => !isMongoObjectId(item));

  let next = await resolveResponsibilityEnums(extractResponsibilities(response.data));
  const stillOnlyIds = next.length > 0 && next.every(isMongoObjectId);
  if ((next.length === 0 || stillOnlyIds) && existingHasEnums) {
    next = existing;
  } else if (existingHasEnums) {
    next = [...new Set([...next, ...existing])];
  }

  const nextUser: AuthUser = {
    ...user,
    Role_ID: role.id,
    Role_Name: role.name,
    Responsibilities: next,
  };

  localStorage.setItem('role_id', role.id);
  localStorage.setItem('role', role.name);
  localStorage.setItem('user', JSON.stringify(nextUser));
  window.dispatchEvent(new Event('gcalc:user-updated'));
  return nextUser;
}
