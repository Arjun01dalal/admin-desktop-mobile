/**
 * Withdrawal Bifurcation — played-wise (E/C/S) + status totals for a date range.
 * API: POST /transaction/withdrawal-played-bifurcation
 * Permission: see_withdrawal_bifurcation
 */

export type BifurcationStatus = {
  status?: string;
  amount?: number;
  count?: number;
};

export type BifurcationStatusKey =
  | 'approved'
  | 'pending'
  | 'inProgress'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'onHold'
  | 'reverse';

export type BifurcationRow = {
  played: string;
  totalAmount: number;
  totalCount: number;
  approved?: BifurcationStatus;
  pending?: BifurcationStatus;
  inProgress?: BifurcationStatus;
  rejected?: BifurcationStatus;
  cancelled?: BifurcationStatus;
  failed?: BifurcationStatus;
  onHold?: BifurcationStatus;
  reverse?: BifurcationStatus;
};

export type BifurcationStatusTotals = {
  approved?: BifurcationStatus;
  pending?: BifurcationStatus;
  inProgress?: BifurcationStatus;
  rejected?: BifurcationStatus;
  cancelled?: BifurcationStatus;
  failed?: BifurcationStatus;
  onHold?: BifurcationStatus;
  reverse?: BifurcationStatus;
  totalAmount?: number;
  totalCount?: number;
};

export type BifurcationResult = {
  rows: BifurcationRow[];
  statusTotals: BifurcationStatusTotals | null;
};

export type BifurcationChartMetric = 'amount' | 'count';

export type BifurcationChartDatum = {
  key: string;
  label: string;
  code: string;
  amount: number;
  count: number;
  /** Status segments for stacked chart (metric-aware values filled by caller). */
  segments: Array<{ key: BifurcationStatusKey; label: string; amount: number; count: number }>;
};

/** Max inclusive calendar-day span for bifurcation queries. */
export const BIFURCATION_MAX_RANGE_DAYS = 62;

export type BifurcationDateValidation =
  | { ok: true }
  | { ok: false; code: 'missing' | 'invalid' | 'order' | 'range'; message: string };

/** Shared status field order for totals + per-played cards. */
export const BIFURCATION_STATUS_META: ReadonlyArray<{
  key: BifurcationStatusKey;
  label: string;
}> = [
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'failed', label: 'Failed' },
  { key: 'onHold', label: 'On Hold' },
  { key: 'reverse', label: 'Reverse' },
];

const PLAYED_LABELS: Record<string, string> = {
  E: 'Exchange',
  C: 'Casino',
  S: 'Satta Matka',
};

export function formatPlayedCode(played?: string): string {
  const code = String(played || '')
    .trim()
    .toUpperCase();
  if (!code) return '';
  if (code === 'NONE') return 'NONE';
  return code;
}

export function formatPlayedLabel(played?: string): string {
  const code = formatPlayedCode(played);
  if (!code) return '—';
  if (code === 'NONE') return 'None';
  const mapped = code
    .split('')
    .map((char) => PLAYED_LABELS[char] || char)
    .filter(Boolean);
  return mapped.length ? mapped.join(' + ') : code;
}

export function formatBifurcationAmount(value?: number | null): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-IN');
}

/** Compact Indian notation for dense chart labels (14.8L, 1.2Cr). */
export function formatBifurcationCompact(
  value?: number | null,
  metric: BifurcationChartMetric = 'amount',
): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (metric === 'count') {
    if (Math.abs(n) >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
  }
  if (Math.abs(n) >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 1_00_000) return `${(n / 1_00_000).toFixed(1)}L`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function parseIsoDateOnly(value: string): Date | null {
  const raw = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

export function validateBifurcationDateRange(
  startDate: string,
  endDate: string,
  maxDays: number = BIFURCATION_MAX_RANGE_DAYS,
): BifurcationDateValidation {
  const startRaw = String(startDate || '').trim();
  const endRaw = String(endDate || '').trim();
  if (!startRaw || !endRaw) {
    return { ok: false, code: 'missing', message: 'Select From Date and To Date' };
  }
  const start = parseIsoDateOnly(startRaw);
  const end = parseIsoDateOnly(endRaw);
  if (!start || !end) {
    return { ok: false, code: 'invalid', message: 'Dates must be YYYY-MM-DD' };
  }
  if (start.getTime() > end.getTime()) {
    return { ok: false, code: 'order', message: 'From Date cannot be after To Date' };
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  if (days > maxDays) {
    return {
      ok: false,
      code: 'range',
      message: `Date range cannot exceed ${maxDays} days`,
    };
  }
  return { ok: true };
}

export function toBifurcationChartData(rows: BifurcationRow[]): BifurcationChartDatum[] {
  return rows.map((row, index) => ({
    key: `${row.played || 'blank'}-${index}`,
    label: formatPlayedLabel(row.played),
    code: formatPlayedCode(row.played),
    amount: Number(row.totalAmount) || 0,
    count: Number(row.totalCount) || 0,
    segments: BIFURCATION_STATUS_META.map(({ key, label }) => ({
      key,
      label,
      amount: Number(row[key]?.amount) || 0,
      count: Number(row[key]?.count) || 0,
    })),
  }));
}

export function sortBifurcationChartData(
  data: BifurcationChartDatum[],
  metric: BifurcationChartMetric = 'amount',
): BifurcationChartDatum[] {
  return [...data].sort((a, b) => {
    const av = metric === 'count' ? a.count : a.amount;
    const bv = metric === 'count' ? b.count : b.amount;
    return bv - av;
  });
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Flat rows for CSV export (played breakup + optional status totals footer). */
export function buildBifurcationExportRows(
  rows: BifurcationRow[],
  statusTotals: BifurcationStatusTotals | null,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = rows.map((row, index) => {
    const base: Record<string, unknown> = {
      Sr: index + 1,
      Played: formatPlayedLabel(row.played),
      Code: formatPlayedCode(row.played),
      TotalAmount: Number(row.totalAmount) || 0,
      TotalCount: Number(row.totalCount) || 0,
    };
    for (const { key, label } of BIFURCATION_STATUS_META) {
      base[`${label}Amount`] = Number(row[key]?.amount) || 0;
      base[`${label}Count`] = Number(row[key]?.count) || 0;
    }
    return base;
  });
  if (statusTotals) {
    const totals: Record<string, unknown> = {
      Sr: '',
      Played: 'STATUS TOTALS',
      Code: '',
      TotalAmount: Number(statusTotals.totalAmount) || '',
      TotalCount: Number(statusTotals.totalCount) || '',
    };
    for (const { key, label } of BIFURCATION_STATUS_META) {
      totals[`${label}Amount`] = Number(statusTotals[key]?.amount) || 0;
      totals[`${label}Count`] = Number(statusTotals[key]?.count) || 0;
    }
    out.push(totals);
  }
  return out;
}

export function bifurcationResultToCsv(
  rows: BifurcationRow[],
  statusTotals: BifurcationStatusTotals | null,
): string {
  const list = buildBifurcationExportRows(rows, statusTotals);
  if (!list.length) return '';
  const headers = Object.keys(list[0]);
  const lines = [headers.join(',')];
  for (const row of list) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

function asStatus(raw: unknown): BifurcationStatus | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    status: obj.status != null ? String(obj.status) : undefined,
    amount: Number(obj.amount) || 0,
    count: Number(obj.count) || 0,
  };
}

export function parseBifurcationRows(raw: unknown): BifurcationRow[] {
  const root = (raw || {}) as Record<string, unknown>;
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(root.bifurcation)
      ? root.bifurcation
      : Array.isArray(root.items)
        ? root.items
        : [];
  return list.map((row) => {
    const obj = (row || {}) as Record<string, unknown>;
    return {
      played: String(obj.played || ''),
      totalAmount: Number(obj.totalAmount) || 0,
      totalCount: Number(obj.totalCount ?? obj.count) || 0,
      approved: asStatus(obj.approved),
      pending: asStatus(obj.pending),
      inProgress: asStatus(obj.inProgress),
      rejected: asStatus(obj.rejected),
      cancelled: asStatus(obj.cancelled),
      failed: asStatus(obj.failed),
      onHold: asStatus(obj.onHold),
      reverse: asStatus(obj.reverse),
    };
  });
}

export function parseBifurcationStatusTotals(raw: unknown): BifurcationStatusTotals | null {
  const root = (raw || {}) as Record<string, unknown>;
  const totals = root.statusTotals || root.statusTotal || root.totals || null;
  if (!totals || typeof totals !== 'object' || Array.isArray(totals)) return null;
  const obj = totals as Record<string, unknown>;
  const totalAmountRaw = obj.totalAmount ?? obj.grandTotalAmount ?? obj.amount;
  const totalCountRaw = obj.totalCount ?? obj.totalWithdrawals ?? obj.count;
  return {
    approved: asStatus(obj.approved),
    pending: asStatus(obj.pending),
    inProgress: asStatus(obj.inProgress),
    rejected: asStatus(obj.rejected),
    cancelled: asStatus(obj.cancelled),
    failed: asStatus(obj.failed),
    onHold: asStatus(obj.onHold),
    reverse: asStatus(obj.reverse),
    totalAmount:
      totalAmountRaw === undefined || totalAmountRaw === null
        ? undefined
        : Number(totalAmountRaw) || 0,
    totalCount:
      totalCountRaw === undefined || totalCountRaw === null
        ? undefined
        : Number(totalCountRaw) || 0,
  };
}

export function parseBifurcationResult(raw: unknown): BifurcationResult {
  return {
    rows: parseBifurcationRows(raw),
    statusTotals: parseBifurcationStatusTotals(raw),
  };
}

export function getBifurcationSummary(
  rows: BifurcationRow[],
  statusTotals: BifurcationStatusTotals | null,
): { totalCount: number; totalAmount: number } {
  let fromStatusCount = 0;
  let fromStatusAmount = 0;
  for (const { key } of BIFURCATION_STATUS_META) {
    const item = statusTotals?.[key];
    fromStatusCount += Number(item?.count) || 0;
    fromStatusAmount += Number(item?.amount) || 0;
  }
  let fromRowsCount = 0;
  let fromRowsAmount = 0;
  for (const row of rows) {
    fromRowsCount += Number(row.totalCount) || 0;
    fromRowsAmount += Number(row.totalAmount) || 0;
  }
  const totalCount =
    statusTotals?.totalCount && statusTotals.totalCount > 0
      ? statusTotals.totalCount
      : fromStatusCount > 0
        ? fromStatusCount
        : fromRowsCount;
  const totalAmount =
    statusTotals?.totalAmount && statusTotals.totalAmount > 0
      ? statusTotals.totalAmount
      : fromStatusAmount > 0
        ? fromStatusAmount
        : fromRowsAmount;
  return { totalCount, totalAmount };
}
