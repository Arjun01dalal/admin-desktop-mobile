export type WithdrawalDoc = {
  _id?: string;
  amount?: number;
  name?: string;
  accountHolderName?: string;
  userName?: string;
  mobile?: string;
  userMobile?: string;
  city?: string;
  state?: string;
  clientName?: string;
  status?: string;
  createdOn?: string;
  updatedOn?: string;
  transactionId?: string;
  orderId?: string;
  empCode?: string;
  accountNo?: string;
  accountNumber?: string;
  bankName?: string;
  userBankName?: string;
  ifscCode?: string;
  ifsc?: string;
  commissionAmount?: string | number;
  dp_id?: string;
  action?: {
    name?: string;
    status?: string | boolean;
    date?: string;
  };
  gatewayName?: string;
  mid?: string | number;
  comment?: string;
  [key: string]: unknown;
};

export type MidRow = {
  mid: string;
  totalAmount: number;
  withdrawals: WithdrawalDoc[];
  count?: number;
};

export type GatewayGroup = {
  gatewayName: string;
  totalAmount: number;
  mids: MidRow[];
};

export type ProviderRow = {
  type: string;
  withdrewalProviderName: string;
  totalAmount: number;
  gatewayNames: GatewayGroup[];
};

export type TypeGroup = {
  type: string;
  providers: ProviderRow[];
};

export type AgentSummary = {
  name: string;
  approvedCount: number;
  lockCount: number;
  totalApprovedAmount: number;
  withdrawals: WithdrawalDoc[];
};

export type MidReportSummary = {
  bothInSheetAndDbCount?: number;
  dbButNotInSheetCount?: number;
  sheetButNotInDbCount?: number;
};

export type MidReportPayload = {
  summary?: MidReportSummary;
  bothInSheetAndDb?: WithdrawalDoc[];
  dbButNotInSheet?: WithdrawalDoc[];
  sheetButNotInDb?: WithdrawalDoc[];
  [key: string]: unknown;
};

/** Transform API `grouped` tree → NestedTable rows (old WithdrawalFund). */
export function transformWithdrawData(grouped: unknown): TypeGroup[] {
  if (!grouped || typeof grouped !== 'object') return [];

  const flatData = Object.entries(grouped as Record<string, unknown>)
    .map(([typeKey, providers]) => {
      return Object.entries((providers as Record<string, unknown>) || {}).map(
        ([providerName, midsObj]) => {
          const gatewayNames: GatewayGroup[] = [
            {
              gatewayName: providerName,
              totalAmount: 0,
              mids: Object.entries((midsObj as Record<string, unknown>) || {}).map(
                ([midName, midData]) => {
                  const md = midData as {
                    totalAmount?: number;
                    count?: number;
                    docs?: WithdrawalDoc[];
                    items?: WithdrawalDoc[];
                    withdrawals?: WithdrawalDoc[];
                  };
                  const withdrawals = pickDocList(md);
                  return {
                    mid: midName,
                    totalAmount: Number(md?.totalAmount || 0),
                    count: Number(md?.count || withdrawals.length || 0),
                    withdrawals,
                  };
                },
              ),
            },
          ];

          const totalAmount = gatewayNames[0].mids.reduce((sum, m) => sum + m.totalAmount, 0);
          gatewayNames[0].totalAmount = totalAmount;

          return {
            type: typeKey,
            withdrewalProviderName: providerName,
            totalAmount,
            gatewayNames,
          } satisfies ProviderRow;
        },
      );
    })
    .flat();

  const groupedByType: Record<string, TypeGroup> = {};
  flatData.forEach((item) => {
    if (!groupedByType[item.type]) {
      groupedByType[item.type] = { type: item.type, providers: [] };
    }
    groupedByType[item.type].providers.push(item);
  });

  return Object.values(groupedByType);
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

export function parseAgentSummaries(agentWiseSummary: unknown): AgentSummary[] {
  if (!agentWiseSummary || typeof agentWiseSummary !== 'object') return [];
  return Object.entries(agentWiseSummary as Record<string, unknown>).map(([name, summary]) => {
    const s = summary as {
      approvedCount?: number;
      lockCount?: number;
      totalApprovedAmount?: number;
      approvedItems?: WithdrawalDoc[];
      items?: WithdrawalDoc[];
      withdrawals?: WithdrawalDoc[];
      docs?: WithdrawalDoc[];
    };
    const withdrawals = pickDocList(s);
    return {
      name,
      approvedCount: Number(s?.approvedCount ?? withdrawals.length ?? 0),
      lockCount: Number(s?.lockCount ?? 0),
      totalApprovedAmount: Number(s?.totalApprovedAmount ?? 0),
      withdrawals,
    };
  });
}

/** Prefer docs / approvedItems / items / withdrawals from API mid/agent blobs. */
export function pickDocList(source: unknown): WithdrawalDoc[] {
  if (!source || typeof source !== 'object') return [];
  const s = source as Record<string, unknown>;
  for (const key of ['docs', 'approvedItems', 'withdrawals', 'items', 'list'] as const) {
    const v = s[key];
    if (Array.isArray(v)) return v as WithdrawalDoc[];
  }
  return [];
}
