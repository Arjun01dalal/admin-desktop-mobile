import { CALLER_ROLE_IDS } from '@/screens/panel/callerResponsibility/constants';

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
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
 * Format amount for display.
 * Callers only: if integer part has 5+ digits, keep first 4 and append `..`
 * (e.g. 123456 → 1234..). Other roles see the full amount.
 */
export function formatAmount(amt: unknown): number | string {
  const num = Number(amt);
  if (!Number.isFinite(num)) return '-';
  if (num === 0) return 0;

  if (isCallerRole()) {
    const sign = num < 0 ? '-' : '';
    const absInt = Math.trunc(Math.abs(num));
    const digits = String(absInt);
    if (digits.length >= 5) {
      return `${sign}${digits.slice(0, 4)}..`;
    }
  }

  return Number.isInteger(num) ? num : Number(num.toFixed(2));
}

export function formatDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/**
 * Format API date to DD-MM-YYYY in Asia/Kolkata
 * (matches laxminarayan `formatDate` for IST machines).
 */
export function formatDisplayDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
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
 * Format API datetime to h:mm AM/PM in Asia/Kolkata
 * (matches laxminarayan `formatedTime`).
 */
export function formatDisplayTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const istDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
  );
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : String(minutes);
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}
