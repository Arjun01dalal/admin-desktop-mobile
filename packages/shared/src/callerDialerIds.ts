export type CallerDialerIds = {
  campaignId: string;
  listId: string;
  numericPart: string;
};

const HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export function normalizeExtensionIds(extensionId: unknown): string[] {
  if (Array.isArray(extensionId)) {
    const out: string[] = [];
    for (const item of extensionId) {
      if (item != null && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const nested = obj.id ?? obj.campaignId ?? obj.extensionId ?? obj.value;
        if (nested != null && String(nested).trim()) out.push(String(nested).trim());
        continue;
      }
      const s = String(item ?? '').trim();
      if (s) out.push(s);
    }
    return out;
  }
  if (typeof extensionId === 'string' && extensionId.trim()) {
    return extensionId
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof extensionId === 'number' && Number.isFinite(extensionId)) {
    return [String(extensionId)];
  }
  return [];
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

function pushIds(out: string[], value: unknown) {
  for (const id of normalizeExtensionIds(value)) {
    if (!out.includes(id)) out.push(id);
  }
}

/** Collect every campaign / extension id variant from a login user object. */
export function collectCallerExtensionIds(
  user: Record<string, unknown> | null | undefined,
): string[] {
  if (!user || typeof user !== 'object') return [];
  const ids: string[] = [];
  const keys = [
    'extensionId',
    'extension_id',
    'ExtensionId',
    'extensionNo',
    'extension_no',
    'extension',
    'campaignId',
    'campaign_id',
    'campaignID',
    'CampaignId',
    'campaignIds',
    'campaign_ids',
  ] as const;
  for (const key of keys) pushIds(ids, user[key]);
  return ids;
}

/**
 * Pick campaign + list id from an extension / campaign id list.
 * Returns null when no usable id is present.
 */
export function resolveCallerDialerIds(extensionId: unknown): CallerDialerIds | null {
  const ids = normalizeExtensionIds(extensionId);
  if (!ids.length) return null;

  const alpha = ids.find((v) => HAS_LETTER_AND_DIGIT.test(v));
  const numericOnly = ids.find((v) => /^\d+$/.test(v));

  const campaignId = alpha || numericOnly || '';
  if (!campaignId) return null;

  const numericPart = digitsOf(alpha || '') || numericOnly || digitsOf(campaignId);
  if (!numericPart) return null;

  return {
    campaignId,
    listId: `90${numericPart}`,
    numericPart,
  };
}

/**
 * Resolve dialer ids from the full login user (all known field names).
 * Optional `fallbackCampaignId` used when login has no extension / campaign id.
 */
export function resolveCallerDialerIdsFromUser(
  user: Record<string, unknown> | null | undefined,
  fallbackCampaignId?: string | null,
): CallerDialerIds | null {
  const fromLogin = resolveCallerDialerIds(collectCallerExtensionIds(user));
  if (fromLogin) return fromLogin;

  const fallback = String(fallbackCampaignId || '').trim();
  if (fallback) return resolveCallerDialerIds(fallback);

  return null;
}
