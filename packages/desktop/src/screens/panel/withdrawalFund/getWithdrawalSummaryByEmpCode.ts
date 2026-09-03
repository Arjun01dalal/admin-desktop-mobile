/** Port of admin-panel-domains getWithdrawalSummaryByEmpCode (Withdrawal Fund). */

export type EmpCodeWithdrawalSummary = {
  empCode: string;
  withdrawalCount: number;
  totalAmount: number;
  approvedCount: number;
  pendingCount: number;
  withdrawals: Record<string, unknown>[];
};

export type AgentWithdrawalSummary = {
  agentName: string;
  withdrawalCount: number;
  withdrawals: Record<string, unknown>[];
};

export type CountRow = {
  name: string;
  count: number;
};

/** Agent × EmpCode withdrawal counts (e.g. current-month report). */
export type AgentEmpCountRow = {
  agentName: string;
  empCode: string;
  count: number;
};

const UNASSIGNED_EMP_CODE = 'Unassigned';
const UNASSIGNED_AGENT = 'Unassigned';

const toNumber = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeEmpCode = (empCode: unknown): string => {
  if (empCode === null || empCode === undefined || empCode === '') {
    return UNASSIGNED_EMP_CODE;
  }
  return String(empCode).trim();
};

const createSummary = (
  empCode: string,
  summary: Record<string, unknown> = {},
): EmpCodeWithdrawalSummary => {
  const withdrawalsRaw =
    summary.approvedItems || summary.withdrawals || summary.items || summary.docs || [];
  const withdrawals = Array.isArray(withdrawalsRaw)
    ? (withdrawalsRaw as Record<string, unknown>[])
    : [];

  const approvedCount = toNumber(
    summary.approvedCount ??
      summary.withdrawalApprovedCount ??
      summary.approved ??
      withdrawals.length,
  );

  const pendingCount = toNumber(
    summary.pendingCount ?? summary.withdrawalPendingCount ?? summary.lockCount ?? summary.pending,
  );

  const fallbackCount =
    approvedCount + pendingCount > 0 ? approvedCount + pendingCount : withdrawals.length;

  const withdrawalCount = toNumber(summary.withdrawalCount ?? summary.count ?? fallbackCount);

  const totalAmount = toNumber(
    summary.totalAmount ??
      summary.totalApprovedAmount ??
      summary.withdrawalApprovedAmount ??
      summary.amount,
  );

  return {
    empCode,
    withdrawalCount,
    totalAmount,
    approvedCount,
    pendingCount,
    withdrawals,
  };
};

const aggregateWithdrawalsFromGrouped = (
  grouped: Record<string, unknown>,
): EmpCodeWithdrawalSummary[] => {
  const summaryMap = new Map<
    string,
    {
      withdrawalCount: number;
      totalAmount: number;
      approvedCount: number;
      pendingCount: number;
      withdrawals: Record<string, unknown>[];
    }
  >();

  Object.values(grouped || {}).forEach((providers) => {
    Object.values((providers as Record<string, unknown>) || {}).forEach((midsObj) => {
      Object.values((midsObj as Record<string, unknown>) || {}).forEach((midData) => {
        const md = midData as { docs?: Record<string, unknown>[] };
        const docs = Array.isArray(md?.docs) ? md.docs : [];

        docs.forEach((withdrawal) => {
          const empCode = normalizeEmpCode(withdrawal?.empCode);
          const current = summaryMap.get(empCode) || {
            withdrawalCount: 0,
            totalAmount: 0,
            approvedCount: 0,
            pendingCount: 0,
            withdrawals: [],
          };

          const amount = toNumber(withdrawal?.amount);
          const status = String(
            withdrawal?.status ?? withdrawal?.withdrawalStatus ?? '',
          ).toLowerCase();

          current.withdrawalCount += 1;
          current.totalAmount += amount;
          current.withdrawals.push(withdrawal);

          if (['approved', 'success', 'completed'].includes(status)) {
            current.approvedCount += 1;
          } else if (['pending', 'lock', 'locked', 'processing'].includes(status)) {
            current.pendingCount += 1;
          }

          summaryMap.set(empCode, current);
        });
      });
    });
  });

  return Array.from(summaryMap.entries())
    .map(([empCode, summary]) => ({
      empCode,
      withdrawalCount: summary.withdrawalCount,
      totalAmount: summary.totalAmount,
      approvedCount: summary.approvedCount,
      pendingCount: summary.pendingCount,
      withdrawals: summary.withdrawals,
    }))
    .sort((a, b) => b.withdrawalCount - a.withdrawalCount);
};

export const getWithdrawalSummaryByEmpCode = (
  payload: Record<string, unknown> = {},
): EmpCodeWithdrawalSummary[] => {
  if (payload.empCodeWiseSummary && typeof payload.empCodeWiseSummary === 'object') {
    return Object.entries(payload.empCodeWiseSummary as Record<string, unknown>)
      .map(([empCode, summary]) =>
        createSummary(normalizeEmpCode(empCode), (summary as Record<string, unknown>) || {}),
      )
      .sort((a, b) => b.withdrawalCount - a.withdrawalCount);
  }

  if (Array.isArray(payload.byEmpCode)) {
    return (payload.byEmpCode as Record<string, unknown>[])
      .map((item) => createSummary(normalizeEmpCode(item?.empCode), item))
      .sort((a, b) => b.withdrawalCount - a.withdrawalCount);
  }

  if (payload.grouped && typeof payload.grouped === 'object') {
    const grouped = payload.grouped as Record<string, unknown>;
    if (Object.keys(grouped).length > 0) {
      return aggregateWithdrawalsFromGrouped(grouped);
    }
  }

  return [];
};

const getAgentName = (withdrawal: Record<string, unknown>): string => {
  const action = withdrawal?.action as { name?: unknown } | undefined;
  const updatedBy = withdrawal?.updatedBy as { name?: unknown } | undefined;
  const approvedBy = withdrawal?.approvedBy as { name?: unknown } | undefined;
  const name = action?.name ?? withdrawal?.agentName ?? updatedBy?.name ?? approvedBy?.name;

  if (name === null || name === undefined || name === '') {
    return UNASSIGNED_AGENT;
  }
  return String(name).trim();
};

const countByKey = (
  withdrawals: Record<string, unknown>[],
  getKey: (withdrawal: Record<string, unknown>) => string,
): CountRow[] => {
  const countMap = new Map<string, number>();

  withdrawals.forEach((withdrawal) => {
    const key = getKey(withdrawal);
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });

  return Array.from(countMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
};

export const getAgentWithdrawalSummary = (
  payload: Record<string, unknown> = {},
): AgentWithdrawalSummary[] => {
  if (payload.agentWiseSummary && typeof payload.agentWiseSummary === 'object') {
    return Object.entries(payload.agentWiseSummary as Record<string, unknown>)
      .map(([agentName, summary]) => {
        const s = (summary as Record<string, unknown>) || {};
        const withdrawalsRaw = s.approvedItems || s.withdrawals || [];
        const withdrawals = Array.isArray(withdrawalsRaw)
          ? (withdrawalsRaw as Record<string, unknown>[])
          : [];
        const withdrawalCount =
          s.approvedCount ?? s.withdrawalCount ?? s.count ?? withdrawals.length;

        return {
          agentName,
          withdrawalCount: toNumber(withdrawalCount),
          withdrawals,
        };
      })
      .sort((a, b) => b.withdrawalCount - a.withdrawalCount);
  }

  const allWithdrawals = getWithdrawalSummaryByEmpCode(payload).flatMap((item) => item.withdrawals);

  const agentMap = new Map<string, Record<string, unknown>[]>();

  allWithdrawals.forEach((withdrawal) => {
    const agentName = getAgentName(withdrawal);
    const current = agentMap.get(agentName) || [];
    current.push(withdrawal);
    agentMap.set(agentName, current);
  });

  return Array.from(agentMap.entries())
    .map(([agentName, withdrawals]) => ({
      agentName,
      withdrawalCount: withdrawals.length,
      withdrawals,
    }))
    .sort((a, b) => b.withdrawalCount - a.withdrawalCount);
};

export const getAgentCountRows = (withdrawals: Record<string, unknown>[] = []): CountRow[] =>
  countByKey(withdrawals, getAgentName);

export const getEmpCodeCountRows = (withdrawals: Record<string, unknown>[] = []): CountRow[] =>
  countByKey(withdrawals, (withdrawal) => normalizeEmpCode(withdrawal?.empCode));

/** Per agent, how many withdrawals for each empCode. */
export const getAgentEmpCodeCountRows = (
  withdrawals: Record<string, unknown>[] = [],
): AgentEmpCountRow[] => {
  const map = new Map<string, AgentEmpCountRow>();

  withdrawals.forEach((withdrawal) => {
    const agentName = getAgentName(withdrawal);
    const empCode = normalizeEmpCode(withdrawal?.empCode);
    const key = `${agentName}||${empCode}`;
    const current = map.get(key) || { agentName, empCode, count: 0 };
    current.count += 1;
    map.set(key, current);
  });

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    const byAgent = a.agentName.localeCompare(b.agentName);
    if (byAgent !== 0) return byAgent;
    return a.empCode.localeCompare(b.empCode);
  });
};
