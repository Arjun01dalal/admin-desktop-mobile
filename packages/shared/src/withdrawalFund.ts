/**
 * Withdrawal-fund report parsers shared by desktop and mobile.
 * Provider tree shape stays in each client — desktop wraps gatewayNames,
 * mobile flattens mids onto the provider.
 */

export function pickDocList<T = Record<string, unknown>>(source: unknown): T[] {
  if (!source || typeof source !== 'object') return [];
  const s = source as Record<string, unknown>;
  for (const key of ['docs', 'approvedItems', 'withdrawals', 'items', 'list'] as const) {
    const v = s[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
}

export function sumGroupedTotal(grouped: unknown): number {
  if (!grouped || typeof grouped !== 'object') return 0;
  let amount = 0;
  Object.values(grouped as Record<string, unknown>).forEach((type) => {
    Object.values((type as Record<string, unknown>) || {}).forEach((bank) => {
      Object.values((bank as Record<string, unknown>) || {}).forEach((item) => {
        amount += Number((item as { totalAmount?: number })?.totalAmount || 0);
      });
    });
  });
  return amount;
}

export type WithdrawalAgentSummary<T = Record<string, unknown>> = {
  name: string;
  approvedCount: number;
  lockCount: number;
  totalApprovedAmount: number;
  withdrawals: T[];
};

export function parseAgentSummaries<T = Record<string, unknown>>(
  agentWiseSummary: unknown,
): WithdrawalAgentSummary<T>[] {
  if (!agentWiseSummary || typeof agentWiseSummary !== 'object') return [];
  return Object.entries(agentWiseSummary as Record<string, unknown>).map(([name, summary]) => {
    const s = summary as {
      approvedCount?: number;
      lockCount?: number;
      totalApprovedAmount?: number;
    };
    const withdrawals = pickDocList<T>(s);
    return {
      name,
      approvedCount: Number(s?.approvedCount ?? withdrawals.length ?? 0),
      lockCount: Number(s?.lockCount ?? 0),
      totalApprovedAmount: Number(s?.totalApprovedAmount ?? 0),
      withdrawals,
    };
  });
}
