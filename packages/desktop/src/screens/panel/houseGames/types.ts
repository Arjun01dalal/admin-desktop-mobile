export type HouseGameTransaction = {
  _id?: string;
  name?: string;
  userId?: string;
  txnId?: string;
  transactionId?: string;
  refTxnId?: string;
  roundId?: string;
  sessionId?: string;
  gameId?: string;
  operatorId?: string;
  type?: string;
  status?: string;
  currency?: string;
  amount?: number | string;
  winningAmount?: number | string;
  winingPoint?: number | string;
  roundCapacity?: number | string;
  isBot?: boolean | string | number;
  playerIdentity?: { bot?: unknown; real?: unknown };
  playerIdentityBot?: unknown;
  playerIdentityReal?: unknown;
  createdAt?: string;
  createdOn?: string;
  updatedAt?: string;
};

export type HouseGamesListResponse = {
  items?: HouseGameTransaction[];
  transactions?: HouseGameTransaction[];
  total?: number;
  count?: number;
  totalPages?: number;
  totals?: { totalAmount?: number };
};
