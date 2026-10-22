/** Central query keys — invalidate by domain when mutations land (P1 later). */

export const queryKeys = {
  menuStats: {
    all: ['menuStats'] as const,
    today: (day: string) => ['menuStats', 'today', day] as const,
  },
  users: {
    all: ['users'] as const,
    list: (params: unknown) => ['users', 'list', params] as const,
  },
  dashboardUsers: {
    all: ['dashboardUsers'] as const,
    list: (kind: string, params: unknown) => ['dashboardUsers', kind, params] as const,
  },
  withdrawal: {
    all: ['withdrawal'] as const,
    list: (params: unknown) => ['withdrawal', 'list', params] as const,
    summary: (params: unknown) => ['withdrawal', 'summary', params] as const,
  },
  gtelCalls: {
    all: ['gtelCalls'] as const,
    page: (params: unknown) => ['gtelCalls', 'page', params] as const,
    callerCapped: (params: unknown) => ['gtelCalls', 'callerCapped', params] as const,
  },
  gtelCallerDashboard: {
    all: ['gtelCallerDashboard'] as const,
    page: (params: unknown) => ['gtelCallerDashboard', 'page', params] as const,
  },

  c2cCampaigns: {
    all: ['c2cCampaigns'] as const,
    list: (params: unknown) => ['c2cCampaigns', 'list', params] as const,
    detail: (campaignId: string) => ['c2cCampaigns', 'detail', campaignId] as const,
    customers: (params: unknown) => ['c2cCampaigns', 'customers', params] as const,
  },
};
