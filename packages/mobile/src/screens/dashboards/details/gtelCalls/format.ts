/** Display / filter helpers for Gtel Calls. */
import {
  GTEL_PAGE_SIZE_OPTIONS as GTEL_PAGE_SIZE_OPTIONS_ALL,
  type GtelStatusFilter,
  type GtelVerticalCode,
} from '@astro/shared';
import { isDarkTheme } from '../../../../theme';
import { formatDisplayDate, formatDisplayTime } from '../../../../utils/dates';

/** API / UI cap: itemsPerPage ≤ 200. */
export const GTEL_PAGE_SIZE_OPTIONS = GTEL_PAGE_SIZE_OPTIONS_ALL.filter((n) => n <= 200);

export type CxQuickFilter = 'all' | GtelVerticalCode | 'flagged';

export function formatGtelTs(value?: string | null): string {
  if (!value || value === '—') return '—';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return `${formatDisplayDate(value)} ${formatDisplayTime(value)}`;
    } catch {
      return value;
    }
  }
  return value;
}

export function gtelStatusCardTone(key: Exclude<GtelStatusFilter, ''>) {
  const dark = isDarkTheme();
  const map = {
    answered: dark
      ? { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.45)', value: '#86efac', accent: '#22c55e' }
      : { bg: '#f7fbf7', border: '#c8e6c9', value: '#1b5e20', accent: '#2e7d32' },
    noAnswer: dark
      ? { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.45)', value: '#fdba74', accent: '#f97316' }
      : { bg: '#fff8f1', border: '#ffe0b2', value: '#e65100', accent: '#ef6c00' },
    failed: dark
      ? { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.45)', value: '#fca5a5', accent: '#ef4444' }
      : { bg: '#fff7f7', border: '#ffcdd2', value: '#b71c1c', accent: '#c62828' },
    pending: dark
      ? { bg: 'rgba(37,99,235,0.14)', border: 'rgba(37,99,235,0.45)', value: '#93c5fd', accent: '#3b82f6' }
      : { bg: '#f5f9ff', border: '#bbdefb', value: '#0d47a1', accent: '#1565c0' },
  } as const;
  return map[key];
}
