export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export function monthStartIST(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function formatAmount(amt: unknown): number | string {
  const num = Number(amt);
  if (!Number.isFinite(num)) return '-';
  if (num === 0) return 0;
  return Number.isInteger(num) ? num : Number(num.toFixed(2));
}

export function formatDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** Format API date/datetime to DD/MM/YYYY */
export function formatDisplayDate(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}

/** Format API datetime to HH:mm:ss */
export function formatDisplayTime(value: unknown): string {
  if (!value) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export function getStoredUser<T = Record<string, unknown>>(): T | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
