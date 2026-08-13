/** Numeric merge helpers for Combined dashboard (dual-host sum). */

export function toNum(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function floorNum(value: unknown): number {
  return Math.floor(toNum(value));
}

/** Sum numeric keys across two plain objects (Combined mergeObjects). */
export function mergeNumericObjects(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const left = a && typeof a === 'object' ? a : {};
  const right = b && typeof b === 'object' ? b : {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const out: Record<string, unknown> = { ...left, ...right };
  for (const key of keys) {
    const lv = left[key];
    const rv = right[key];
    if (typeof lv === 'number' || typeof rv === 'number') {
      out[key] = toNum(lv) + toNum(rv);
    } else if (
      lv &&
      rv &&
      typeof lv === 'object' &&
      typeof rv === 'object' &&
      !Array.isArray(lv) &&
      !Array.isArray(rv)
    ) {
      out[key] = mergeNumericObjects(
        lv as Record<string, unknown>,
        rv as Record<string, unknown>,
      );
    }
  }
  return out;
}

export function sumArrayField(list: unknown, field: string): number {
  if (!Array.isArray(list)) return 0;
  return list.reduce((acc, item) => {
    if (item && typeof item === 'object' && field in item) {
      return acc + toNum((item as Record<string, unknown>)[field]);
    }
    return acc;
  }, 0);
}

/**
 * Laxmi stores `payload.providerWise` from get-active-customers-categorywise.
 * Secure unwrap already returns `payload`, so dig one more level when present.
 */
export function providerWiseActive(
  raw: unknown,
): Record<string, unknown> {
  const root =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const nested = root.providerWise;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return root;
}

/** Read providerWise[key].count with case-insensitive / alias keys (wacs→wco, sattamatka). */
export function activeCount(
  active: Record<string, unknown>,
  ...keys: string[]
): number {
  const lowerEntries = Object.entries(active).map(
    ([k, v]) => [k.toLowerCase(), v] as const,
  );
  const lowerMap = Object.fromEntries(lowerEntries);

  for (const key of keys) {
    const node = active[key] ?? lowerMap[key.toLowerCase()];
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      if ('count' in (node as object)) {
        return toNum((node as { count?: unknown }).count);
      }
    } else if (node != null && node !== '') {
      return toNum(node);
    }
  }
  return 0;
}
