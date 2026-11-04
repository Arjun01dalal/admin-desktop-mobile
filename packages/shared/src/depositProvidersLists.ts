/**
 * Deposit Providers (payinAccounts) list helpers.
 * Mirrors admin-panel-domains CitySelector / Deposit_Withdraw_Providers payloads.
 */

/** Extra state labels present in admin panel (alongside INDIA_STATES). */
export const DEPOSIT_PROVIDER_EXTRA_STATES = [
  'Dadra & Nagar Haveli & Daman & Diu',
] as const;

const NESTED_LIST_KEYS = ['cities', 'states', 'items', 'values', 'numbers', 'data'] as const;

function pushUnique(out: string[], seen: Set<string>, raw: unknown): void {
  if (raw == null) return;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    const text = String(raw).trim();
    if (!text) return;
    // Comma-separated blobs from older rows / partial updates.
    if (text.includes(',') && !/^\+?\d[\d\s,-]*$/.test(text)) {
      for (const part of text.split(',')) pushUnique(out, seen, part);
      return;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
    return;
  }
  if (Array.isArray(raw)) {
    for (const item of raw) pushUnique(out, seen, item);
    return;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of NESTED_LIST_KEYS) {
      if (key in obj) {
        pushUnique(out, seen, obj[key]);
        return;
      }
    }
    const named = obj.name ?? obj.value ?? obj.label ?? obj.city ?? obj.state ?? obj.number;
    if (named != null) pushUnique(out, seen, named);
  }
}

/** Normalize midArray / upiArray / whatsAppNumbers / cityNotAllowed / stateNotAllowed. */
export function normalizeStringList(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  pushUnique(out, seen, value);
  return out;
}

export function splitListInput(raw: string): string[] {
  return normalizeStringList(
    String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function buildCityNotAllowedPayload(
  cities: string[],
  action: 'add' | 'remove' = 'add',
): { cities: string[]; action: 'add' | 'remove' } {
  return { cities: normalizeStringList(cities), action };
}

export function buildStateNotAllowedPayload(
  states: string[],
  action: 'add' | 'remove' = 'add',
): { states: string[]; action: 'add' | 'remove' } {
  return { states: normalizeStringList(states), action };
}

/** Digits-only compare for MID / mobile matching (admin CitySelector parity). */
export function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/**
 * Active WhatsApp / mobile from redirectionLink (wa.me / tel / raw).
 * Strips +91 / 91 only when clearly 10-digit Indian mobile.
 */
export function parseRedirectionMobile(link: unknown): string {
  const raw = String(link ?? '').trim();
  if (!raw || raw === '-') return '';
  let token = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      token = url.pathname.split('/').filter(Boolean).pop() || url.searchParams.get('phone') || raw;
    }
  } catch {
    token = raw.split('/').pop() || raw;
  }
  token = decodeURIComponent(token).trim();
  if (/^\+91\d{10}$/.test(token)) return token.slice(3);
  if (/^91\d{10}$/.test(token)) return token.slice(2);
  const digits = digitsOnly(token);
  return digits || token;
}

export function buildWhatsappRedirectionLink(mobile: string): string {
  const trimmed = String(mobile || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://wa.me/${digitsOnly(trimmed) || trimmed}`;
}

/** Match a selected value against option list (exact → case → digit suffix). */
export function matchListOption(selected: string, options: string[]): string {
  const needle = String(selected || '').trim();
  if (!needle || !options.length) return needle;
  const exact = options.find((o) => o === needle);
  if (exact) return exact;
  const ci = options.find((o) => o.toLowerCase() === needle.toLowerCase());
  if (ci) return ci;
  const selectedDigits = digitsOnly(needle);
  if (!selectedDigits) return needle;
  const digitMatch = options.find((o) => {
    const optDigits = digitsOnly(o);
    if (!optDigits) return false;
    return (
      optDigits === selectedDigits ||
      optDigits.endsWith(selectedDigits) ||
      selectedDigits.endsWith(optDigits)
    );
  });
  return digitMatch || needle;
}
