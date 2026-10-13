/**
 * Shared display helpers for list/detail cells (mobile + desktop consumers).
 */

/** Empty / nullish → em dash for table cells. */
export function display(value: unknown): string {
  if (value == null) return '—';
  const text = String(value).trim();
  return text ? text : '—';
}

/** Mask mobile unless the viewer has show_mobile (or equivalent). */
export function maskMobile(value: unknown, canShow: boolean): string {
  if (!canShow) return '**********';
  return display(value);
}

/** Raw string without em-dash fallback (for copy / payloads). */
export function displayRaw(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}
