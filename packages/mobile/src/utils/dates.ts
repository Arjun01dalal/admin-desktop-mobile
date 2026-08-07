/** Date helpers — mirror desktop utils/dates.ts (IST-based). */
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export function daysAgoIST(days: number): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000 - days * 86_400_000)
    .toISOString()
    .split('T')[0];
}

/** Coerce API date values (ISO string, ms, unix seconds, Mongo {$date}) to Date. */
/** ISO `YYYY-MM-DD` → `DD/MM/YYYY` (call-logs API date format). */
export function formatDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function coerceDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (obj.$date != null) return coerceDate(obj.$date);
    if (typeof obj.date === 'string' || typeof obj.date === 'number') {
      return coerceDate(obj.date);
    }
    return null;
  }
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return coerceDate(Number(raw));
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** DD-MM-YYYY in Asia/Kolkata — matches desktop formatDisplayDate. */
export function formatDisplayDate(value: unknown): string {
  if (!value) return '';
  const d = coerceDate(value);
  if (!d) return String(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  if (!day || !month || !year) return String(value);
  return `${day}-${month}-${year}`;
}

/** h:mm AM/PM in Asia/Kolkata — matches desktop formatDisplayTime. */
export function formatDisplayTime(value: unknown): string {
  if (!value) return '';
  const d = coerceDate(value);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function monthStartIST(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
