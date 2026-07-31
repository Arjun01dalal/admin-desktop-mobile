import { Permissions, type Permission } from '@/auth/permissions';

export type NavItem = {
  id: string;
  label: string;
  path: string;
  /** When set, item is shown only if login `Responsibilities` includes it. */
  permission?: Permission;
};

/**
 * Panel side nav — visibility is driven by Role_ID → Responsibilities from login.
 * Items without `permission` (Welcome, House Games) are always visible.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: 'welcome', label: 'Welcome', path: '/welcome' },
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    permission: Permissions.View_Dashboard,
  },
  {
    id: 'vipDashboard',
    label: 'VIP Dashboard',
    path: '/vip-dashboard',
    permission: Permissions.View_Dashboard,
  },
  {
    id: 'combinedDashboard',
    label: 'Combined Dashboard',
    path: '/combined-dashboard',
    permission: Permissions.View_Dashboard,
  },
  {
    id: 'riskDashboard',
    label: 'Risk Dashboard',
    path: '/risk-dashboard',
    permission: Permissions.risk_management_analysis,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    permission: Permissions.analytics_tab,
  },
  {
    id: 'masterFlow',
    label: 'Master Flow',
    path: '/master-flow',
    permission: Permissions.master_flow,
  },
  {
    id: 'profitLoss',
    label: 'Profit & Loss',
    path: '/profit-loss',
    permission: Permissions.View_Profit_and_Loss,
  },
  { id: 'houseGames', label: 'House Games', path: '/house-games' },
  {
    id: 'callerResponsibility',
    label: 'Caller Responsibility',
    path: '/caller-responsibility',
    permission: Permissions.caller_responsibility,
  },
  {
    id: 'playerActivity',
    label: 'Player Activity',
    path: '/player-activity',
    permission: Permissions.player_activity,
  },
  {
    id: 'gameActivity',
    label: 'Games Activity',
    path: '/game-activity',
    permission: Permissions.game_activity,
  },
  {
    id: 'callLogs',
    label: 'Call Logs',
    path: '/call-logs',
    permission: Permissions.call_logs,
  },
  {
    id: 'newRegisters',
    label: 'New Registers',
    path: '/new-registers',
    permission: Permissions.new_registrations,
  },
  {
    id: 'users',
    label: 'Users',
    path: '/users',
    permission: Permissions.View_Users,
  },
  {
    id: 'loginReport',
    label: 'Login Report',
    path: '/login-report',
    permission: Permissions.Login_Report,
  },
  {
    id: 'allUserLoginReport',
    label: 'All User Login Report',
    path: '/all-user-login-report',
    permission: Permissions.login_logout_report,
  },
  {
    id: 'checkersReport',
    label: 'Checkers Report',
    path: '/checkers-report',
    permission: Permissions.Checkers_Report,
  },
  {
    id: 'sheetDownloadReport',
    label: 'Sheet Download Report',
    path: '/downlaodReport',
    permission: Permissions.sheet_downlaod_report,
  },
  {
    id: 'pointsReport',
    label: 'Points Report',
    path: '/coins-report',
    permission: Permissions.coin_report,
  },
  {
    id: 'coinRemoval',
    label: 'Coin Removal List',
    path: '/coins-removal',
    permission: Permissions.Coin_Removal,
  },
  {
    id: 'myCustomers',
    label: 'My Customers',
    path: '/my-customer',
    permission: Permissions.My_Customers,
  },
  {
    id: 'customerAllotment',
    label: 'Customer Allotment',
    path: '/customer-allotment',
    permission: Permissions.customer_allotment,
  },
  {
    id: 'nonPerformingUser',
    label: 'Non Performing User',
    path: '/non_performing_user',
    permission: Permissions.Non_Performing_User,
  },
  {
    id: 'todaysActive',
    label: 'Todays Active',
    path: '/todays-active',
    permission: Permissions.todays_active,
  },
  {
    id: 'feedback',
    label: 'Pending Feedback',
    path: '/feedback',
    permission: Permissions.View_Feedback,
  },
  {
    id: 'betConstructLists',
    label: 'BetConstruct Games',
    path: '/betConstruct-lists',
    permission: Permissions.View_Games,
  },
  {
    id: 'casinoLists',
    label: 'Casino Games',
    path: '/casino-lists',
    permission: Permissions.View_Games,
  },
  {
    id: 'usersKyc',
    label: 'KYC',
    path: '/users-kyc',
    permission: Permissions.View_KYCs,
  },
  {
    id: 'banners',
    label: 'Banners List',
    path: '/banners',
    permission: Permissions.View_Banners,
  },
  {
    id: 'upiLists',
    label: 'AB UPIs',
    path: '/upi-lists',
    permission: Permissions.View_UPIs,
  },
  {
    id: 'utrProvider',
    label: 'UTR Providers',
    path: '/utr-provider',
    permission: Permissions.Utr_Provider,
  },
  {
    id: 'playerRtp',
    label: 'Players RTP',
    path: '/playerRtp',
    permission: Permissions.player_rtp,
  },
  {
    id: 'dumpUsers',
    label: 'Dump Users',
    path: '/dumpUsers',
    permission: Permissions.View_Users,
  },
  {
    id: 'callerAllotment',
    label: 'Caller Allotment',
    path: '/callerAllotment',
    permission: Permissions.caller_allotment,
  },
  {
    id: 'percentage',
    label: 'Percentage',
    path: '/percentage',
    permission: Permissions.Percentage,
  },
  {
    id: 'newDeposits',
    label: 'New Deposits',
    path: '/newdeposits',
    permission: Permissions.New_Deposits,
  },
  {
    id: 'socialMedia',
    label: 'Social Media',
    path: '/social-media',
    permission: Permissions.Social_Media,
  },
  {
    id: 'mobileApp',
    label: 'Mobile App',
    path: '/mobile-app',
    permission: Permissions.Mobile_App,
  },
];

export type PanelPath = (typeof NAV_ITEMS)[number]['path'];

export const PANEL_PATHS = new Set<string>([
  ...NAV_ITEMS.map((item) => item.path),
  '/caller-responsibility/deposit-list',
  '/caller-responsibility/bot-users',
  '/caller-responsibility/details',
  '/player-activity/details',
  '/game-activity/details',
  '/coins-removal/details',
  '/coin-reports/report',
  '/customer-allotted',
  '/add-customer',
  '/remove-customer',
  '/playerRTPDetails',
]);
