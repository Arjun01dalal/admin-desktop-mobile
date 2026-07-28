export const NAV_ITEMS = [
  { id: 'welcome', label: 'Welcome', path: '/welcome' },
  { id: 'houseGames', label: 'House Games', path: '/house-games' },
  { id: 'callerResponsibility', label: 'Caller Responsibility', path: '/caller-responsibility' },
  { id: 'playerActivity', label: 'Player Activity', path: '/player-activity' },
  { id: 'gameActivity', label: 'Games Activity', path: '/game-activity' },
  { id: 'callLogs', label: 'Call Logs', path: '/call-logs' },
  { id: 'newRegisters', label: 'New Registers', path: '/new-registers' },
  { id: 'coinRemoval', label: 'Coin Removal List', path: '/coin-removal' },
  { id: 'mobileApp', label: 'Mobile App', path: '/mobile-app' },
] as const;

export type PanelPath = (typeof NAV_ITEMS)[number]['path'];

export const PANEL_PATHS = new Set<string>(NAV_ITEMS.map((item) => item.path));
