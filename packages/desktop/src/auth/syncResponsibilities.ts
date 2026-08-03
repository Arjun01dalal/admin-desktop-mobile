import { secureApi } from '@/api/secureClient';
import {
  getRoleId,
  updateStoredResponsibilities,
} from '@/auth/permissions';

function extractResponsibilityList(data: unknown): string[] {
  const fromItem = (item: unknown): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const named =
        obj.name ?? obj.Name ?? obj.enum ?? obj.Enum ?? obj.key ?? obj.Key;
      if (named != null && String(named).trim()) return String(named).trim();
    }
    return '';
  };

  if (Array.isArray(data)) {
    return data.map(fromItem).filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload ?? obj.Responsibilities ?? obj.responsibilities ?? obj.data;
    if (Array.isArray(nested)) {
      return nested.map(fromItem).filter(Boolean);
    }
  }
  return [];
}

/**
 * Refresh Responsibilities for the current Role_ID via backend.
 * Login often returns a user blob; this ensures nav matches the active role.
 */
export async function syncResponsibilitiesForRole(
  roleId?: string,
): Promise<string[]> {
  const id = String(roleId || getRoleId() || '');
  if (!id) return [];

  const res = await secureApi('auth.getResponsibility', { roleId: id });
  if (!res.ok) return [];

  const list = extractResponsibilityList(res.data);
  if (list.length > 0) {
    updateStoredResponsibilities(list);
  }
  return list;
}
