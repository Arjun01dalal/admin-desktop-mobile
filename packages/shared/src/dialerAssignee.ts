/**
 * Dialer / extension ID → assignee name (Caller Allotment), used by Dialer Push Data.
 * Mirrors admin-panel DialerPushData extensionAssigneeMap + getCampaignLabel.
 */
import { CAMPAIGN_LIST, type CampaignItem } from './campaignList';

type SubAdminLike = Record<string, unknown> & {
  realName?: unknown;
  name?: unknown;
  empCode?: unknown;
  extensionId?: unknown;
  extensionNo?: unknown;
};

type RoleGroupLike = {
  subAdmins?: SubAdminLike[];
};

function addExtensionKeys(
  map: Record<string, string>,
  rawExt: unknown,
  displayName: string,
): void {
  if (!displayName) return;
  const ids = Array.isArray(rawExt)
    ? rawExt
    : String(rawExt ?? '')
        .split(/[,\s|]+/)
        .filter(Boolean);

  for (const ext of ids) {
    const key = String(ext ?? '').trim();
    if (!key || key === '-' || key === 'null') continue;

    if (!map[key]) map[key] = displayName;

    if (key.includes('_')) {
      const suffix = key.split('_').pop()?.trim();
      if (suffix && !map[suffix]) map[suffix] = displayName;
    }
  }
}

/** Build extension / dialer id → caller display name from subadmins-by-role. */
export function buildExtensionAssigneeMap(
  byRole: RoleGroupLike[] = [],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const role of byRole) {
    for (const admin of role?.subAdmins || []) {
      const displayName = String(
        admin?.realName || admin?.name || admin?.empCode || '',
      ).trim();
      if (!displayName) continue;
      addExtensionKeys(map, admin?.extensionId, displayName);
      addExtensionKeys(map, admin?.extensionNo, displayName);
    }
  }
  return map;
}

function findCampaignMatch(key: string): CampaignItem | undefined {
  let match = CAMPAIGN_LIST.find((item) => String(item.id).trim() === key);
  if (match) return match;

  match = CAMPAIGN_LIST.find((item) => {
    const id = String(item.id).trim();
    if (id.endsWith(`_${key}`)) return true;
    const suffix = id.includes('_') ? id.split('_').pop() : id;
    return suffix === key;
  });
  if (match) return match;

  const lowerKey = key.toLowerCase();
  return CAMPAIGN_LIST.find((item) => {
    const id = String(item.id).trim().toLowerCase();
    const name = String(item.name || '').trim().toLowerCase();
    return id === lowerKey || name === lowerKey;
  });
}

function lookupAssignee(
  campaignKey: string,
  extensionAssigneeMap: Record<string, string>,
): string {
  const key = String(campaignKey || '').trim();
  if (!key) return '';
  return (
    extensionAssigneeMap[key] ||
    (key.includes('_')
      ? extensionAssigneeMap[key.split('_').pop() || ''] || ''
      : '') ||
    ''
  );
}

/**
 * Campaign header label with assignee — e.g.
 * `A_1051 (North) — Assigned: Rahul`.
 */
export function dialerCampaignLabel(
  campaignKey: string,
  extensionAssigneeMap: Record<string, string> = {},
  fallbackName?: string,
): string {
  if (!campaignKey || campaignKey === 'Unknown') return 'Unknown Campaign';
  const key = String(campaignKey).trim();
  const assigneeFromExt = lookupAssignee(key, extensionAssigneeMap);
  const match = findCampaignMatch(key);

  if (assigneeFromExt) {
    const campaignPart = match
      ? `${match.id.trim()} (${match.name})`
      : key;
    return `${campaignPart} — Assigned: ${assigneeFromExt}`;
  }

  if (match) {
    return `${match.id.trim()} - ${match.name}`;
  }

  if (fallbackName && String(fallbackName).trim()) {
    return `${key} - ${String(fallbackName).trim()}`;
  }

  return `Campaign ID: ${key}`;
}
