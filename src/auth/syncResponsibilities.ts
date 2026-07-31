import { secureApi } from '@/api/secureClient';
import {
  getRoleId,
  updateStoredResponsibilities,
} from '@/auth/permissions';

function extractResponsibilityList(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.map(String).filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload ?? obj.Responsibilities ?? obj.responsibilities ?? obj.data;
    if (Array.isArray(nested)) {
      return nested.map(String).filter(Boolean);
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
