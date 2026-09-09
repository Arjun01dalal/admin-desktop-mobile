import { CALLER_HEAD_ROLE_IDS, CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';

export const MAX_REMARK = 200;

/** Sub_Admin office locations. */
export const SUBADMIN_LOCATIONS = ['Nagpur', 'Dubai', 'Nagpur/Dubai'] as const;

export type SubAdminEditType = 'name' | 'mobile' | 'telegram' | 'empCode';

export type RoleOption = { _id: string; Name?: string; name?: string };

/** Role_ID may be a plain id or a populated `{ _id, Name }` from get-all-subadmins. */
export function extractRoleId(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const id = obj._id ?? obj.id ?? obj.Role_ID;
    return id != null ? String(id).trim() : '';
  }
  return String(value).trim();
}

export function extractRoleName(value: unknown, fallback = ''): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const name = obj.Name ?? obj.name;
    if (name != null && String(name).trim()) return String(name).trim();
  }
  return fallback;
}

/** Normalize `/roles` list for the Edit Role select (avoids blank/_id crashes). */
export function normalizeRoleOptions(data: unknown): RoleOption[] {
  const raw: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? (() => {
          const obj = data as Record<string, unknown>;
          if (Array.isArray(obj.items)) return obj.items;
          if (Array.isArray(obj.payload)) return obj.payload;
          if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
            const nested = obj.payload as Record<string, unknown>;
            if (Array.isArray(nested.items)) return nested.items;
          }
          return [];
        })()
      : [];

  const out: RoleOption[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = extractRoleId(row._id ?? row.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = String(row.Name ?? row.name ?? '').trim();
    out.push({ _id: id, Name: name || id, name: name || id });
  }
  return out;
}

export function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

/** Plain Caller only — Caller Head must not get caller empCode scoping. */
export function isCallerRole(roleId?: string, roleName?: string): boolean {
  const id = String(roleId || localStorage.getItem('role_id') || '');
  if (id && CALLER_HEAD_ROLE_IDS.has(id)) return false;
  if (id && CALLER_ROLE_IDS.has(id)) return true;
  const name = String(roleName || localStorage.getItem('role') || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return name === 'caller' || name === 'caller_new';
}
