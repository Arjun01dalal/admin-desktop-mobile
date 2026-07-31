/** Shared formatting helpers for the dashboard pages. */

import { formatAmount as formatAmountMasked } from '@/utils/dates';

export function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

export function formatInt(value: unknown): string {
  return Math.floor(toNumber(value)).toLocaleString('en-IN');
}

export function formatAmount(value: unknown): string {
  const masked = formatAmountMasked(Math.round(toNumber(value)));
  if (masked === '-') return '₹—';
  // Masked values already use `.` for hidden digits — don't locale-format them.
  if (typeof masked === 'string') return `₹${masked}`;
  return `₹${masked.toLocaleString('en-IN')}`;
}

/** Read a possibly-nested field like "a.b.c" from an unknown object. */
export function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
