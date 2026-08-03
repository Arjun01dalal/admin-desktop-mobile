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
