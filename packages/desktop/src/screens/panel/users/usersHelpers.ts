import { CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';

export const MAX_REMARK = 200;

/** Sub_Admin office locations. */
export const SUBADMIN_LOCATIONS = ['Nagpur', 'Dubai', 'Nagpur/Dubai'] as const;

export type SubAdminEditType = 'name' | 'mobile' | 'telegram' | 'empCode';

export type RoleOption = { _id: string; Name?: string; name?: string };

export function stableKey(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '';
  }
}

export function isCallerRole(roleId?: string, roleName?: string): boolean {
  const id = String(roleId || localStorage.getItem('role_id') || '');
  if (id && CALLER_ROLE_IDS.has(id)) return true;
  const name = String(roleName || localStorage.getItem('role') || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return name === 'caller' || name === 'caller_new';
}
