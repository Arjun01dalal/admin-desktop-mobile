const FUNDS_DATE_STORAGE_KEY = 'fundsFilterDates';
const FUNDS_DRILL_STORAGE_KEY = 'fundsDrillState';

export type FundsDates = {
  startDate: string;
  endDate: string;
};

export type FundsMidRow = {
  mid: string;
  finalAmount?: number;
  transactionAmount?: number;
  coinAmount?: number;
  coinAdd?: number;
  coinRemove?: number;
  netCoin?: number;
  paymentGatewayCompany?: string;
  companyGroup?: string;
};

export type FundsDrillState = {
  name: string;
  mids: FundsMidRow[];
  startDate: string;
  endDate: string;
  midID?: string;
};

let fundsDatesMemory: FundsDates | null = null;
let fundsDrillMemory: FundsDrillState | null = null;

export function getTodayDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function saveFundsDates(startDate: string, endDate: string): void {
  if (!startDate || !endDate) return;
  const dates = { startDate, endDate };
  fundsDatesMemory = dates;
  try {
    localStorage.setItem(FUNDS_DATE_STORAGE_KEY, JSON.stringify(dates));
  } catch {
    // ignore
  }
}

export function readFundsDates(
  locationState?: { startDate?: string; endDate?: string } | null,
): FundsDates {
  if (locationState?.startDate && locationState?.endDate) {
    const dates = {
      startDate: locationState.startDate,
      endDate: locationState.endDate,
    };
    fundsDatesMemory = dates;
    return dates;
  }

  if (fundsDatesMemory?.startDate && fundsDatesMemory?.endDate) {
    return fundsDatesMemory;
  }

  try {
    const saved = localStorage.getItem(FUNDS_DATE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as FundsDates;
      if (parsed?.startDate && parsed?.endDate) {
        fundsDatesMemory = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  const today = getTodayDate();
  return { startDate: today, endDate: today };
}

export function roundAmt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return 0;
  return Math.round(num);
}

export function normalizeMids(raw: unknown): FundsMidRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      mid: String(item.mid ?? item.MID ?? item.midName ?? ''),
      finalAmount: Number(item.finalAmount) || 0,
      transactionAmount: Number(item.transactionAmount) || 0,
      coinAmount: Number(item.coinAmount) || 0,
      coinAdd: Number(item.coinAdd) || 0,
      coinRemove: Number(item.coinRemove) || 0,
      netCoin: Number(item.netCoin) || 0,
      paymentGatewayCompany: String(item.paymentGatewayCompany ?? ''),
      companyGroup: String(item.companyGroup ?? ''),
    }))
    .filter((item) => item.mid);
}

export function saveFundsDrill(state: FundsDrillState): void {
  fundsDrillMemory = state;
  try {
    sessionStorage.setItem(FUNDS_DRILL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function readFundsDrill(
  locationState?: {
    name?: string;
    mids?: unknown;
    startDate?: string;
    endDate?: string;
    midID?: string;
  } | null,
): FundsDrillState | null {
  if (
    locationState?.name &&
    locationState.startDate &&
    locationState.endDate &&
    (Array.isArray(locationState.mids) || locationState.midID)
  ) {
    const existing = fundsDrillMemory || (() => {
      try {
        const saved = sessionStorage.getItem(FUNDS_DRILL_STORAGE_KEY);
        return saved ? (JSON.parse(saved) as FundsDrillState) : null;
      } catch {
        return null;
      }
    })();
    const next: FundsDrillState = {
      name: String(locationState.name),
      mids: Array.isArray(locationState.mids)
        ? normalizeMids(locationState.mids)
        : normalizeMids(existing?.mids),
      startDate: locationState.startDate,
      endDate: locationState.endDate,
      midID: locationState.midID
        ? String(locationState.midID)
        : existing?.midID,
    };
    saveFundsDrill(next);
    return next;
  }

  if (fundsDrillMemory?.name) return fundsDrillMemory;

  try {
    const saved = sessionStorage.getItem(FUNDS_DRILL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as FundsDrillState;
      if (parsed?.name && Array.isArray(parsed.mids)) {
        fundsDrillMemory = {
          ...parsed,
          mids: normalizeMids(parsed.mids),
        };
        return fundsDrillMemory;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function setFundsSelectedMid(midID: string): void {
  const current = readFundsDrill();
  if (!current) return;
  saveFundsDrill({ ...current, midID });
}

export function clearFundsSelectedMid(): void {
  const current = readFundsDrill();
  if (!current) return;
  const { midID: _drop, ...rest } = current;
  saveFundsDrill(rest);
}

/** YYYY-MM-DD in IST — matches Funds startDate/endDate format. */
export function toIstYmd(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getCreatedOn(row: Record<string, unknown>): string {
  return String(row.createdOn ?? row.createdAt ?? row.createAt ?? '');
}

export function getUpdatedOn(row: Record<string, unknown>): string {
  return String(row.updatedOn ?? row.updatedAt ?? '');
}

export type FundsDateSplitStats = {
  previousTotal: number;
  previousCount: number;
  todayTotal: number;
  todayCount: number;
};

/** Split MID dump into "filter day" vs earlier days (by createdOn/createdAt, IST). */
export function computeFundsDateSplitStats(input: {
  startDate?: string;
  endDate?: string;
  transactions?: Record<string, unknown>[];
  credits?: Record<string, unknown>[];
  debits?: Record<string, unknown>[];
}): FundsDateSplitStats {
  const referenceDay =
    input.endDate || input.startDate || toIstYmd(new Date());

  const isPreviousDate = (timestamp?: string) => {
    const createdDay = toIstYmd(timestamp);
    if (!createdDay) return false;
    return createdDay !== referenceDay;
  };

  const isTodayDate = (timestamp?: string) => {
    const createdDay = toIstYmd(timestamp);
    if (!createdDay) return false;
    return createdDay === referenceDay;
  };

  const transactions = input.transactions ?? [];
  const credits = input.credits ?? [];
  const debits = input.debits ?? [];

  const previousTransactions = transactions.filter((row) =>
    isPreviousDate(getCreatedOn(row)),
  );
  const previousCredits = credits.filter((row) =>
    isPreviousDate(getCreatedOn(row)),
  );
  const previousDebits = debits.filter((row) =>
    isPreviousDate(getCreatedOn(row)),
  );

  const todayTransactions = transactions.filter((row) =>
    isTodayDate(getCreatedOn(row)),
  );
  const todayCredits = credits.filter((row) => isTodayDate(getCreatedOn(row)));
  const todayDebits = debits.filter((row) => isTodayDate(getCreatedOn(row)));

  const sumAmount = (rows: Record<string, unknown>[]) =>
    rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const sumBalance = (rows: Record<string, unknown>[]) =>
    rows.reduce((sum, row) => sum + (Number(row.balance) || 0), 0);

  return {
    previousTotal:
      sumAmount(previousTransactions) +
      sumBalance(previousCredits) -
      sumBalance(previousDebits),
    previousCount:
      previousTransactions.length +
      previousCredits.length +
      previousDebits.length,
    todayTotal:
      sumAmount(todayTransactions) +
      sumBalance(todayCredits) -
      sumBalance(todayDebits),
    todayCount:
      todayTransactions.length + todayCredits.length + todayDebits.length,
  };
}
