/** Shared response unpackers — one implementation for desktop + mobile. */

export function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

export function asList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.payload)) return obj.payload as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export function asPaged<T = unknown>(
  data: unknown,
): {
  rows: T[];
  totalPages: number;
  total: number;
} {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const rows = asList<T>(obj.items ? obj : (obj.payload ?? obj));
    const nested =
      obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)
        ? (obj.payload as Record<string, unknown>)
        : obj;
    return {
      rows: Array.isArray(nested.items) ? (nested.items as T[]) : rows,
      totalPages: Number(nested.totalPages ?? obj.totalPages ?? 1) || 1,
      total: Number(nested.total ?? nested.count ?? obj.total ?? rows.length) || 0,
    };
  }
  const rows = asList<T>(data);
  return { rows, totalPages: 1, total: rows.length };
}

export function truthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }
  return false;
}
