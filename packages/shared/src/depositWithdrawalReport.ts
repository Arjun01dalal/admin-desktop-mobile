/** Approved deposit / withdrawal MID report — shared desktop + mobile. */
import { unpackPayload } from './api/parse';

export type MidAmountRow = {
  mid: string;
  amount?: number;
  count?: number;
};

export type MidRatioRow = {
  mid: string;
  ratio?: number;
  depositAmount?: number;
  withdrawalAmount?: number;
  diff?: number;
};

export type MergedMidReportRow = {
  mid: string;
  depositAmount?: number;
  depositCount?: number;
  withdrawalAmount?: number;
  withdrawalCount?: number;
  ratio?: number;
  diff?: number;
};

type MidAmountKind = 'deposit' | 'withdrawal';

const DEPOSIT_AMOUNT_KEYS = [
  'amount',
  'depositAmount',
  'approvedDepositAmount',
  'totalAmount',
] as const;

const DEPOSIT_COUNT_KEYS = ['count', 'depositCount', 'approvedDepositCount'] as const;

const WITHDRAWAL_AMOUNT_KEYS = [
  'amount',
  'withdrawalAmount',
  'approvedWithdrawalAmount',
  'totalAmount',
] as const;

const WITHDRAWAL_COUNT_KEYS = ['count', 'withdrawalCount', 'approvedWithdrawalCount'] as const;

function pickMidKey(row: Record<string, unknown>, fallback = ''): string {
  return String(row.mid ?? row.MID ?? row.name ?? fallback).trim();
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value == null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeMidAmountRows(data: unknown, kind: MidAmountKind = 'deposit'): MidAmountRow[] {
  const amountKeys =
    kind === 'deposit' ? DEPOSIT_AMOUNT_KEYS : WITHDRAWAL_AMOUNT_KEYS;
  const countKeys = kind === 'deposit' ? DEPOSIT_COUNT_KEYS : WITHDRAWAL_COUNT_KEYS;

  const pickAmount = (row: Record<string, unknown>, scalar?: unknown) =>
    pickNumber(...amountKeys.map((key) => row[key]), scalar);

  const pickCount = (row: Record<string, unknown>) =>
    pickNumber(...countKeys.map((key) => row[key]));

  if (data == null) return [];

  if (Array.isArray(data)) {
    return data
      .map((item): MidAmountRow | null => {
        if (typeof item === 'string') {
          const mid = item.trim();
          return mid ? { mid } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const mid = pickMidKey(row);
        if (!mid) return null;
        return {
          mid,
          amount: pickAmount(row),
          count: pickCount(row),
        };
      })
      .filter((row): row is MidAmountRow => Boolean(row?.mid));
  }

  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]): MidAmountRow | null => {
        if (typeof value === 'number') {
          return { mid: key.trim(), amount: value };
        }
        if (!value || typeof value !== 'object') {
          const mid = key.trim();
          return mid ? { mid } : null;
        }
        const row = value as Record<string, unknown>;
        const mid = pickMidKey(row, key);
        if (!mid) return null;
        return {
          mid,
          amount: pickAmount(row, value),
          count: pickCount(row),
        };
      })
      .filter((row): row is MidAmountRow => Boolean(row?.mid));
  }

  return [];
}

function normalizeMidRatioRows(data: unknown): MidRatioRow[] {
  if (data == null) return [];

  if (Array.isArray(data)) {
    return data
      .map((item): MidRatioRow | null => {
        if (typeof item === 'string') {
          const mid = item.trim();
          return mid ? { mid } : null;
        }
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const mid = pickMidKey(row);
        if (!mid) return null;
        const depositAmount = pickNumber(row.depositAmount, row.approvedDepositAmount, row.deposit);
        const withdrawalAmount = pickNumber(
          row.withdrawalAmount,
          row.approvedWithdrawalAmount,
          row.withdrawal,
        );
        const diff =
          pickNumber(row.diff, row.depositWithdrawalDiff, row.remainingAmount) ??
          (depositAmount != null && withdrawalAmount != null
            ? depositAmount - withdrawalAmount
            : undefined);
        return {
          mid,
          ratio: pickNumber(
            row.ratio,
            row.withdrawalRatio,
            row.depositWithdrawalRatio,
            row.percentage,
          ),
          depositAmount,
          withdrawalAmount,
          diff,
        };
      })
      .filter((row): row is MidRatioRow => Boolean(row?.mid));
  }

  if (typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]): MidRatioRow | null => {
        if (typeof value === 'number') {
          return { mid: key.trim(), ratio: value };
        }
        if (!value || typeof value !== 'object') {
          const mid = key.trim();
          return mid ? { mid } : null;
        }
        const row = value as Record<string, unknown>;
        const mid = pickMidKey(row, key);
        if (!mid) return null;
        const depositAmount = pickNumber(row.depositAmount, row.approvedDepositAmount);
        const withdrawalAmount = pickNumber(row.withdrawalAmount, row.approvedWithdrawalAmount);
        return {
          mid,
          ratio: pickNumber(row.ratio, row.withdrawalRatio, row.depositWithdrawalRatio, value),
          depositAmount,
          withdrawalAmount,
          diff:
            pickNumber(row.diff, row.depositWithdrawalDiff) ??
            (depositAmount != null && withdrawalAmount != null
              ? depositAmount - withdrawalAmount
              : undefined),
        };
      })
      .filter((row): row is MidRatioRow => Boolean(row?.mid));
  }

  return [];
}

export function extractDepositWithdrawalReportItem(data: unknown): Record<string, unknown> | null {
  const body = unpackPayload(data);
  if (Array.isArray(body.items) && body.items[0] && typeof body.items[0] === 'object') {
    return body.items[0] as Record<string, unknown>;
  }
  if (
    body.approvedDepositAmountByMid != null ||
    body.approvedWithdrawalAmountByMid != null ||
    body.depositWithdrawalRatioMidWise != null
  ) {
    return body;
  }
  return null;
}

export function parseDepositWithdrawalMidReport(data: unknown): {
  approvedDepositAmountByMid: MidAmountRow[];
  approvedWithdrawalAmountByMid: MidAmountRow[];
  depositWithdrawalRatioMidWise: MidRatioRow[];
} {
  const item = extractDepositWithdrawalReportItem(data);
  if (!item) {
    return {
      approvedDepositAmountByMid: [],
      approvedWithdrawalAmountByMid: [],
      depositWithdrawalRatioMidWise: [],
    };
  }
  return {
    approvedDepositAmountByMid: normalizeMidAmountRows(item.approvedDepositAmountByMid, 'deposit'),
    approvedWithdrawalAmountByMid: normalizeMidAmountRows(
      item.approvedWithdrawalAmountByMid,
      'withdrawal',
    ),
    depositWithdrawalRatioMidWise: normalizeMidRatioRows(item.depositWithdrawalRatioMidWise),
  };
}

export function mergeMidDepositRatioRows(
  deposits: MidAmountRow[],
  withdrawals: MidAmountRow[],
  ratios: MidRatioRow[],
): MergedMidReportRow[] {
  const depositByMid = new Map<string, MidAmountRow>();
  const withdrawalByMid = new Map<string, MidAmountRow>();
  const ratioByMid = new Map<string, MidRatioRow>();
  const order: string[] = [];

  const remember = (mid: string) => {
    const key = mid.trim().toLowerCase();
    if (!key) return key;
    if (!depositByMid.has(key) && !withdrawalByMid.has(key) && !ratioByMid.has(key)) {
      order.push(key);
    }
    return key;
  };

  for (const row of deposits) {
    const key = remember(row.mid);
    if (key) depositByMid.set(key, row);
  }
  for (const row of withdrawals) {
    const key = remember(row.mid);
    if (key) withdrawalByMid.set(key, row);
  }
  for (const row of ratios) {
    const key = remember(row.mid);
    if (key) ratioByMid.set(key, row);
  }

  return order
    .map((key) => {
      const deposit = depositByMid.get(key);
      const withdrawal = withdrawalByMid.get(key);
      const ratio = ratioByMid.get(key);
      const mid = deposit?.mid || withdrawal?.mid || ratio?.mid || key;
      const depositAmount = deposit?.amount ?? ratio?.depositAmount;
      const withdrawalAmount = withdrawal?.amount ?? ratio?.withdrawalAmount;
      const diff =
        ratio?.diff ??
        (depositAmount != null && withdrawalAmount != null
          ? depositAmount - withdrawalAmount
          : undefined);
      return {
        mid,
        depositAmount,
        depositCount: deposit?.count,
        withdrawalAmount,
        withdrawalCount: withdrawal?.count,
        ratio: ratio?.ratio,
        diff,
      };
    })
    .sort((a, b) => a.mid.localeCompare(b.mid));
}

export function buildDepositWithdrawalReportRequest(
  userId: string,
  options?: { startDate?: string; endDate?: string; mid?: string },
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    itemsPerPage: 10,
    pageNo: 1,
    filter: {
      name: '',
      mobile: '',
      city: '',
      state: '',
      userId: String(userId || '').trim(),
      clientName: '',
      mid: options?.mid?.trim() || '',
    },
  };
  if (options?.startDate && options?.endDate) {
    body.startDate = options.startDate;
    body.endDate = options.endDate;
  }
  return body;
}

export function formatMidReportRatio(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}%`;
}

/** Remaining deposit balance on a MID (deposit − withdrawal). */
export function midAvailableBalance(row: MergedMidReportRow): number {
  const deposit = Number(row.depositAmount ?? 0);
  const withdrawal = Number(row.withdrawalAmount ?? 0);
  if (row.diff != null && Number.isFinite(row.diff)) return row.diff;
  return deposit - withdrawal;
}

/** True when user has approved deposit activity on this MID. */
export function userDepositedOnMid(row: MergedMidReportRow): boolean {
  return Number(row.depositAmount ?? 0) > 0;
}

/**
 * Withdrawal routing MID — from full catalog, exclude MIDs where user deposited.
 * Pay withdrawal from a MID the user did not deposit through.
 */
export function isWithdrawalRoutingMidRow(row: MergedMidReportRow): boolean {
  return !userDepositedOnMid(row);
}

export function filterWithdrawalRoutingMidRows(rows: MergedMidReportRow[]): MergedMidReportRow[] {
  return rows.filter(isWithdrawalRoutingMidRow).sort((a, b) => a.mid.localeCompare(b.mid));
}

/** @deprecated Use filterWithdrawalRoutingMidRows */
export function filterPayableMidRows(rows: MergedMidReportRow[]): MergedMidReportRow[] {
  return filterWithdrawalRoutingMidRows(rows);
}

/** Overlay user report rows onto the full configured MID catalog. */
export function mergeMidReportWithCatalog(
  catalogMids: string[],
  reportRows: MergedMidReportRow[],
): MergedMidReportRow[] {
  const byKey = new Map(
    reportRows.map((row) => [String(row.mid || '').trim().toLowerCase(), row] as const),
  );
  const seen = new Set<string>();
  const merged: MergedMidReportRow[] = [];

  for (const raw of catalogMids) {
    const mid = String(raw || '').trim();
    if (!mid) continue;
    const key = mid.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(byKey.get(key) ?? { mid, depositAmount: 0, withdrawalAmount: 0, diff: 0 });
  }

  for (const row of reportRows) {
    const key = String(row.mid || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged.sort((a, b) => a.mid.localeCompare(b.mid));
}
