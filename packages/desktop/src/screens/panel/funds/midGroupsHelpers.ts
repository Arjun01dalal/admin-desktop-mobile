export type MidGroupMap = Record<string, string[]>;

export type ParsedMidGroups = {
  groups: MidGroupMap;
  whatsapp: string[];
};

export function normalizeGroupMids(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : item && typeof item === 'object'
            ? String(
                (item as { mid?: unknown; name?: unknown; value?: unknown }).mid ??
                  (item as { name?: unknown }).name ??
                  (item as { value?: unknown }).value ??
                  '',
              )
            : '',
      )
      .map((m) => m.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseMidGroupsPayload(raw: unknown): ParsedMidGroups {
  const root =
    raw && typeof raw === 'object'
      ? ((raw as { payload?: unknown; data?: unknown }).payload ??
        (raw as { data?: unknown }).data ??
        raw)
      : {};
  const groups: MidGroupMap = {};
  const obj = root && typeof root === 'object' ? (root as Record<string, unknown>) : {};

  const source =
    obj.groups ??
    obj.midGroups ??
    obj.groupMap ??
    (typeof root === 'object' && !Array.isArray(root) ? root : null);

  if (Array.isArray(source)) {
    source.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const row = item as Record<string, unknown>;
      const name = `${row.group ?? row.name ?? row.key ?? ''}`.trim();
      if (!name || name === 'whatsappGlobalOnly' || name === 'whatsapp-global-only') {
        return;
      }
      groups[name] = normalizeGroupMids(row.mids ?? row.mid ?? row.values);
    });
  } else if (source && typeof source === 'object') {
    Object.entries(source as Record<string, unknown>).forEach(([key, value]) => {
      if (
        [
          'whatsappGlobalOnly',
          'whatsapp-global-only',
          'whatsappGlobal',
          'groups',
          'payload',
          'success',
          'message',
          'status',
        ].includes(key)
      ) {
        return;
      }
      if (Array.isArray(value) || typeof value === 'string') {
        groups[key] = normalizeGroupMids(value);
      } else if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>;
        groups[key] = normalizeGroupMids(nested.mids ?? nested.mid ?? nested.values);
      }
    });
  }

  const whatsapp = normalizeGroupMids(
    obj.whatsappGlobalOnly ?? obj['whatsapp-global-only'] ?? obj.whatsappGlobal ?? obj.whatsapp,
  );

  return { groups, whatsapp };
}

export function groupInitials(value: string): string {
  return (
    value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'G'
  );
}
