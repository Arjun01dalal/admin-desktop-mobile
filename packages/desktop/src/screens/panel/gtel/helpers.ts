/** Shared field helpers for Gtel Calls table columns. */

import type { GtelCall } from '@astro/shared';
import { formatDisplayDate, formatDisplayTime } from '@/utils/dates';

export function formatGtelStamp(value?: string | null): string {
  if (!value || value === '—') return '—';
  const d = formatDisplayDate(value);
  const t = formatDisplayTime(value);
  if (d && t) return `${d} ${t}`;
  return d || t || '—';
}

export function pickGtelCallField(call: GtelCall, keys: string[]): string {
  const user = call.user && typeof call.user === 'object' ? call.user : null;
  for (const key of keys) {
    const direct = call[key];
    if (direct != null && String(direct).trim() !== '') return String(direct).trim();
    if (user) {
      const nested = (user as Record<string, unknown>)[key];
      if (nested != null && String(nested).trim() !== '') return String(nested).trim();
    }
  }
  return '—';
}

export function getGtelNote(call: GtelCall): string {
  return pickGtelCallField(call, ['note', 'Note', 'remarks', 'remark', 'comment', 'comments']);
}

export function getGtelCallbackDue(call: GtelCall): string {
  return pickGtelCallField(call, [
    'callbackDueAt',
    'callback_due_at',
    'callBackDueAt',
    'CallbackDueAt',
  ]);
}

export function getGtelBalance(call: GtelCall): string {
  const raw = pickGtelCallField(call, [
    'balance',
    'Balance',
    'walletBalance',
    'wallet_balance',
  ]);
  if (raw === '—') return '—';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('en-IN');
}

export function buildGtelCallerDashQuery(args: {
  from: string;
  to: string;
  empCode: string;
}): string {
  const params = new URLSearchParams();
  if (args.from) params.set('from', args.from);
  if (args.to) params.set('to', args.to);
  if (args.empCode) params.set('empCode', args.empCode);
  const q = params.toString();
  return q ? `/gtel-caller-dashboard?${q}` : '/gtel-caller-dashboard';
}

export function buildGtelCallerCallsQuery(args: {
  from: string;
  to: string;
  empCode: string;
}): string {
  const params = new URLSearchParams({
    hideHeroActions: '1',
    empCode: args.empCode,
  });
  if (args.from) params.set('from', args.from);
  if (args.to) params.set('to', args.to);
  return `/gtel-calls?${params.toString()}`;
}
