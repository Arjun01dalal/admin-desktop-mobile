/**
 * Shared display helpers — mirrors desktop useReportQuery `display()`.
 * Applies Jyotish / astro UI name mapping for labels and API cell values.
 */
import { toDisplayText } from '../dashboards/jyotish/jyotishMapping';

/** Map any UI / API string through Jyotish rename rules. */
export function display(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return toDisplayText(String(value));
}

export { toDisplayText };
