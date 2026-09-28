import {
  parseAgentSummaries as parseAgentSummariesShared,
  pickDocList as pickDocListShared,
  sumGroupedTotal,
} from '@astro/shared/withdrawalFund';

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

export { sumGroupedTotal };

/** Prefer docs / approvedItems / items / withdrawals from API mid/agent blobs. */
export function pickDocList(source: unknown): WithdrawalDoc[] {
  return pickDocListShared<WithdrawalDoc>(source);
}

export function parseAgentSummaries(agentWiseSummary: unknown): AgentSummary[] {
  return parseAgentSummariesShared<WithdrawalDoc>(agentWiseSummary);
}
