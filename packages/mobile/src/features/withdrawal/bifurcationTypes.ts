/** Route params for `/withdrawal-bifurcation`. */
export type WithdrawalBifurcationParams = {
  startDate?: string;
  endDate?: string;
  clientName?: string;
};

export function bifurcationQueryKey(params: {
  startDate: string;
  endDate: string;
  clientName: string;
}) {
  return ['withdrawals', 'playedBifurcation', params] as const;
}
