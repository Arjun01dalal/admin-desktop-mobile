/**
 * Shared page-size options for tables / report filters.
 * Update here once for desktop + mobile.
 */
export const ITEMS_PER_PAGE_OPTIONS = [
  '10',
  '20',
  '25',
  '50',
  '75',
  '100',
  '150',
  '200',
  '500',
] as const;

export type ItemsPerPageOption = (typeof ITEMS_PER_PAGE_OPTIONS)[number];

export const DEFAULT_ITEMS_PER_PAGE = 10;

/** Numeric form of {@link ITEMS_PER_PAGE_OPTIONS} for RN pickers. */
export const ITEMS_PER_PAGE_NUMBERS = ITEMS_PER_PAGE_OPTIONS.map((n) =>
  Number(n),
) as number[];

/**
 * Subset of shared page sizes (keeps shared order).
 * Use when a screen only needs a compact chip list.
 */
export function pickPageSizes(allowed: readonly number[]): number[] {
  const set = new Set(allowed);
  return ITEMS_PER_PAGE_NUMBERS.filter((n) => set.has(n));
}
