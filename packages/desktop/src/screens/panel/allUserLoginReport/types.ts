export type ActionHistoryItem = {
  action?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export type AllUserLoginRow = {
  _id: string;
  name?: string;
  realName?: string;
  mobile?: string;
  actionHistory?: ActionHistoryItem[];
  [key: string]: unknown;
};

export type AllUserLoginResponse = {
  data?: AllUserLoginRow[];
  total?: number;
};

export function getActionStats(actionHistory: ActionHistoryItem[] = [], actionType: string) {
  const filtered = actionHistory.filter((item) => item?.action === actionType);
  return {
    count: filtered.length,
    lastItem: filtered.length ? filtered[filtered.length - 1] : null,
  };
}
