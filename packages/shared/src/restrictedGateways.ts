/**
 * Restricted Gateway (WhatsApp-only) helpers —
 * parity with admin-panel-domains WhatsAppOnlyGateways.
 */

function unwrapPayload(body: unknown): unknown {
  let raw: unknown = body;
  for (let i = 0; i < 4; i++) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) break;
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.names) || Array.isArray(rec.gateways)) break;
    if (rec.payload !== undefined) {
      raw = rec.payload;
      continue;
    }
    if (rec.data !== undefined && !Array.isArray(rec.names)) {
      raw = rec.data;
      continue;
    }
    if (rec.result !== undefined) {
      raw = rec.result;
      continue;
    }
    break;
  }
  return raw;
}

export function dedupeGatewayNames(values: unknown): string[] {
  const list = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const name =
      typeof item === 'string'
        ? item.trim()
        : String(
            (item as { name?: unknown; displayName?: unknown; gatewayName?: unknown })?.name ||
              (item as { displayName?: unknown })?.displayName ||
              (item as { gatewayName?: unknown })?.gatewayName ||
              '',
          ).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function extractRestrictedGatewayNames(body: unknown): string[] {
  const payload = unwrapPayload(body);
  if (!payload) return [];
  if (Array.isArray(payload)) return dedupeGatewayNames(payload);
  if (typeof payload === 'string') {
    try {
      return extractRestrictedGatewayNames(JSON.parse(payload));
    } catch {
      return payload.trim() ? [payload.trim()] : [];
    }
  }
  if (typeof payload !== 'object') return [];
  const rec = payload as Record<string, unknown>;
  if (Array.isArray(rec.names)) return dedupeGatewayNames(rec.names);
  if (Array.isArray(rec.gateways)) return dedupeGatewayNames(rec.gateways);
  if (Array.isArray(rec.allowedGateways)) return dedupeGatewayNames(rec.allowedGateways);
  if (Array.isArray(rec.whatsappOnlyGateways)) return dedupeGatewayNames(rec.whatsappOnlyGateways);
  if (Array.isArray(rec.data)) return dedupeGatewayNames(rec.data);
  if (Array.isArray(rec.items)) return dedupeGatewayNames(rec.items);
  if (rec.data && typeof rec.data === 'object') {
    return extractRestrictedGatewayNames(rec.data);
  }
  return [];
}

/** Provider option names from depositProviders.list / getAllDash. */
export function extractDepositGatewayOptions(body: unknown): string[] {
  const payload = unwrapPayload(body);
  const providers = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Array.isArray((payload as { items?: unknown }).items)
        ? (payload as { items: unknown[] }).items
        : Array.isArray((payload as { data?: unknown }).data)
          ? ((payload as { data: unknown[] }).data)
          : []
      : [];
  return dedupeGatewayNames(providers);
}

/** Merge deposit-provider options with currently selected names (selected first if missing). */
export function mergeGatewayOptions(options: string[], selected: string[]): string[] {
  const optionSet = new Set(options.map((n) => n.toLowerCase()));
  const merged = [...options];
  selected.forEach((name) => {
    if (!optionSet.has(name.toLowerCase())) merged.unshift(name);
  });
  return merged;
}

export type RestrictedGatewayUpdatedBy = {
  userId: string;
  userName: string;
};

/** POST body for `restrictedGateways.set`. */
export function buildRestrictedGatewaysSetPayload(
  names: string[],
  updatedBy: RestrictedGatewayUpdatedBy,
): { names: string[]; updatedBy: RestrictedGatewayUpdatedBy } {
  return {
    names: dedupeGatewayNames(names.map((n) => n.trim()).filter(Boolean)),
    updatedBy: {
      userId: String(updatedBy.userId || '').trim(),
      userName: String(updatedBy.userName || 'Admin').trim() || 'Admin',
    },
  };
}
