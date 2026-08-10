import { CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/** Match admin-panel-domains `dateTime()` — YYYY-MM-DD for getAll date filters. */
export function dateTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

export function monthStartIST(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function getStoredUser<T = Record<string, unknown>>(): T | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function isCallerRole(): boolean {
  const user = getStoredUser<{ Role_ID?: string }>();
  const roleId = String(user?.Role_ID || localStorage.getItem('role_id') || '');
  return Boolean(roleId && CALLER_ROLE_IDS.has(roleId));
}

/**
 * Mask large amounts: decimal after first 4 digits, round to 2 places.
 * 318463.62 → 3184.64, 31846362 → 3184.64
 */
export function formatMaskedAmount(amt: unknown): string {
  const num = Number(amt);
  if (!Number.isFinite(num)) return '-';
  if (num === 0) return '0';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const intDigits = String(Math.trunc(abs));
  if (intDigits.length < 5) {
    return `${sign}${Number.isInteger(abs) ? abs : abs.toFixed(2)}`;
  }
  const digits = abs.toFixed(2).replace('.', '');
  const masked = Number(`${digits.slice(0, 4)}.${digits.slice(4)}`);
  return `${sign}${masked.toFixed(2)}`;
}

/**
 * Format amount for display.
 * Callers: use formatMaskedAmount. Other roles see the full amount.
 */
export function formatAmount(amt: unknown): number | string {
  const num = Number(amt);
  if (!Number.isFinite(num)) return '-';
  if (num === 0) return 0;

  if (isCallerRole()) {
    return formatMaskedAmount(num);
  }

  return Number.isInteger(num) ? num : Number(num.toFixed(2));
}

export function formatDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/**
 * Coerce API date values (ISO string, ms, or unix seconds) to Date.
 */
export function coerceDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format API date to DD-MM-YYYY in Asia/Kolkata
 * (matches laxminarayan `formatUTCDate` / IST display).
 */
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

/**
 * Match laxminarayan `formatDate` — DD-MM-YYYY using local calendar parts.
 * Used where the old panel called formatDate (not formatUTCDate).
 */
export function formatLocalDate(value: unknown): string {
  if (!value) return '';
  const d = coerceDate(value);
  if (!d) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}-${month}-${year}`;
}

/**
 * Format API datetime to h:mm AM/PM in Asia/Kolkata
 * (matches laxminarayan `formatedTime`).
 */
export function formatDisplayTime(value: unknown): string {
  if (!value) return '';
  const date = coerceDate(value);
  if (!date) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value;
  if (!hour || !minute) return '';
  return `${hour}:${minute} ${(dayPeriod || '').toUpperCase()}`.trim();
}
