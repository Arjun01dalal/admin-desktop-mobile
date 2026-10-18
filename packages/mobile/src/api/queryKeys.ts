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
};
