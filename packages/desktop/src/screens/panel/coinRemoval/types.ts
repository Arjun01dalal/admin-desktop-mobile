export type CoinRemovalRow = {
  _id: string;
  name?: string;
  city?: string;
  state?: string;
  totalBalance?: number;
  totalTransactions?: number;
  /** Nested docs when API returns them with the list row. */
  documents?: CoinRemovalTxn[];
  transactions?: CoinRemovalTxn[];
  docs?: CoinRemovalTxn[];
};

export type CoinRemovalTxn = {
  _id?: string;
  paymentType?: string;
  userId?: string;
  balance?: number | string;
  reason?: string;
  tag?: string;
  remark?: string;
  remakr?: string;
  createdOn?: string;
  updatedBy?: { name?: string; _id?: string };
  [key: string]: unknown;
};

export type CoinRemovalListResponse = {
  items?: CoinRemovalRow[];
  totalPages?: number;
  total?: number;
  count?: number;
};

export type CoinRemovalTxnListResponse = {
  items?: CoinRemovalTxn[];
  totalPages?: number;
  total?: number;
};

export function docsOf(row: CoinRemovalRow | null | undefined): CoinRemovalTxn[] {
  if (!row) return [];
  const nested = row.documents || row.transactions || row.docs;
  return Array.isArray(nested) ? nested : [];
}
