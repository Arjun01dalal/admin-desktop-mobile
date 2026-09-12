/** User withdrawal block helpers — shared desktop + mobile. */

export type WithdrawalBlockItem = {
  _id?: string;
  userId: string;
  amount: number | null;
  userName?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WithdrawalBlockAddMode = 'limit' | 'full';
export type WithdrawalBlockEditMode = 'update' | 'full' | 'remove';

export function isFullWithdrawalBlock(amount: number | null | undefined): boolean {
  return amount === null || amount === undefined;
}

export function parseWithdrawalAmount(raw: string): number | null | typeof NaN {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return n;
}

export function formatWithdrawalMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatWithdrawalDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeWithdrawalBlockRows(data: unknown): {
  rows: WithdrawalBlockItem[];
  totalPages: number;
  total: number;
} {
  let cur: unknown = data;
  for (let i = 0; i < 4; i++) {
    if (!cur || typeof cur !== 'object' || Array.isArray(cur)) break;
    const obj = cur as Record<string, unknown>;
    if (
      Array.isArray(obj.items) ||
      Array.isArray(obj.list) ||
      Array.isArray(obj.records) ||
      Array.isArray(obj.docs) ||
      Array.isArray(obj.result)
    ) {
      break;
    }
    if (obj.payload !== undefined) {
      cur = obj.payload;
      continue;
    }
    if (obj.data !== undefined) {
      cur = obj.data;
      continue;
    }
    break;
  }

  const root =
    cur && typeof cur === 'object' && !Array.isArray(cur)
      ? (cur as Record<string, unknown>)
      : null;

  let list: unknown[] = [];
  if (Array.isArray(cur)) list = cur;
  else if (root) {
    for (const key of ['items', 'list', 'records', 'docs', 'result']) {
      if (Array.isArray(root[key])) {
        list = root[key] as unknown[];
        break;
      }
    }
  }

  const rows = list.map((row) => {
    const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const amount =
      r.amount === null || r.amount === undefined ? null : Number(r.amount);
    return {
      _id: r._id != null ? String(r._id) : undefined,
      userId: String(r.userId ?? ''),
      amount: Number.isFinite(amount as number) ? (amount as number) : null,
      userName: r.userName != null ? String(r.userName) : undefined,
      name: r.name != null ? String(r.name) : undefined,
      createdAt: r.createdAt != null ? String(r.createdAt) : undefined,
      updatedAt: r.updatedAt != null ? String(r.updatedAt) : undefined,
    } satisfies WithdrawalBlockItem;
  });

  const totalPages = Math.max(
    1,
    Number(
      root?.totalPages ??
        (root?.total && root?.itemsPerPage
          ? Math.ceil(Number(root.total) / Number(root.itemsPerPage))
          : 1),
    ) || 1,
  );
  const total = Number(root?.total ?? rows.length) || rows.length;
  return { rows, totalPages, total };
}
