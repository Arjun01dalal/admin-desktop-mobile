/**
 * Beneficiary accounts user-count — Laxmi Withdrawal Total Bene List /
 * Beneficiary List (Pending) options.
 * POST /User/beneficiary-accounts-user-count
 */

export type BeneAccountCountItem = {
  beneficiaryAccount: string;
  userCount: number;
  pendingWithdrawalCount: number;
  approvedWithdrawalCount: number;
};

export type BeneAccountCountSummary = {
  totalAccounts: number;
  totalUsersWithAny: number;
  items: BeneAccountCountItem[];
};

export type BenePendingOption = {
  name: string;
  pendingWithdrawalCount: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickItems(payload: unknown): unknown[] {
  const obj = asRecord(payload);
  if (!obj) return Array.isArray(payload) ? payload : [];
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.payload)) return obj.payload;
  const nested = asRecord(obj.payload);
  if (nested && Array.isArray(nested.items)) return nested.items;
  return [];
}

export function normalizeBeneAccountCountSummary(payload: unknown): BeneAccountCountSummary {
  const obj = asRecord(payload);
  const nested = asRecord(obj?.payload) ?? obj;
  const list = pickItems(nested ?? payload);
  const items = list.map((item) => {
    const row = asRecord(item) ?? {};
    const userCount = Number(row.userCount) || 0;
    const pendingRaw = Number(row.pendingWithdrawalCount);
    return {
      beneficiaryAccount: String(row.beneficiaryAccount ?? '').trim(),
      userCount,
      pendingWithdrawalCount: Number.isFinite(pendingRaw) ? pendingRaw : userCount,
      approvedWithdrawalCount: Number(row.approvedWithdrawalCount) || 0,
    };
  });

  return {
    totalAccounts: Number(nested?.totalAccounts) || items.length || 0,
    totalUsersWithAny: Number(nested?.totalUsersWithAny) || 0,
    items,
  };
}

/**
 * Merge available banks with pending counts.
 * If banks list is empty, fall back to beneficiaryAccount names from counts (Laxmi AUW).
 */
export function buildBenePendingOptions(
  banks: string[],
  counts: BeneAccountCountItem[],
): BenePendingOption[] {
  const countMap = new Map<string, number>();
  for (const item of counts) {
    const key = item.beneficiaryAccount.trim().toLowerCase();
    if (!key) continue;
    countMap.set(key, item.pendingWithdrawalCount || item.userCount || 0);
  }

  const names =
    banks.length > 0
      ? banks
      : counts.map((c) => c.beneficiaryAccount).filter(Boolean);

  return names.map((name) => ({
    name,
    pendingWithdrawalCount: countMap.get(name.trim().toLowerCase()) ?? 0,
  }));
}
