/** Shared page-size options for all tables. Update here once for every screen. */
export const ITEMS_PER_PAGE_OPTIONS = [
  '10',
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
