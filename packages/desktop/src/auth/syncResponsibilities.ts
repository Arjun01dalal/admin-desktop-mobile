import { secureApi } from '@/api/secureClient';
import {
  getRoleId,
  getResponsibilities,
  updateStoredResponsibilities,
} from '@/auth/permissions';

const isMongoObjectId = (value: string) => /^[a-f\d]{24}$/i.test(value);

/** Prefer Enum keys (match Permissions.*) over display Name labels. */
function fromResponsibilityItem(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const named =
      obj.Enum ?? obj.enum ?? obj.name ?? obj.Name ?? obj.key ?? obj.Key ?? obj._id;
    if (named != null && String(named).trim()) return String(named).trim();
  }
  return '';
}

function extractResponsibilityList(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.map(fromResponsibilityItem).filter(Boolean);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const nested =
      obj.payload ?? obj.Responsibilities ?? obj.responsibilities ?? obj.data;
    if (Array.isArray(nested)) {
      return nested.map(fromResponsibilityItem).filter(Boolean);
    }
  }
  return [];
}

/**
 * Laxmi ChangeResponsibilityPage parity — get-responsibility often returns
 * Mongo ObjectIds; map them to Enum/Name via /responsibilities so permission
 * checks (Admin_LLM_Chatbot, etc.) keep working.
 */
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
 * Refresh Responsibilities for the current Role_ID via backend.
 * Login often returns enum strings; get-responsibility may return ObjectIds —
 * resolve + never wipe good login enums with unresolved ids (Laxmi parity).
 */
export async function syncResponsibilitiesForRole(
  roleId?: string,
): Promise<string[]> {
  const id = String(roleId || getRoleId() || '');
  if (!id) return [];

  const existing = getResponsibilities();
  const existingHasEnums = existing.some((item) => !isMongoObjectId(item));

  // Backend accepts roleId (change-role page); also send Role_ID for older handlers.
  const res = await secureApi('auth.getResponsibility', {
    roleId: id,
    Role_ID: id,
  });
  if (!res.ok) return existing;

  let list = await resolveResponsibilityEnums(extractResponsibilityList(res.data));

  const stillOnlyIds = list.length > 0 && list.every(isMongoObjectId);
  if ((list.length === 0 || stillOnlyIds) && existingHasEnums) {
    // Keep login enums so Admin_LLM_Chatbot / whatsapp / etc. are not wiped.
    list = existing;
  } else if (existingHasEnums) {
    // Merge any login enums the API omitted (id mismatch / new responsibility).
    list = [...new Set([...list, ...existing])];
  }

  if (list.length > 0) {
    updateStoredResponsibilities(list);
  }
  return list;
}
