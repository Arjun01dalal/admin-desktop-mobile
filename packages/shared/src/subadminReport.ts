/**
 * Subadmin Report — automatic logout sessions
 * GET /SubAdmin/automatic-logout-details
 */

export type SubadminLogoutRow = {
  subAdminId?: string;
  name?: string;
  pseudoName?: string;
  mobile?: string;
  role?: string;
  loginDate?: string | null;
  loginTime?: string | null;
  automaticLogoutTime?: string | null;
  sessionDuration?: string | null;
  nextLoginTime?: string | null;
};

export type SubadminLogoutReport = {
  rows: SubadminLogoutRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const SUBADMIN_REPORT_PAGE_SIZES = [25, 50, 100, 200] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Hide empty / not_assigned API placeholders. */
export function displaySubadminReportValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!text || text.toLowerCase() === 'not_assigned') return '';
  return text;
}

export function formatSubadminLoginLabel(
  row: Pick<SubadminLogoutRow, 'loginDate' | 'loginTime'>,
): string {
  const parts = [displaySubadminReportValue(row.loginDate), displaySubadminReportValue(row.loginTime)].filter(
    Boolean,
  );
  return parts.join(' · ');
}

export function buildSubadminReportQuery(input: {
  startDate: string;
  endDate: string;
  page: number;
  limit: number;
}): { startDate: string; endDate: string; page: number; limit: number } | { error: string } {
  const startDate = String(input.startDate || '').trim();
  const endDate = String(input.endDate || '').trim();
  if (!startDate || !endDate) return { error: 'Please select from and to date' };
  if (startDate > endDate) return { error: 'From date cannot be after To date' };
  const page = Math.max(1, Math.floor(num(input.page, 1)) || 1);
  const limit = Math.max(1, Math.floor(num(input.limit, 50)) || 50);
  return { startDate, endDate, page, limit };
}

function parseRow(raw: unknown): SubadminLogoutRow | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  return {
    subAdminId: obj.subAdminId != null ? String(obj.subAdminId) : undefined,
    name: obj.name != null ? String(obj.name) : undefined,
    pseudoName: obj.pseudoName != null ? String(obj.pseudoName) : undefined,
    mobile: obj.mobile != null ? String(obj.mobile) : undefined,
    role: obj.role != null ? String(obj.role) : undefined,
    loginDate: obj.loginDate != null ? String(obj.loginDate) : null,
    loginTime: obj.loginTime != null ? String(obj.loginTime) : null,
    automaticLogoutTime:
      obj.automaticLogoutTime != null ? String(obj.automaticLogoutTime) : null,
    sessionDuration: obj.sessionDuration != null ? String(obj.sessionDuration) : null,
    nextLoginTime: obj.nextLoginTime != null ? String(obj.nextLoginTime) : null,
  };
}

function findListAndMeta(raw: unknown): {
  list: unknown[];
  total?: unknown;
  page?: unknown;
  limit?: unknown;
} {
  const root = asRecord(raw) || {};
  const candidates: Record<string, unknown>[] = [root];
  for (const key of ['payload', 'data', 'result']) {
    const nested = asRecord(root[key]);
    if (nested) candidates.push(nested);
    const deeper = nested ? asRecord(nested.data) || asRecord(nested.payload) : null;
    if (deeper) candidates.push(deeper);
  }

  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) {
      return {
        list: candidate.data,
        total: candidate.total,
        page: candidate.page,
        limit: candidate.limit,
      };
    }
    if (Array.isArray(candidate.items)) {
      return {
        list: candidate.items,
        total: candidate.total,
        page: candidate.page,
        limit: candidate.limit ?? candidate.itemsPerPage,
      };
    }
  }

  if (Array.isArray(raw)) return { list: raw };
  return { list: [] };
}

export function parseSubadminLogoutReport(
  raw: unknown,
  fallback: { page: number; limit: number },
): SubadminLogoutReport {
  const { list, total, page, limit } = findListAndMeta(raw);
  const rows = list.map(parseRow).filter((row): row is SubadminLogoutRow => Boolean(row));
  const resolvedLimit = Math.max(1, num(limit, fallback.limit) || fallback.limit);
  const resolvedPage = Math.max(1, num(page, fallback.page) || fallback.page);
  const resolvedTotal = Math.max(0, num(total, rows.length));
  return {
    rows,
    total: resolvedTotal,
    page: resolvedPage,
    limit: resolvedLimit,
    totalPages: Math.max(1, Math.ceil(resolvedTotal / resolvedLimit) || 1),
  };
}

export function subadminReportRange(total: number, page: number, limit: number): {
  start: number;
  end: number;
} {
  if (total <= 0) return { start: 0, end: 0 };
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return { start, end };
}
